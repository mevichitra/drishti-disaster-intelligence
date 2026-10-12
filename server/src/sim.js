// Synthetic sensor-network simulator.
// One StationSim per monitoring station; step() advances the physical model by one hour
// and returns rainfall / river / weather readings. Used by the seeder (history) and by the
// live feed (continuing the same state), so history and live data are continuous.

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rng) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const S0 = 220; // catchment saturation constant (mm of effective antecedent rain)

export function dayOfYear(ms) {
  const d = new Date(ms);
  return Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY);
}

export function intensityClass(mm) {
  if (mm < 0.1) return 'none';
  if (mm < 2.5) return 'light';
  if (mm < 7.6) return 'moderate';
  if (mm < 25) return 'heavy';
  return 'extreme';
}

export class StationSim {
  constructor(station, rng, state) {
    this.st = station;
    this.rng = rng;
    const h = station.hotspot;
    this.wet = h.wet;
    this.peakDoy = (h.peakMonth - 1) * 30.4 + 15;
    this.a = Math.exp(-1 / (30 + (1 - h.flashy) * 60 + rng() * 10)); // recession constant
    this.s = state?.s ?? 20 + rng() * 40;
    this.storms = state?.storms ?? [];
    this.pAr = state?.pAr ?? 0; // pressure AR(1) state
    this.rangeM = station.dangerLevelM - station.baseLevelM;
  }

  seasonal(ms) {
    let d = Math.abs(dayOfYear(ms) - this.peakDoy);
    if (d > 182.5) d = 365 - d;
    return 0.3 + 0.7 * Math.exp(-((d / 55) ** 2));
  }

  forceStorm(durH, peakMm, age = 0) {
    this.storms.push({ age, dur: durH, peak: peakMm });
  }

  step(ms) {
    const { rng, st } = this;
    const seas = this.seasonal(ms);

    // spawn ambient storms
    if (this.storms.length < 2 && rng() < 0.004 + 0.02 * this.wet * seas) {
      this.storms.push({
        age: 0,
        dur: 5 + rng() * 26,
        peak: (2 + -Math.log(1 - rng()) * 5) * (0.5 + this.wet) * (0.6 + seas),
      });
    }

    let rain = rng() < 0.12 * seas ? -Math.log(1 - rng()) * 0.5 : 0;
    let stormLoad = 0;
    for (const s of this.storms) {
      const x = s.age / s.dur;
      const prof = x < 0.4 ? x / 0.4 : (1 - x) / 0.6;
      const v = Math.max(0, s.peak * prof) * (0.75 + rng() * 0.5);
      rain += v;
      stormLoad += s.peak * Math.max(0, prof);
      s.age += 1;
    }
    this.storms = this.storms.filter((s) => s.age < s.dur);
    rain = Math.round(rain * 10) / 10;

    // river: leaky reservoir with saturating response + seasonal baseflow
    this.s = this.s * this.a + rain;
    const frac = 1 - Math.exp(-this.s / S0);
    const noise = gauss(rng) * 0.012;
    const level = st.baseLevelM + this.rangeM * clamp(frac * 0.95 + 0.16 * seas + noise, 0, 1.25);
    const lvl = Math.round(level * 100) / 100;
    // rating curve: Q = k * (h - h0)^1.6
    const discharge = Math.round(18 * Math.pow(Math.max(lvl - st.baseLevelM + 0.4, 0.05), 1.6) * (1 + this.wet));

    // weather
    const hour = new Date(ms).getUTCHours();
    const localHour = (hour + st.location.coordinates[0] / 15 + 24) % 24;
    const lat = st.location.coordinates[1];
    const southern = lat < 0 ? -1 : 1;
    const doy = dayOfYear(ms);
    const annual = Math.cos(((doy - 200) / 365) * 2 * Math.PI); // warmest ~mid-July (north)
    const tBase = 29 - 0.45 * Math.abs(lat) + (0.12 * Math.abs(lat) + 2) * annual * southern;
    const diurnal = 4.5 * Math.sin(((localHour - 9) / 24) * 2 * Math.PI);
    const temp = tBase + diurnal - Math.min(stormLoad * 0.12, 4) + gauss(rng) * 0.6;
    const humidity = clamp(58 + 22 * seas * this.wet + Math.min(stormLoad * 1.4, 28) - diurnal * 1.5 + gauss(rng) * 3, 20, 100);
    const wind = Math.max(0, 9 + Math.min(stormLoad * 1.2, 40) * (0.6 + rng() * 0.8) + gauss(rng) * 3);
    this.pAr = this.pAr * 0.95 + gauss(rng) * 0.6;
    const pressure = 1012 - Math.min(stormLoad * 0.7, 22) + this.pAr + 2 * Math.sin((localHour / 12) * Math.PI);

    const out = {
      rain: { ts: new Date(ms), stationId: st._id, rainfallMm: rain, intensity: intensityClass(rain) },
      river: { ts: new Date(ms), stationId: st._id, levelM: lvl, dischargeCms: discharge },
      weather: {
        ts: new Date(ms),
        stationId: st._id,
        tempC: Math.round(temp * 10) / 10,
        humidityPct: Math.round(humidity),
        windKph: Math.round(wind * 10) / 10,
        pressureHpa: Math.round(pressure * 10) / 10,
      },
    };
    // flexible schema: coastal gauges also report tide height (varied document shape)
    if (st.coastal) out.river.tideM = Math.round((0.9 * Math.sin((ms / HOUR / 12.42) * 2 * Math.PI) + stormLoad * 0.02) * 100) / 100;
    return out;
  }

  snapshot() {
    return { s: this.s, storms: this.storms, pAr: this.pAr };
  }
}
