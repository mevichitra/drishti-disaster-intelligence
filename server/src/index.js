import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connect } from './db.js';
import { LiveFeed } from './live.js';
import { HOUR } from './sim.js';
import {
  rainTrendPipeline,
  riverTrendPipeline,
  rainLeaderboardPipeline,
  eventStatsPipeline,
  regionRankPipeline,
  nearPipeline,
  riverSeriesPipeline,
  labRegistry,
} from './analytics.js';

const PORT = Number(process.env.PORT || 5055);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = await connect();
const feed = new LiveFeed(db);
await feed.init();
feed.start(Number(process.env.TICK_MS || 6000));

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());
app.use('/api', (req, _res, next) => {
  feed.touch();
  next();
});

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(req.path, e);
    res.status(500).json({ error: e.message });
  });

// tiny TTL cache keyed by sim tick so repeated dashboard polls stay cheap
const cache = new Map();
async function cached(key, ttlTicks, compute) {
  const hit = cache.get(key);
  if (hit && feed.ticks - hit.tick < ttlTicks) return hit.value;
  const value = await compute();
  cache.set(key, { tick: feed.ticks, value });
  return value;
}
const timed = async (fn) => {
  const t = process.hrtime.bigint();
  const data = await fn();
  return { data, ms: Number(process.hrtime.bigint() - t) / 1e6 };
};

// ---------------------------------------------------------------- overview
app.get('/api/overview', wrap(async (_req, res) => {
  const risk = feed.risk;
  const sev = { CRITICAL: 0, HIGH: 0, ELEVATED: 0, NORMAL: 0 };
  risk.forEach((r) => sev[r.severity]++);
  const counts = await cached('counts', 3, async () => {
    const [rain, river, weather, events, stationsN] = await Promise.all([
      db.collection('rainfall_records').estimatedDocumentCount(),
      db.collection('river_levels').estimatedDocumentCount(),
      db.collection('weather_data').estimatedDocumentCount(),
      db.collection('disaster_events').estimatedDocumentCount(),
      db.collection('stations').estimatedDocumentCount(),
    ]);
    const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 });
    return { rain, river, weather, events, stationsN, storageMb: stats.storageSize, dataMb: stats.dataSize };
  });
  const activeAlerts = await db.collection('alerts').countDocuments({ status: 'active' });
  const avg24 = risk.length ? risk.reduce((a, r) => a + r.rain24h, 0) / risk.length : 0;
  const worst = risk[0];
  res.json({
    asOf: feed.simTime,
    live: !feed.paused,
    ticks: feed.ticks,
    severity: sev,
    activeAlerts,
    anomalies: risk.filter((r) => r.anomaly).length,
    countries: new Set(risk.map((r) => r.country)).size,
    stations: counts.stationsN,
    avgRain24h: +avg24.toFixed(1),
    maxRain24h: Math.max(...risk.map((r) => r.rain24h)),
    worst: worst && { id: worst._id, name: worst.name, country: worst.country, score: worst.score },
    records: { rainfall: counts.rain, river: counts.river, weather: counts.weather, total: counts.rain + counts.river + counts.weather, events: counts.events },
    storageMb: counts.storageMb,
    dataMb: counts.dataMb,
    activeScenarios: feed.events.map((e) => e.city),
  });
}));

// ---------------------------------------------------------------- stations / map
app.get('/api/stations', wrap(async (_req, res) => {
  res.json({
    asOf: feed.simTime,
    stations: feed.risk.map((r) => ({
      id: r._id,
      name: r.name,
      city: r.city,
      country: r.country,
      continent: r.continent,
      river: r.river_name,
      lat: r.location.coordinates[1],
      lng: r.location.coordinates[0],
      score: r.score,
      severity: r.severity,
      anomaly: r.anomaly,
      level: r.level,
      levelPct: r.levelPct,
      riseRate: r.riseRate,
      rainWin: r.rainWin,
      rain24h: r.rain24h,
      zoneId: r.zoneId,
    })),
  });
}));

