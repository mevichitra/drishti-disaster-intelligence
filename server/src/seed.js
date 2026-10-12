// Builds the DRISHTI database: stations, risk zones, historical events and a large
// synthetic hourly sensor history (rainfall, river level, weather) for the whole network.
//   npm run seed            -> 180 days of hourly data  (~1.8 M documents)
//   SEED_DAYS=365 npm run seed
import { connect, close } from './db.js';
import { HOTSPOTS, GAUGE_SUFFIX } from './data/hotspots.js';
import { StationSim, mulberry32, HOUR, DAY } from './sim.js';
import { baselineRainPipeline, baselineRiverPipeline, riskPipeline } from './analytics.js';

const DAYS = Number(process.env.SEED_DAYS || 180);
const T0 = Math.floor(Date.now() / HOUR) * HOUR; // "now" of the simulated network
const rng = mulberry32(20261012);
const R = (a, b) => a + rng() * (b - a);

// Hotspots that are in the middle of a major flood event when the database is built,
// so the dashboard has something to show: [city, hours ago the storm began, peak mm/h, duration h]
const ONGOING = [
  ['Patna', 44, 20, 70],
  ['Guwahati', 30, 22, 72],
  ['Wuhan', 24, 18, 66],
  ['Bangkok', 16, 21, 68],
  ['Dhaka', 18, 19, 64],
  ['Cologne', 20, 17, 60],
  ['Houston', 10, 24, 56],
  ['Lokoja', 36, 18, 70],
  ['Porto Alegre', 28, 19, 66],
  ['Manila', 8, 23, 58],
  ['Mumbai', 12, 25, 50],
];

const EVENT_TYPES = [
  ['Flood', 0.5],
  ['Flash Flood', 0.2],
  ['Cyclone', 0.1],
  ['Landslide', 0.1],
  ['Storm Surge', 0.1],
];

