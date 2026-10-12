// All MongoDB aggregation pipelines used by DRISHTI live here so the API, the live feed
// and the "Pipeline Lab" page share one definition.
import { HOUR } from './sim.js';

export const SEVERITY = [
  { name: 'CRITICAL', min: 70 },
  { name: 'HIGH', min: 50 },
  { name: 'ELEVATED', min: 30 },
  { name: 'NORMAL', min: 0 },
];

// ---------------------------------------------------------------------------------------
// 1. Baselines: per-station statistics of "normal" conditions (history excluding last 48 h)
// ---------------------------------------------------------------------------------------
export function baselineRainPipeline(until) {
  return [
    { $match: { ts: { $lt: until } } },
    {
      $group: {
        _id: '$stationId',
        mean: { $avg: '$rainfallMm' },
        std: { $stdDevPop: '$rainfallMm' },
        pct: { $percentile: { input: '$rainfallMm', p: [0.95, 0.99], method: 'approximate' } },
        n: { $sum: 1 },
      },
    },
    {
      $project: {
        rain: { mean: '$mean', std: '$std', p95: { $arrayElemAt: ['$pct', 0] }, p99: { $arrayElemAt: ['$pct', 1] }, n: '$n' },
        computedAt: '$$NOW',
      },
    },
    { $merge: { into: 'station_baselines', on: '_id', whenMatched: 'merge', whenNotMatched: 'insert' } },
  ];
}

export function baselineRiverPipeline(until) {
  return [
    { $match: { ts: { $lt: until } } },
    {
      $group: {
        _id: '$stationId',
        mean: { $avg: '$levelM' },
        std: { $stdDevPop: '$levelM' },
        min: { $min: '$levelM' },
        max: { $max: '$levelM' },
        pct: { $percentile: { input: '$levelM', p: [0.95], method: 'approximate' } },
      },
    },
    {
      $project: {
        river: { mean: '$mean', std: '$std', min: '$min', max: '$max', p95: { $arrayElemAt: ['$pct', 0] } },
        computedAt: '$$NOW',
      },
    },
    { $merge: { into: 'station_baselines', on: '_id', whenMatched: 'merge', whenNotMatched: 'insert' } },
  ];
}