app.get('/api/stations/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const hours = Math.min(720, Math.max(6, Number(req.query.hours) || 72));
  const st = await db.collection('stations').findOne({ _id: id });
  if (!st) return res.status(404).json({ error: 'station not found' });
  const now = feed.simTime;
  const since = new Date(now.getTime() - hours * HOUR);
  const [rain, river, weather, base, zone, nearEvents, alert] = await Promise.all([
    db.collection('rainfall_records').find({ stationId: id, ts: { $gt: since, $lte: now } }, { projection: { _id: 0, stationId: 0 } }).sort({ ts: 1 }).toArray(),
    db.collection('river_levels').aggregate(riverSeriesPipeline(id, since, now)).toArray(),
    db.collection('weather_data').find({ stationId: id, ts: { $gt: since, $lte: now } }, { projection: { _id: 0, stationId: 0 } }).sort({ ts: 1 }).toArray(),
    db.collection('station_baselines').findOne({ _id: id }),
    st.zoneId ? db.collection('risk_zones').findOne({ _id: st.zoneId }, { projection: { geometry: 0 } }) : null,
    db.collection('disaster_events').aggregate([
      { $geoNear: { near: st.location, distanceField: 'distM', maxDistance: 250000, spherical: true } },
      { $sort: { date: -1 } },
      { $limit: 6 },
      { $project: { _id: 0, title: 1, type: 1, date: 1, severity: 1, deaths: 1, affected: 1, distKm: { $round: [{ $divide: ['$distM', 1000] }, 0] } } },
    ]).toArray(),
    db.collection('alerts').findOne({ stationId: id, status: 'active' }),
  ]);
  const cur = feed.risk.find((r) => r._id === id);
  res.json({ station: st, current: cur, baseline: base, zone, rain, river, weather, nearEvents, alert, asOf: now });
}));

app.get('/api/near', wrap(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const km = Math.min(3000, Number(req.query.km) || 300);
  const { data, ms } = await timed(() => db.collection('stations').aggregate(nearPipeline(lng, lat, km, 12)).toArray());
  const byId = new Map(feed.risk.map((r) => [r._id, r]));
  res.json({ ms, results: data.map((s) => ({ ...s, score: byId.get(s._id)?.score, severity: byId.get(s._id)?.severity })) });
}));

app.get('/api/zones', wrap(async (_req, res) => {
  const zones = await cached('zones', 1000000, () => db.collection('risk_zones').find().toArray());
  const agg = new Map();
  for (const r of feed.risk) {
    const a = agg.get(r.zoneId) || { max: 0, sum: 0, n: 0, sev: 'NORMAL' };
    a.max = Math.max(a.max, r.score);
    a.sum += r.score;
    a.n++;
    agg.set(r.zoneId, a);
  }
  const sevOf = (s) => (s >= 70 ? 'CRITICAL' : s >= 50 ? 'HIGH' : s >= 30 ? 'ELEVATED' : 'NORMAL');
  res.json({
    type: 'FeatureCollection',
    features: zones.map((z) => {
      const a = agg.get(z._id) || { max: 0, sum: 0, n: 0 };
      return {
        type: 'Feature',
        geometry: z.geometry,
        properties: {
          id: z._id,
          name: z.name,
          city: z.city,
          country: z.country,
          classification: z.classification,
          populationM: z.populationM,
          areaKm2: z.areaKm2,
          maxScore: a.max,
          avgScore: a.n ? +(a.sum / a.n).toFixed(1) : 0,
          severity: sevOf(a.max),
        },
      };
    }),
  });
}));

