// Live sensor feed: advances the simulated network one hour per tick, stores the new
// readings, re-runs the risk pipeline and maintains the alert collection.
import { HOTSPOTS } from './data/hotspots.js';
import { StationSim, mulberry32, HOUR } from './sim.js';
import { riskPipeline } from './analytics.js';

const IDLE_PAUSE_MS = 5 * 60 * 1000;

export class LiveFeed {
  constructor(db) {
    this.db = db;
    this.risk = [];
    this.simTime = null;
    this.sims = [];
    this.stations = [];
    this.events = []; // synthetic flood events started by the scenario manager
    this.ticks = 0;
    this.lastActive = Date.now();
    this.paused = false;
    this.lastTickMs = 0;
    this.rng = mulberry32(Date.now() & 0xffffff);
    this.busy = false;
  }

  async init() {
    const { db } = this;
    this.stations = await db.collection('stations').find().sort({ _id: 1 }).toArray();
    const state = new Map((await db.collection('sim_state').find({ _id: { $ne: 'clock' } }).toArray()).map((s) => [s._id, s]));
    const clock = await db.collection('sim_state').findOne({ _id: 'clock' });
    if (!clock) throw new Error('Database is empty - run "npm run seed" first.');
    this.simTime = clock.simTime;
    this.sims = this.stations.map((st, i) => {
      st.hotspot = HOTSPOTS.find((h) => h.city === st.city);
      return new StationSim(st, mulberry32(777 + i * 31), state.get(st._id));
    });
    const hasSnapshot = await db.collection('risk_snapshots').countDocuments({ simTime: this.simTime }, { limit: 1 });
    await this.computeRisk(!hasSnapshot);
  }

  touch() {
    this.lastActive = Date.now();
    if (this.paused) this.paused = false;
  }

  start(intervalMs = 6000) {
    this.timer = setInterval(() => {
      if (Date.now() - this.lastActive > IDLE_PAUSE_MS) {
        this.paused = true;
        return;
      }
      this.tick().catch((e) => console.error('tick failed', e));
    }, intervalMs);
  }

  stop() {
    clearInterval(this.timer);
  }

  startEvent(city) {
    const idx = this.stations.map((s, i) => (s.city === city ? i : -1)).filter((i) => i >= 0);
    const dur = 40 + this.rng() * 30;
    const peak = 14 + this.rng() * 10;
    idx.forEach((i) => this.sims[i].forceStorm(dur, peak * (0.9 + this.rng() * 0.2)));
    this.events.push({ city, startedAt: this.simTime, endsAt: new Date(this.simTime.getTime() + dur * HOUR) });
    return { city, dur, peak };
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const { db } = this;
      this.simTime = new Date(this.simTime.getTime() + HOUR);
      this.ticks++;
      const ms = this.simTime.getTime();
      this.events = this.events.filter((e) => e.endsAt > this.simTime);

      // scenario manager: keep the world interesting
      // (always keep a few major storms in progress so the demo never goes quiet)
      const spawnP = this.events.length < 3 ? 0.35 : this.events.length < 6 ? 0.04 : 0;
      if (this.rng() < spawnP) {
        const h = HOTSPOTS[Math.floor(this.rng() * HOTSPOTS.length)];
        this.startEvent(h.city);
      }

      const rain = [];
      const river = [];
      const weather = [];
      for (const sim of this.sims) {
        const r = sim.step(ms);
        rain.push(r.rain);
        river.push(r.river);
        weather.push(r.weather);
      }
      await Promise.all([
        db.collection('rainfall_records').insertMany(rain, { ordered: false }),
        db.collection('river_levels').insertMany(river, { ordered: false }),
        db.collection('weather_data').insertMany(weather, { ordered: false }),
      ]);
      await this.computeRisk(true);
      if (this.ticks % 10 === 0) await this.persist();
      this.lastTickMs = Date.now();
    } finally {
      this.busy = false;
    }
  }

  async persist() {
    const { db } = this;
    await db.collection('sim_state').bulkWrite([
      { updateOne: { filter: { _id: 'clock' }, update: { $set: { simTime: this.simTime } }, upsert: true } },
      ...this.sims.map((s, i) => ({ updateOne: { filter: { _id: this.stations[i]._id }, update: { $set: s.snapshot() }, upsert: true } })),
    ]);
    await db.collection('risk_snapshots').deleteMany({ simTime: { $lt: new Date(this.simTime.getTime() - 14 * 24 * HOUR) } });
  }

  async computeRisk(store) {
    const { db } = this;
    const risk = await db.collection('rainfall_records').aggregate(riskPipeline(this.simTime, 6)).toArray();
    this.risk = risk;
    if (store) {
      await db.collection('risk_snapshots').insertMany(
        risk.map((r) => ({
          simTime: this.simTime,
          stationId: r._id,
          score: r.score,
          severity: r.severity,
          anomaly: r.anomaly,
          country: r.country,
          continent: r.continent,
          zoneId: r.zoneId,
          level: r.level,
          rainWin: r.rainWin,
        })),
        { ordered: false },
      );
      await this.updateAlerts(risk);
    }
  }

  reasons(r) {
    const out = [];
    out.push(`River at ${Math.round(r.levelPct * 100)}% of danger level (${r.level} m)`);
    if (r.riseRate > 0.05) out.push(`rising ${r.riseRate.toFixed(2)} m/h`);
    if (r.zRain >= 2) out.push(`rainfall ${r.rainWin} mm/h, ${r.zRain.toFixed(1)}σ above normal`);
    return out;
  }

  async updateAlerts(risk) {
    const col = this.db.collection('alerts');
    const active = new Map((await col.find({ status: 'active' }).toArray()).map((a) => [a.stationId, a]));
    const rank = { NORMAL: 0, ELEVATED: 1, HIGH: 2, CRITICAL: 3 };
    const ops = [];
    for (const r of risk) {
      const a = active.get(r._id);
      if (r.severity !== 'NORMAL' && !a && r.score >= 30) {
        ops.push({
          insertOne: {
            document: {
              stationId: r._id,
              stationName: r.name,
              city: r.city,
              country: r.country,
              continent: r.continent,
              status: 'active',
              severity: r.severity,
              peakSeverity: r.severity,
              score: r.score,
              peakScore: r.score,
              reasons: this.reasons(r),
              triggeredAt: this.simTime,
              updatedAt: this.simTime,
              history: [{ t: this.simTime, severity: r.severity, score: r.score }],
            },
          },
        });
      } else if (a) {
        if (r.score < 25) {
          ops.push({ updateOne: { filter: { _id: a._id }, update: { $set: { status: 'resolved', resolvedAt: this.simTime, updatedAt: this.simTime } } } });
        } else {
          const upd = {
            $set: { severity: r.severity, score: r.score, reasons: this.reasons(r), updatedAt: this.simTime },
            $max: { peakScore: r.score },
          };
          if (rank[r.severity] > rank[a.peakSeverity]) upd.$set.peakSeverity = r.severity;
          if (r.severity !== a.severity) upd.$push = { history: { t: this.simTime, severity: r.severity, score: r.score } };
          ops.push({ updateOne: { filter: { _id: a._id }, update: upd } });
        }
      }
    }
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
  }
}