// ---------------------------------------------------------------------------------------
// 2. Risk scoring + anomaly detection (the heart of the system)
//    rainfall window -> $lookup river window -> $lookup baseline -> $lookup station
//    score = 100 * (0.5*levelPct + 0.3*rainZ + 0.2*riseRate)   (each term normalised 0..1)
// ---------------------------------------------------------------------------------------
export function riskPipeline(now, windowH = 6) {
  const since = new Date(now.getTime() - windowH * HOUR);
  const since24 = new Date(now.getTime() - 24 * HOUR);
  const clamp01 = (x) => ({ $min: [1, { $max: [0, x] }] });
  return [
    { $match: { ts: { $gt: since24, $lte: now } } },
    {
      $group: {
        _id: '$stationId',
        rainWin: { $avg: { $cond: [{ $gt: ['$ts', since] }, '$rainfallMm', '$$REMOVE'] } },
        rainMax: { $max: { $cond: [{ $gt: ['$ts', since] }, '$rainfallMm', '$$REMOVE'] } },
        rain24h: { $sum: '$rainfallMm' },
      },
    },
    {
      $lookup: {
        from: 'river_levels',
        localField: '_id',
        foreignField: 'stationId',
        as: 'river',
        pipeline: [
          { $match: { ts: { $gt: since, $lte: now } } },
          { $sort: { ts: 1 } },
          {
            $group: {
              _id: null,
              first: { $first: '$levelM' },
              last: { $last: '$levelM' },
              max: { $max: '$levelM' },
              firstTs: { $first: '$ts' },
              lastTs: { $last: '$ts' },
              discharge: { $last: '$dischargeCms' },
            },
          },
        ],
      },
    },
    { $unwind: '$river' },
    { $lookup: { from: 'station_baselines', localField: '_id', foreignField: '_id', as: 'base' } },
    { $unwind: '$base' },
    { $lookup: { from: 'stations', localField: '_id', foreignField: '_id', as: 'st' } },
    { $unwind: '$st' },
    {
      $set: {
        level: '$river.last',
        dtH: { $max: [{ $divide: [{ $subtract: ['$river.lastTs', '$river.firstTs'] }, HOUR] }, 1] },
      },
    },
    {
      $set: {
        riseRate: { $divide: [{ $subtract: ['$river.last', '$river.first'] }, '$dtH'] },
        levelPct: {
          $divide: [
            { $subtract: ['$level', '$st.baseLevelM'] },
            { $subtract: ['$st.dangerLevelM', '$st.baseLevelM'] },
          ],
        },
        zRain: { $divide: [{ $subtract: ['$rainWin', '$base.rain.mean'] }, { $max: ['$base.rain.std', 0.05] }] },
        zLevel: { $divide: [{ $subtract: ['$level', '$base.river.mean'] }, { $max: ['$base.river.std', 0.05] }] },
      },
    },
    {
      $set: {
        score: {
          $round: [
            {
              $multiply: [
                100,
                {
                  $add: [
                    { $multiply: [0.5, { $divide: [{ $min: [1.2, { $max: [0, '$levelPct'] }] }, 1.2] }] },
                    { $multiply: [0.3, clamp01({ $divide: ['$zRain', 6] })] },
                    { $multiply: [0.2, clamp01({ $divide: ['$riseRate', 0.4] })] },
                  ],
                },
              ],
            },
            1,
          ],
        },
      },
    },
    {
      $set: {
        severity: {
          $switch: {
            branches: SEVERITY.slice(0, 3).map((s) => ({ case: { $gte: ['$score', s.min] }, then: s.name })),
            default: 'NORMAL',
          },
        },
        anomaly: { $or: [{ $gte: ['$zRain', 3] }, { $gte: ['$zLevel', 3] }, { $gte: ['$riseRate', 0.25] }] },
      },
    },
    {
      $project: {
        _id: 1,
        score: 1,
        severity: 1,
        anomaly: 1,
        level: { $round: ['$level', 2] },
        levelPct: { $round: ['$levelPct', 3] },
        riseRate: { $round: ['$riseRate', 3] },
        rainWin: { $round: ['$rainWin', 2] },
        rainMax: 1,
        rain24h: { $round: ['$rain24h', 1] },
        zRain: { $round: ['$zRain', 2] },
        zLevel: { $round: ['$zLevel', 2] },
        discharge: '$river.discharge',
        asOf: '$river.lastTs',
        name: '$st.name',
        city: '$st.city',
        country: '$st.country',
        continent: '$st.continent',
        river_name: '$st.river',
        coastal: '$st.coastal',
        zoneId: '$st.zoneId',
        location: '$st.location',
        warningLevelM: '$st.warningLevelM',
        dangerLevelM: '$st.dangerLevelM',
        baseLevelM: '$st.baseLevelM',
      },
    },
    { $sort: { score: -1 } },
  ];
}

// ---------------------------------------------------------------------------------------
// 3. River rate-of-change with $setWindowFields / $derivative (per station time series)
// ---------------------------------------------------------------------------------------
export function riverSeriesPipeline(stationId, since, until) {
  return [
    { $match: { stationId, ts: { $gt: since, $lte: until } } },
    {
      $setWindowFields: {
        partitionBy: '$stationId',
        sortBy: { ts: 1 },
        output: {
          riseRate: { $derivative: { input: '$levelM', unit: 'hour' }, window: { range: [-3, 0], unit: 'hour' } },
          avg6h: { $avg: '$levelM', window: { range: [-6, 0], unit: 'hour' } },
        },
      },
    },
    { $project: { _id: 0, ts: 1, levelM: 1, dischargeCms: 1, tideM: 1, riseRate: { $round: ['$riseRate', 3] }, avg6h: { $round: ['$avg6h', 2] } } },
    { $sort: { ts: 1 } },
  ];
}