// ---------------------------------------------------------------- analytics
app.get('/api/alerts', wrap(async (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : 'active';
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const rankStage = { $addFields: { rank: { $indexOfArray: [['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL'], '$severity'] } } };
  const docs = await db.collection('alerts').aggregate([
    { $match: { status } },
    rankStage,
    { $sort: status === 'active' ? { rank: -1, score: -1 } : { resolvedAt: -1 } },
    { $limit: limit },
    { $project: { history: 0, rank: 0 } },
  ]).toArray();
  res.json({ asOf: feed.simTime, alerts: docs });
}));

app.get('/api/regions', wrap(async (_req, res) => {
  const { data, ms } = await timed(() => db.collection('risk_snapshots').aggregate(regionRankPipeline(feed.simTime)).toArray());
  res.json({ ms, regions: data.map((r) => ({ country: r._id, ...r, _id: undefined })) });
}));

app.get('/api/trends', wrap(async (req, res) => {
  const unit = ['hour', 'day', 'month'].includes(req.query.unit) ? req.query.unit : 'day';
  const span = { hour: 72 * HOUR, day: 45 * 24 * HOUR, month: 360 * 24 * HOUR }[unit];
  const until = feed.simTime;
  const since = new Date(until.getTime() - span);
  const key = `trend:${unit}`;
  const out = await cached(key, unit === 'hour' ? 2 : 6, async () => {
    const [{ data: rain, ms: m1 }, { data: river, ms: m2 }] = await Promise.all([
      timed(() => db.collection('rainfall_records').aggregate(rainTrendPipeline(unit, since, until), { allowDiskUse: true }).toArray()),
      timed(() => db.collection('river_levels').aggregate(riverTrendPipeline(unit, since, until), { allowDiskUse: true }).toArray()),
    ]);
    const rows = new Map();
    const row = (t) => {
      const k = t.toISOString();
      if (!rows.has(k)) rows.set(k, { t });
      return rows.get(k);
    };
    const conts = new Set();
    for (const r of rain) {
      conts.add(r._id.c);
      const o = row(r._id.t);
      o[`rain_${r._id.c}`] = +r.avgRain.toFixed(2);
    }
    for (const r of river) {
      const o = row(r._id.t);
      o[`fill_${r._id.c}`] = +(r.avgFill * 100).toFixed(1);
    }
    return { unit, ms: +(m1 + m2).toFixed(0), continents: [...conts].sort(), series: [...rows.values()].sort((a, b) => a.t - b.t) };
  });
  res.json(out);
}));

app.get('/api/leaderboard', wrap(async (_req, res) => {
  const { data, ms } = await timed(() => db.collection('rainfall_records').aggregate(rainLeaderboardPipeline(feed.simTime)).toArray());
  res.json({ ms, rows: data.map((d) => ({ country: d._id, ...d, _id: undefined })) });
}));

app.get('/api/events/stats', wrap(async (_req, res) => {
  const out = await cached('events', 1000000, async () => {
    const { data, ms } = await timed(() => db.collection('disaster_events').aggregate(eventStatsPipeline()).toArray());
    const d = data[0];
    return {
      ms,
      totals: d.totals[0],
      byYear: d.byYear.map((x) => ({ year: x._id, events: x.events, deaths: x.deaths, affectedM: +x.affectedM.toFixed(1) })),
      byType: d.byType.map((x) => ({ type: x._id, ...x, _id: undefined })),
      byMonth: d.byMonth.map((x) => ({ month: x._id, events: x.events })),
      byContinent: d.byContinent.map((x) => ({ continent: x._id, ...x, _id: undefined })),
      deadliest: d.deadliest,
    };
  });
  res.json(out);
}));

// ---------------------------------------------------------------- reports
function recommendations(sev, top) {
  const rec = [];
  if (sev.CRITICAL > 0) rec.push(`Activate emergency operations for ${top.filter((r) => r.severity === 'CRITICAL').map((r) => r.city).filter((v, i, a) => a.indexOf(v) === i).join(', ')}; pre-position rescue teams and begin evacuation of low-lying wards.`);
  if (sev.HIGH > 0) rec.push('Issue public flood warnings for HIGH-severity basins and close riverside roads and underpasses.');
  if (sev.ELEVATED > 0) rec.push('Keep ELEVATED stations under hourly watch; verify pump stations and drainage readiness.');
  rec.push('Review gauges flagged as anomalies for sensor faults before escalating.');
  return rec;
}