function circlePolygon(lon, lat, radiusKm, n = 28) {
  const ring = [];
  const kmLat = 110.574;
  const kmLon = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 2 * Math.PI;
    const wobble = 1 + 0.18 * Math.sin(ang * 3 + lat);
    ring.push([+(lon + (Math.cos(ang) * radiusKm * wobble) / kmLon).toFixed(4), +(lat + (Math.sin(ang) * radiusKm * wobble) / kmLat).toFixed(4)]);
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

async function main() {
  const t00 = Date.now();
  const db = await connect();
  console.log(`DRISHTI seed — ${DAYS} days of hourly data, 3 sensor types`);

  for (const c of ['rainfall_records', 'river_levels', 'weather_data', 'stations', 'risk_zones', 'disaster_events', 'alerts', 'station_baselines', 'risk_snapshots', 'reports', 'sim_state']) {
    await db.collection(c).drop().catch(() => {});
  }
  const ts = { timeField: 'ts', metaField: 'stationId', granularity: 'hours' };
  for (const c of ['rainfall_records', 'river_levels', 'weather_data']) {
    await db.createCollection(c, { timeseries: ts });
  }

  // ---- stations + risk zones ------------------------------------------------------
  const stations = [];
  const zones = [];
  let n = 0;
  for (const h of HOTSPOTS) {
    const zoneId = `ZN-${String(h.id).padStart(3, '0')}`;
    const radius = 70 + h.wet * 110 + R(0, 30);
    zones.push({
      _id: zoneId,
      name: `${h.river} basin — ${h.city} flood zone`,
      city: h.city,
      country: h.country,
      continent: h.continent,
      classification: h.wet >= 0.8 ? 'Very High' : h.wet >= 0.6 ? 'High' : 'Moderate',
      populationM: +R(0.8, 14).toFixed(1),
      areaKm2: Math.round(Math.PI * radius * radius),
      geometry: circlePolygon(h.lon, h.lat, radius),
    });
    for (let k = 0; k < 3; k++) {
      n++;
      const base = +R(1.5, 4.5).toFixed(2);
      const range = R(5, 8.5);
      stations.push({
        _id: `DRS-${String(n).padStart(3, '0')}`,
        name: `${h.city} ${GAUGE_SUFFIX[k]}`,
        city: h.city,
        country: h.country,
        continent: h.continent,
        river: h.river,
        coastal: h.coastal,
        location: { type: 'Point', coordinates: [+(h.lon + R(-0.14, 0.14)).toFixed(4), +(h.lat + R(-0.12, 0.12)).toFixed(4)] },
        elevationM: Math.round(R(2, 380)),
        baseLevelM: base,
        warningLevelM: +(base + range * 0.62).toFixed(2),
        dangerLevelM: +(base + range * 0.85).toFixed(2),
        sensors: h.coastal ? ['rainfall', 'river_level', 'weather', 'tide'] : ['rainfall', 'river_level', 'weather'],
        agency: `${h.country} Water Resources Authority`,
        installedYear: 1995 + Math.floor(R(0, 28)),
        status: 'active',
        hotspot: h, // stripped before insert
      });
    }
  }

  const stationDocs = stations.map(({ hotspot, ...s }) => s);
  await db.collection('risk_zones').insertMany(zones);
  await db.collection('risk_zones').createIndex({ geometry: '2dsphere' });
  await db.collection('stations').insertMany(stationDocs);
  await db.collection('stations').createIndex({ location: '2dsphere' });
  await db.collection('stations').createIndex({ country: 1 });

  // assign each station to the risk zone that contains it (geospatial $geoWithin)
  for (const z of zones) {
    await db.collection('stations').updateMany({ location: { $geoWithin: { $geometry: z.geometry } }, city: z.city }, { $set: { zoneId: z._id } });
  }
  console.log(`  stations: ${stations.length}, risk zones: ${zones.length}`);

  // ---- historical disaster events (synthetic) -------------------------------------
  const events = [];
  const totalWet = HOTSPOTS.reduce((a, h) => a + h.wet, 0);
  for (let i = 0; i < 900; i++) {
    let pick = rng() * totalWet;
    let h = HOTSPOTS[0];
    for (const x of HOTSPOTS) {
      pick -= x.wet;
      if (pick <= 0) {
        h = x;
        break;
      }
    }
    let r = rng();
    let type = 'Flood';
    for (const [t, p] of EVENT_TYPES) {
      r -= p;
      if (r <= 0) {
        type = t;
        break;
      }
    }
    if ((type === 'Cyclone' || type === 'Storm Surge') && !h.coastal) type = 'Flood';
    const sev = Math.min(5, 1 + Math.floor(-Math.log(1 - rng()) * 1.4));
    const mag = Math.exp(R(0, 1) * 3) * sev;
    const yr = 2000 + Math.floor(R(0, 26));
    const peakMonth = h.peakMonth - 1;
    const month = Math.max(0, Math.min(11, Math.round(peakMonth + (rng() + rng() + rng() - 1.5) * 3)));
    const date = new Date(Date.UTC(yr, month, 1 + Math.floor(R(0, 27)), Math.floor(R(0, 23))));
    if (date.getTime() > T0) continue;
    events.push({
      title: `${yr} ${h.river} ${type.toLowerCase()}`,
      type,
      severity: sev,
      date,
      city: h.city,
      country: h.country,
      continent: h.continent,
      location: { type: 'Point', coordinates: [+(h.lon + R(-0.6, 0.6)).toFixed(3), +(h.lat + R(-0.5, 0.5)).toFixed(3)] },
      deaths: Math.round(mag * R(0.5, 14) * (sev >= 3 ? 3 : 1)),
      affected: Math.round(mag * R(8000, 90000)),
      damageUsdM: +(mag * R(2, 60)).toFixed(1),
      synthetic: true,
    });
  }
  await db.collection('disaster_events').insertMany(events);
  await db.collection('disaster_events').createIndex({ location: '2dsphere' });
  await db.collection('disaster_events').createIndex({ date: 1 });
  console.log(`  historical events: ${events.length}`);

  // ---- hourly sensor history ------------------------------------------------------
  const sims = stations.map((s, i) => new StationSim(s, mulberry32(1000 + i * 7919), null));
  const plan = new Map(); // station index -> [{ageH, dur, peak}]
  for (const [city, agoH, peak, dur] of ONGOING) {
    stations.forEach((s, i) => {
      if (s.city !== city) return;
      if (!plan.has(i)) plan.set(i, []);
      plan.get(i).push({ startMs: T0 - agoH * HOUR, dur: dur * R(0.9, 1.1), peak: peak * R(0.85, 1.15) });
    });
  }

  const totalHours = DAYS * 24;
  const startMs = T0 - totalHours * HOUR;
  const bufs = { rainfall_records: [], river_levels: [], weather_data: [] };
  const counts = { rainfall_records: 0, river_levels: 0, weather_data: 0 };
  let pending = [];
  const flush = async (force = false) => {
    for (const [name, buf] of Object.entries(bufs)) {
      if (buf.length >= 25000 || (force && buf.length)) {
        const docs = buf.splice(0, buf.length);
        counts[name] += docs.length;
        pending.push(db.collection(name).insertMany(docs, { ordered: false }));
      }
    }
    if (pending.length >= 6 || force) {
      await Promise.all(pending);
      pending = [];
    }
  };

  // warm up each simulator for 10 days so the soil/river state is realistic at t=start
  for (const sim of sims) for (let h = -240; h < 0; h++) sim.step(startMs + h * HOUR);

  let lastPct = -1;
  for (let h = 0; h <= totalHours; h++) {
    const ms = startMs + h * HOUR;
    for (let i = 0; i < sims.length; i++) {
      const p = plan.get(i);
      if (p) for (const e of p) if (!e.fired && ms >= e.startMs) { sims[i].forceStorm(e.dur, e.peak * (0.9 + rng() * 0.2)); e.fired = true; }
      const r = sims[i].step(ms);
      bufs.rainfall_records.push(r.rain);
      bufs.river_levels.push(r.river);
      bufs.weather_data.push(r.weather);
    }
    await flush();
    const pct = Math.floor((h / totalHours) * 10);
    if (pct !== lastPct) {
      lastPct = pct;
      console.log(`  generating… ${pct * 10}%`);
    }
  }
  await flush(true);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  sensor documents inserted: ${total.toLocaleString()} (${((Date.now() - t00) / 1000).toFixed(0)} s)`);

  for (const c of ['rainfall_records', 'river_levels', 'weather_data']) {
    await db.collection(c).createIndex({ stationId: 1, ts: -1 });
    await db.collection(c).createIndex({ ts: -1 });
  }

  // ---- baselines (aggregation $merge) + live-feed state ---------------------------
  const until = new Date(T0 - 48 * HOUR);
  await db.collection('rainfall_records').aggregate(baselineRainPipeline(until)).toArray();
  await db.collection('river_levels').aggregate(baselineRiverPipeline(until)).toArray();
  await db.collection('sim_state').insertMany([
    { _id: 'clock', simTime: new Date(T0), seededAt: new Date(), days: DAYS },
    ...sims.map((sim, i) => ({ _id: stations[i]._id, ...sim.snapshot() })),
  ]);
  await db.collection('alerts').createIndex({ stationId: 1, status: 1 });
  await db.collection('risk_snapshots').createIndex({ simTime: -1, score: -1 });
  await db.collection('risk_snapshots').createIndex({ stationId: 1, simTime: -1 });

  // sanity check: what does the risk pipeline say right now?
  const risk = await db.collection('rainfall_records').aggregate(riskPipeline(new Date(T0), 6)).toArray();
  const sev = {};
  risk.forEach((r) => (sev[r.severity] = (sev[r.severity] || 0) + 1));
  console.log('  initial risk distribution:', sev, '| top:', risk.slice(0, 5).map((r) => `${r.name} ${r.score}`).join(', '));
  console.log(`done in ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