// ---------------------------------------------------------------------------------------
// 4. Time-bucketed trends (hour / day / month) joined to station metadata
// ---------------------------------------------------------------------------------------
export function rainTrendPipeline(unit, since, until) {
  return [
    { $match: { ts: { $gt: since, $lte: until } } },
    { $group: { _id: { s: '$stationId', t: { $dateTrunc: { date: '$ts', unit } } }, rain: { $sum: '$rainfallMm' }, peak: { $max: '$rainfallMm' } } },
    { $lookup: { from: 'stations', localField: '_id.s', foreignField: '_id', as: 'st', pipeline: [{ $project: { continent: 1 } }] } },
    { $unwind: '$st' },
    {
      $group: {
        _id: { t: '$_id.t', c: '$st.continent' },
        avgRain: { $avg: '$rain' },
        peak: { $max: '$peak' },
      },
    },
    { $sort: { '_id.t': 1 } },
  ];
}

export function riverTrendPipeline(unit, since, until) {
  return [
    { $match: { ts: { $gt: since, $lte: until } } },
    { $group: { _id: { s: '$stationId', t: { $dateTrunc: { date: '$ts', unit } } }, avgLevel: { $avg: '$levelM' }, maxLevel: { $max: '$levelM' } } },
    { $lookup: { from: 'stations', localField: '_id.s', foreignField: '_id', as: 'st', pipeline: [{ $project: { continent: 1, baseLevelM: 1, dangerLevelM: 1 } }] } },
    { $unwind: '$st' },
    {
      $group: {
        _id: { t: '$_id.t', c: '$st.continent' },
        avgFill: { $avg: { $divide: [{ $subtract: ['$avgLevel', '$st.baseLevelM'] }, { $subtract: ['$st.dangerLevelM', '$st.baseLevelM'] }] } },
        maxFill: { $max: { $divide: [{ $subtract: ['$maxLevel', '$st.baseLevelM'] }, { $subtract: ['$st.dangerLevelM', '$st.baseLevelM'] }] } },
      },
    },
    { $sort: { '_id.t': 1 } },
  ];
}

// ---------------------------------------------------------------------------------------
// 5. Rainfall leaderboard (24 h totals by country)
// ---------------------------------------------------------------------------------------
export function rainLeaderboardPipeline(now) {
  return [
    { $match: { ts: { $gt: new Date(now.getTime() - 24 * HOUR), $lte: now } } },
    { $group: { _id: '$stationId', total: { $sum: '$rainfallMm' }, peak: { $max: '$rainfallMm' } } },
    { $lookup: { from: 'stations', localField: '_id', foreignField: '_id', as: 'st', pipeline: [{ $project: { city: 1, country: 1, name: 1 } }] } },
    { $unwind: '$st' },
    { $group: { _id: '$st.country', total24h: { $avg: '$total' }, peakHourly: { $max: '$peak' }, stations: { $sum: 1 } } },
    { $set: { total24h: { $round: ['$total24h', 1] } } },
    { $sort: { total24h: -1 } },
    { $limit: 10 },
  ];
}