async function buildReport() {
  const risk = feed.risk;
  const sev = { CRITICAL: 0, HIGH: 0, ELEVATED: 0, NORMAL: 0 };
  risk.forEach((r) => sev[r.severity]++);
  const regions = await db.collection('risk_snapshots').aggregate(regionRankPipeline(feed.simTime)).toArray();
  const alerts = await db.collection('alerts').find({ status: 'active' }).sort({ score: -1 }).limit(15).project({ history: 0 }).toArray();
  const top = risk.slice(0, 10);
  return {
    generatedAt: new Date(),
    asOf: feed.simTime,
    title: 'DRISHTI Situation Report',
    summary: `${sev.CRITICAL} critical, ${sev.HIGH} high and ${sev.ELEVATED} elevated gauges out of ${risk.length} monitored across ${new Set(risk.map((r) => r.country)).size} countries. ${risk.filter((r) => r.anomaly).length} gauges show statistically unusual readings.`,
    severity: sev,
    topStations: top.map((r) => ({ id: r._id, name: r.name, country: r.country, score: r.score, severity: r.severity, level: r.level, levelPct: r.levelPct, rain24h: r.rain24h, riseRate: r.riseRate })),
    topRegions: regions.slice(0, 8).map((r) => ({ country: r._id, continent: r.continent, maxScore: r.maxScore, avgScore: r.avgScore, critical: r.critical, high: r.high })),
    activeAlerts: alerts.map((a) => ({ station: a.stationName, country: a.country, severity: a.severity, score: a.score, reasons: a.reasons, since: a.triggeredAt })),
    recommendations: recommendations(sev, top),
  };
}

app.post('/api/reports', wrap(async (_req, res) => {
  const rep = await buildReport();
  const { insertedId } = await db.collection('reports').insertOne(rep);
  res.json({ id: insertedId, ...rep });
}));

app.get('/api/reports', wrap(async (_req, res) => {
  const list = await db.collection('reports').find().sort({ generatedAt: -1 }).limit(12).toArray();
  res.json({ reports: list });
}));

// ---------------------------------------------------------------- pipeline lab
app.get('/api/lab', wrap(async (_req, res) => {
  res.json({
    pipelines: labRegistry(feed.simTime).map(({ id, title, collection, blurb, pipeline }) => ({ id, title, collection, blurb, pipeline })),
  });
}));

app.post('/api/lab/:id/run', wrap(async (req, res) => {
  const p = labRegistry(feed.simTime).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'unknown pipeline' });
  const col = db.collection(p.collection);
  const { data, ms } = await timed(() => col.aggregate(p.pipeline, { allowDiskUse: true }).toArray());
  res.json({ ms: +ms.toFixed(1), count: data.length, sample: data.slice(0, 5) });
}));

// ---------------------------------------------------------------- control (demo)
app.post('/api/simulate/:city', wrap(async (req, res) => {
  const city = req.params.city;
  if (!feed.stations.some((s) => s.city === city)) return res.status(404).json({ error: 'unknown city' });
  res.json(feed.startEvent(city));
}));

app.get('/api/health', (_req, res) => res.json({ ok: true, simTime: feed.simTime, ticks: feed.ticks, paused: feed.paused }));

// ---------------------------------------------------------------- static client
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders: (res, file) => {
        if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => console.log(`DRISHTI listening on http://localhost:${PORT}  (sim time ${feed.simTime.toISOString()})`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    feed.stop();
    await feed.persist().catch(() => {});
    process.exit(0);
  });
}