// ---------------------------------------------------------------------------------------
// 6. Historical disaster events: multi-facet statistics
// ---------------------------------------------------------------------------------------
export function eventStatsPipeline() {
  return [
    {
      $facet: {
        byYear: [
          { $group: { _id: { $year: '$date' }, events: { $sum: 1 }, deaths: { $sum: '$deaths' }, affectedM: { $sum: { $divide: ['$affected', 1e6] } } } },
          { $sort: { _id: 1 } },
        ],
        byType: [
          { $group: { _id: '$type', events: { $sum: 1 }, deaths: { $sum: '$deaths' }, damageUsdM: { $sum: '$damageUsdM' } } },
          { $sort: { events: -1 } },
        ],
        byMonth: [{ $group: { _id: { $month: '$date' }, events: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        byContinent: [
          { $group: { _id: '$continent', events: { $sum: 1 }, deaths: { $sum: '$deaths' }, damageUsdM: { $sum: '$damageUsdM' } } },
          { $sort: { events: -1 } },
        ],
        deadliest: [
          { $sort: { deaths: -1 } },
          { $limit: 8 },
          { $project: { _id: 0, title: 1, type: 1, country: 1, date: 1, deaths: 1, affected: 1, damageUsdM: 1, severity: 1 } },
        ],
        totals: [{ $group: { _id: null, events: { $sum: 1 }, deaths: { $sum: '$deaths' }, affected: { $sum: '$affected' }, damageUsdM: { $sum: '$damageUsdM' } } }],
      },
    },
  ];
}

// ---------------------------------------------------------------------------------------
// 7. Region ranking from the latest risk snapshot
// ---------------------------------------------------------------------------------------
export function regionRankPipeline(simTime) {
  return [
    { $match: { simTime } },
    {
      $group: {
        _id: '$country',
        continent: { $first: '$continent' },
        avgScore: { $avg: '$score' },
        maxScore: { $max: '$score' },
        stations: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] } },
        anomalies: { $sum: { $cond: ['$anomaly', 1, 0] } },
      },
    },
    { $set: { avgScore: { $round: ['$avgScore', 1] } } },
    { $sort: { maxScore: -1, avgScore: -1 } },
  ];
}

// ---------------------------------------------------------------------------------------
// 8. Geospatial: stations near a point (2dsphere)
// ---------------------------------------------------------------------------------------
export function nearPipeline(lng, lat, maxKm, limit = 10) {
  return [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distM',
        maxDistance: maxKm * 1000,
        spherical: true,
      },
    },
    { $limit: limit },
    { $project: { name: 1, city: 1, country: 1, river: 1, location: 1, distKm: { $round: [{ $divide: ['$distM', 1000] }, 1] } } },
  ];
}

// Registry shown on the "Pipeline Lab" page.
export function labRegistry(now) {
  const since7d = new Date(now.getTime() - 7 * 24 * HOUR);
  const since48 = new Date(now.getTime() - 48 * HOUR);
  return [
    {
      id: 'risk-scoring',
      title: 'Risk scoring & anomaly detection',
      collection: 'rainfall_records',
      blurb: '$group → $lookup (river window, baseline, station) → $set score/severity. Runs every live tick.',
      pipeline: riskPipeline(now, 6),
    },
    {
      id: 'baseline-river',
      title: 'Baseline: river-level statistics',
      collection: 'river_levels',
      blurb: '$group with $stdDevPop and $percentile, written back with $merge.',
      pipeline: baselineRiverPipeline(since48).slice(0, -1), // preview without the $merge side-effect
    },
    {
      id: 'rate-of-rise',
      title: 'River rate-of-rise (window functions)',
      collection: 'river_levels',
      blurb: '$setWindowFields + $derivative over a 3-hour sliding range for one gauge.',
      pipeline: riverSeriesPipeline('DRS-001', since48, now),
    },
    {
      id: 'rain-trend-day',
      title: 'Daily rainfall trend by continent',
      collection: 'rainfall_records',
      blurb: '$dateTrunc bucketing, two-level $group, $lookup to station metadata.',
      pipeline: rainTrendPipeline('day', since7d, now),
    },
    {
      id: 'rain-leaderboard',
      title: 'Rainfall leaderboard (last 24 h)',
      collection: 'rainfall_records',
      blurb: 'Station totals → country averages → $sort → $limit.',
      pipeline: rainLeaderboardPipeline(now),
    },
    {
      id: 'event-facets',
      title: 'Historical disaster statistics ($facet)',
      collection: 'disaster_events',
      blurb: 'One pass over events producing year, type, month, continent and deadliest-event facets.',
      pipeline: eventStatsPipeline(),
    },
    {
      id: 'geo-near',
      title: 'Nearest gauges to a point ($geoNear)',
      collection: 'stations',
      blurb: '2dsphere index lookup — 500 km around Patna, India.',
      pipeline: nearPipeline(85.14, 25.61, 500, 8),
    },
  ];
}
