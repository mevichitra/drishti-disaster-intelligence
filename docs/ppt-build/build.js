const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const SH = path.resolve(__dirname, '../shots');
const OUT = path.resolve(__dirname, '../DRISHTI_BDA_Presentation.pptx');
const ev = JSON.parse(fs.readFileSync(path.join(SH, 'events.json'), 'utf8'));
const URL = 'https://windows.tailb18f6e.ts.net:8443';

// ---- palette (matches the dashboard) -------------------------------------------------
const BG = '0A101D', PANEL = '111B2F', PANEL2 = '16223A', BORDER = '22314F';
const TEXT = 'E8EEFB', MUTED = '8DA0C2', ACC = '3CC8FF';
const CRIT = 'FF3B5C', HIGH = 'FF8A3D', ELEV = 'FFD23F', NORM = '3DDC97', VIO = 'B18CFF';
const FONT = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'DRISHTI - Disaster & Emergency Intelligence System';
pres.author = 'Vichitra Attri, Vidhyashree S, Vidya Bai K, Vikram K';
pres.company = 'Bangalore Institute of Technology';

pres.defineSlideMaster({
  title: 'DARK',
  background: { color: BG },
  objects: [
    { text: { text: 'DRISHTI  ·  BIS701 Big Data Analytics  ·  Dept. of ISE, BIT', options: { x: 0.6, y: 7.08, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.08, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: 'right' },
  placeholders: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 0.85, fontFace: FONT, fontSize: 32, bold: true, color: TEXT, valign: 'middle', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({ title: 'COVER', background: { color: BG }, objects: [] });

const shadow = () => ({ type: 'outer', color: '000000', blur: 12, offset: 3, angle: 90, opacity: 0.35 });

const SECTIONS = ['Introduction', 'Solution', 'Design', 'Big Data', 'Analytics', 'Demo', 'Implementation', 'Results'];
SECTIONS.forEach((t) => pres.addSection({ title: t }));
let curSection = 'Introduction';
function slide(title, notes, section) {
  if (section) curSection = section;
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: curSection });
  s.addText(title, { placeholder: 'title' });
  if (notes) s.addNotes(notes);
  return s;
}

function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: o.fill || PANEL }, line: { color: o.line || BORDER, width: 0.75 }, shadow: shadow(), objectName: o.name || 'card' });
}

function textCard(s, x, y, w, h, head, body, color = ACC, o = {}) {
  card(s, x, y, w, h);
  s.addShape(pres.ShapeType.ellipse, { x: x + 0.25, y: y + 0.25, w: 0.22, h: 0.22, fill: { color }, line: { color, width: 0 }, objectName: 'dot' });
  s.addText(head, { x: x + 0.6, y: y + 0.16, w: w - 0.8, h: 0.4, fontFace: FONT, fontSize: o.headSize || 18, bold: true, color: TEXT, valign: 'middle', margin: 0, isTextBox: true });
  s.addText(body, { x: x + 0.25, y: y + 0.65, w: w - 0.5, h: h - 0.8, fontFace: FONT, fontSize: o.bodySize || 14, color: MUTED, valign: 'top', margin: 0, isTextBox: true, paraSpaceAfter: 4 });
}

function stat(s, x, y, w, h, value, label, sub, color = ACC) {
  card(s, x, y, w, h);
  s.addText(value, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.9, fontFace: FONT, fontSize: 44, bold: true, color, valign: 'middle', margin: 0, isTextBox: true });
  s.addText(label, { x: x + 0.25, y: y + 1.1, w: w - 0.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: TEXT, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: x + 0.25, y: y + 1.5, w: w - 0.5, h: h - 1.6, fontFace: FONT, fontSize: 14, color: MUTED, valign: 'top', margin: 0, isTextBox: true });
}

function shot(s, file, x, y, w, ratio) {
  s.addShape(pres.ShapeType.roundRect, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: w * ratio + 0.12, rectRadius: 0.06, fill: { color: PANEL }, line: { color: BORDER, width: 1 }, shadow: shadow(), objectName: 'frame' });
  s.addImage({ path: path.join(SH, file), x, y, w, h: w * ratio, objectName: 'screenshot', altText: 'DRISHTI dashboard screenshot' });
}

function bullets(s, items, x, y, w, h, size = 16) {
  s.addText(
    items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1, paraSpaceAfter: 10 } })),
    { x, y, w, h, fontFace: FONT, fontSize: size, color: TEXT, valign: 'top', margin: 0, isTextBox: true },
  );
}

// =====================================================================================
// 1. Cover
// =====================================================================================
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: 'Introduction' });
  s.addShape(pres.ShapeType.ellipse, { x: 8.7, y: 1.2, w: 4.2, h: 4.2, fill: { color: PANEL }, line: { color: BORDER, width: 1 }, objectName: 'ring1' });
  s.addShape(pres.ShapeType.ellipse, { x: 9.4, y: 1.9, w: 2.8, h: 2.8, fill: { color: PANEL2 }, line: { color: ACC, width: 2 }, objectName: 'ring2' });
  s.addShape(pres.ShapeType.ellipse, { x: 10.15, y: 2.65, w: 1.3, h: 1.3, fill: { color: CRIT }, line: { color: CRIT, width: 0 }, objectName: 'pupil' });
  s.addShape(pres.ShapeType.ellipse, { x: 10.58, y: 3.08, w: 0.44, h: 0.44, fill: { color: BG }, line: { color: BG, width: 0 }, objectName: 'pupil-core' });

  s.addText('BIG DATA ANALYTICS (BIS701)  ·  PROJECT PRESENTATION', { x: 0.7, y: 0.7, w: 8, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: ACC, margin: 0, isTextBox: true, charSpacing: 3 });
  s.addText([
    { text: 'DRISHTI', options: { fontFace: FONT, fontSize: 72, bold: true, color: TEXT } },
    { text: '  दृष्टि', options: { fontFace: 'Nirmala UI', fontSize: 40, bold: true, color: ACC } },
  ], { x: 0.7, y: 1.3, w: 8.5, h: 1.2, margin: 0, isTextBox: true, valign: 'middle' });
  s.addText('Disaster Risk Intelligence & Situational Hazard Tracking Interface', { x: 0.7, y: 2.55, w: 8.4, h: 0.9, fontFace: FONT, fontSize: 24, color: TEXT, margin: 0, isTextBox: true, valign: 'top' });
  s.addText('Disaster & Emergency Intelligence System: A MongoDB-Based Big Data Analytics Platform', { x: 0.7, y: 3.6, w: 8.2, h: 0.8, fontFace: FONT, fontSize: 16, italic: true, color: MUTED, margin: 0, isTextBox: true, valign: 'top' });

  s.addText([
    { text: 'Vichitra Attri  1BI23IS135', options: { breakLine: true } },
    { text: 'Vidhyashree S  1BI23IS136', options: { breakLine: true } },
    { text: 'Vidya Bai K  1BI23IS137', options: { breakLine: true } },
    { text: 'Vikram K  1BI23IS138' },
  ], { x: 0.7, y: 4.75, w: 4.2, h: 1.4, fontFace: FONT, fontSize: 15, color: TEXT, margin: 0, isTextBox: true, valign: 'top' });
  s.addText([
    { text: 'Under the guidance of', options: { color: MUTED, breakLine: true } },
    { text: 'Prof. Roopa B', options: { bold: true, breakLine: true } },
    { text: 'Assistant Professor, Dept. of ISE' },
  ], { x: 5.2, y: 4.75, w: 4.2, h: 1.4, fontFace: FONT, fontSize: 15, color: TEXT, margin: 0, isTextBox: true, valign: 'top' });
  s.addText('Department of Information Science & Engineering  ·  Bangalore Institute of Technology  ·  2026-27', { x: 0.7, y: 6.7, w: 11, h: 0.35, fontFace: FONT, fontSize: 12, color: MUTED, margin: 0, isTextBox: true });
  s.addNotes('Introduce the team and the project. DRISHTI means "vision / sight" in Hindi - the system gives authorities the ability to SEE disaster risk early. Full form: Disaster Risk Intelligence & Situational Hazard Tracking Interface.');
}

// =====================================================================================
// 2. Why
// =====================================================================================
{
  const s = slide('Floods move fast. Decisions are slow.', 'Floods, cyclones and extreme rainfall are among the most frequent and destructive natural disasters. A few hours of delay in noticing a rising river changes the outcome of the response. The problem is not lack of data - it is lack of an integrated, analysable view of it.', 'Introduction');
  s.addText('A few hours of delay in spotting heavy rainfall or a rising river can decide how an emergency response ends.', { x: 0.6, y: 1.5, w: 4.9, h: 2.6, fontFace: FONT, fontSize: 26, color: TEXT, margin: 0, isTextBox: true, valign: 'top' });
  s.addText('Rising urbanisation and unpredictable climate patterns make early detection harder every year.', { x: 0.6, y: 4.3, w: 4.9, h: 1.2, fontFace: FONT, fontSize: 16, color: MUTED, margin: 0, isTextBox: true, valign: 'top' });
  textCard(s, 6.0, 1.5, 6.7, 1.6, 'Hours matter', 'Early warning signs - heavy rain, fast-rising rivers - must be caught as they happen, not in next week\'s report.', CRIT);
  textCard(s, 6.0, 3.3, 6.7, 1.6, 'Data is scattered', 'Spreadsheets, paper reports and disconnected monitoring tools force analysts to piece the picture together by hand.', HIGH);
  textCard(s, 6.0, 5.1, 6.7, 1.6, 'Data keeps growing', 'IoT sensors, weather stations and satellites produce large, varied, fast-growing records that need scalable storage.', ACC);
}

// =====================================================================================
// 3. Problem statement
// =====================================================================================
{
  const s = slide('Problem statement: why existing systems fall short', 'Read the five drawbacks. The synopsis problem statement: there is no centralised, interactive, analytics-oriented disaster-intelligence platform that combines MongoDB storage and aggregation with map-based visualisation.');
  const rows = [
    ['Limited data processing', 'Static datasets support record-keeping, not large-scale processing of rainfall, river and weather records.'],
    ['Static files & manual reports', 'Spreadsheets and paper reports make centralised management and analysis difficult.'],
    ['Limited analytical insight', 'Little region-wise, time-based or severity-based risk analytics.'],
    ['Anomalies go unnoticed', 'Rainfall spikes and rapidly rising rivers are hard to detect without a database built for analytical queries.'],
    ['No interactive exploration', 'Users cannot drill into location-specific risk statistics on demand.'],
  ];
  rows.forEach((r, i) => {
    const y = 1.5 + i * 1.05;
    card(s, 0.6, y, 12.1, 0.9);
    s.addShape(pres.ShapeType.ellipse, { x: 0.8, y: y + 0.2, w: 0.5, h: 0.5, fill: { color: ACC }, line: { color: ACC, width: 0 }, objectName: 'badge' });
    s.addText(String(i + 1), { x: 0.8, y: y + 0.2, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: BG, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(r[0], { x: 1.6, y, w: 3.6, h: 0.9, fontFace: FONT, fontSize: 18, bold: true, color: TEXT, valign: 'middle', margin: 0, isTextBox: true });
    s.addText(r[1], { x: 5.3, y, w: 7.2, h: 0.9, fontFace: FONT, fontSize: 15, color: MUTED, valign: 'middle', margin: 0, isTextBox: true });
  });
}

// =====================================================================================
// 4. Objectives
// =====================================================================================
{
  const s = slide('Objectives', 'These map one-to-one to the synopsis objectives. Every one is demonstrable in the live dashboard.');
  const o = [
    ['Store at scale', 'Rainfall, river-level, weather and risk-zone data in MongoDB', ACC],
    ['Process with pipelines', 'MongoDB queries and aggregation pipelines instead of static files', VIO],
    ['Analyse history + live', 'Understand regional weather and river-level patterns', NORM],
    ['Map high-risk areas', 'Location-based data on an interactive risk map', HIGH],
    ['Detect anomalies', 'Unusual rainfall, river and weather changes flagged early', CRIT],
    ['Support decisions', 'Dashboards, reports and insights for faster response', ELEV],
  ];
  o.forEach((c, i) => {
    const x = 0.6 + (i % 3) * 4.1;
    const y = 1.5 + Math.floor(i / 3) * 2.7;
    textCard(s, x, y, 3.9, 2.5, c[0], c[1], c[2], { headSize: 20, bodySize: 16 });
  });
}

// =====================================================================================
// 5. Solution overview
// =====================================================================================
{
  const s = slide('The solution: DRISHTI command centre', 'This is the real application, running on a MongoDB with 3.6 million records. Left: key capabilities. Right: the command centre with KPIs, world risk map and live alerts.', 'Solution');
  bullets(s, [
    'World map of 138 river gauges in 29 countries',
    'Risk score 0-100 per gauge, recomputed every live tick',
    'Anomaly flags against each gauge\'s own baseline',
    'Live alert feed that escalates and resolves',
    'Drill-down hydrographs, weather and history',
    'One-click situation reports',
  ], 0.6, 1.55, 4.2, 5.2, 16);
  shot(s, 'command_c.png', 5.15, 1.5, 7.55, 830 / 1600);
}

// =====================================================================================
// 6. Architecture
// =====================================================================================
{
  const s = slide('System architecture', 'Walk the flow left to right. Data enters, is validated and stored as documents in MongoDB, aggregation pipelines compute risk and anomalies inside the database, Express exposes REST APIs and React renders the map and charts.', 'Design');
  const boxes = [
    ['Data sources', 'Rainfall gauges\nRiver levels\nWeather stations\nRisk-zone polygons\nHistorical events', VIO],
    ['Ingestion', 'Validate & clean\nNormalise units\nSynthetic sensor generator\nEnrich with location', NORM],
    ['MongoDB', 'Time-series collections\n2dsphere indexes\nFlexible documents\nBaselines via $merge', ACC],
    ['Aggregation', 'Risk scoring\nAnomaly detection\nTrends & rankings\nWindow functions', HIGH],
    ['Express API', 'REST endpoints\nCaching per tick\nAlert lifecycle\nReport generation', ELEV],
    ['React dashboard', 'Risk map & heatmap\nCharts & KPIs\nAlert feed\nReports', CRIT],
  ];
  const w = 1.85, gap = 0.2;
  boxes.forEach((b, i) => {
    const x = 0.6 + i * (w + gap);
    card(s, x, 1.7, w, 3.7);
    s.addShape(pres.ShapeType.roundRect, { x: x + 0.15, y: 1.85, w: w - 0.3, h: 0.5, rectRadius: 0.08, fill: { color: b[2] }, line: { color: b[2], width: 0 }, objectName: 'head' });
    s.addText(b[0], { x: x + 0.15, y: 1.85, w: w - 0.3, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: BG, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(b[1], { x: x + 0.2, y: 2.55, w: w - 0.4, h: 2.7, fontFace: FONT, fontSize: 14, color: TEXT, valign: 'top', margin: 0, isTextBox: true, paraSpaceAfter: 6 });
    if (i < boxes.length - 1) s.addText('▶', { x: x + w - 0.02, y: 3.35, w: gap + 0.04, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED, align: 'center', margin: 0, isTextBox: true });
  });
  s.addText('Client-server architecture: React.js frontend  ·  Node.js + Express.js backend  ·  MongoDB database  (as proposed in the synopsis)', { x: 0.6, y: 5.75, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 16, color: MUTED, margin: 0, isTextBox: true, align: 'center' });
}

// =====================================================================================
// 7. Data model
// =====================================================================================
{
  const s = slide('MongoDB data model: 11 collections', 'The first six are the collections named in the synopsis chapter 6.2. The rest support analytics: baselines, risk history, alerts and reports. Three sensor collections are MongoDB time-series collections.', 'Design');
  const head = (t) => ({ text: t, options: { bold: true, color: ACC, fill: { color: PANEL2 }, fontFace: FONT, fontSize: 14 } });
  const cell = (t, o = {}) => ({ text: t, options: { color: TEXT, fill: { color: PANEL }, fontFace: FONT, fontSize: 14, ...o } });
  const rows = [
    [head('Collection'), head('Kind'), head('Holds'), head('Notable index')],
    ['stations', 'standard', '138 gauges, thresholds, GeoJSON location', '2dsphere on location'],
    ['rainfall_records', 'time-series', 'hourly rainfall mm, intensity class', 'meta stationId + ts'],
    ['river_levels', 'time-series', 'level m, discharge, optional tide', 'meta stationId + ts'],
    ['weather_data', 'time-series', 'temperature, humidity, wind, pressure', 'meta stationId + ts'],
    ['risk_zones', 'standard', '46 flood-zone polygons + classification', '2dsphere on geometry'],
    ['disaster_events', 'standard', '900 historical events with impact', '2dsphere + date'],
    ['station_baselines', 'derived', 'mean, σ, p95, p99 per gauge ($merge)', '_id = stationId'],
    ['risk_snapshots / alerts / reports', 'derived', 'risk history, alert lifecycle, situation reports', 'simTime, status'],
  ].map((r, i) => (i === 0 ? r : r.map((t, j) => cell(t, j === 0 ? { bold: true } : j === 1 ? { color: t === 'time-series' ? NORM : t === 'derived' ? VIO : MUTED } : {}))));
  s.addTable(rows, { x: 0.6, y: 1.5, w: 12.1, colW: [3.3, 1.5, 4.5, 2.8], rowH: 0.5, border: { type: 'solid', pt: 0.75, color: BORDER }, valign: 'middle', margin: [0, 0.12, 0, 0.12] });
}

// =====================================================================================
// 8. Scale
// =====================================================================================
{
  const s = slide('Built for big data: measured on this system', 'All numbers are measured on the running system on a single laptop. Be clear the readings are synthetic, as allowed by the synopsis, so we could demonstrate volume. Aggregation timings come from the Pipeline Lab.', 'Big Data');
  const st = [
    ['3.6 M', 'sensor documents', '365 days of hourly rainfall, river and weather readings', ACC],
    ['138', 'gauges · 29 countries', 'Six continents, 46 flood-risk zones', NORM],
    ['~3 s', 'one year, 3 M docs', 'Monthly continent trends via two-level $group + $lookup', VIO],
    ['< 50 ms', 'historical $facet', '900 events summarised by year, type, month, continent', HIGH],
    ['~3 ms', '$geoNear query', 'Gauges within 400 km of a point, 2dsphere index', ELEV],
    ['6 s', 'live tick', 'New readings stored, risk re-scored, alerts updated', CRIT],
  ];
  st.forEach((c, i) => {
    stat(s, 0.6 + (i % 3) * 4.1, 1.5 + Math.floor(i / 3) * 2.7, 3.9, 2.5, c[0], c[1], c[2], c[3]);
  });
  s.addText('Readings are synthetic (generated by a hydrological-style simulator) as permitted by the synopsis; gauge locations use real flood-prone cities.', { x: 0.6, y: 6.7, w: 12.1, h: 0.3, fontFace: FONT, fontSize: 12, italic: true, color: MUTED, margin: 0, isTextBox: true });
}

// =====================================================================================
// 9. MongoDB features
// =====================================================================================
{
  const s = slide('Why MongoDB: capabilities we actually use', 'Each card is a MongoDB feature used in the code, not a claim. Time-series collections for sensor data, the aggregation framework for analytics, window functions for rate of change, 2dsphere for geo queries, statistical accumulators for baselines, flexible schema for varied sensors.', 'Big Data');
  const f = [
    ['Time-series collections', 'Hourly sensor readings bucketed by station and time for compact storage and fast range scans.', ACC],
    ['Aggregation framework', '$group, $lookup, $facet, $dateTrunc and $merge run the analytics inside the database.', VIO],
    ['Window functions', '$setWindowFields with $derivative gives river rate-of-rise over a sliding 3-hour range.', HIGH],
    ['Geospatial queries', '2dsphere indexes with $geoNear and $geoWithin for nearest gauges and zone membership.', NORM],
    ['Statistical accumulators', '$stdDevPop and $percentile build per-gauge baselines of normal conditions.', ELEV],
    ['Flexible schema', 'Coastal gauges add tide height without any migration; documents vary by sensor type.', CRIT],
  ];
  f.forEach((c, i) => textCard(s, 0.6 + (i % 3) * 4.1, 1.5 + Math.floor(i / 3) * 2.7, 3.9, 2.5, c[0], c[1], c[2], { headSize: 18, bodySize: 15 }));
}

// =====================================================================================
// 10. Risk model
// =====================================================================================
{
  const s = slide('Risk scoring and anomaly detection', 'The score blends three normalised signals. Level percentage: how close the river is to its danger level. Rain z-score: how unusual the last six hours of rain are for this gauge. Rise rate: how fast the river is climbing. Severity bands map score to colours. An anomaly is flagged on statistical outliers independent of score.', 'Analytics');
  card(s, 0.6, 1.5, 12.1, 1.35);
  s.addText('score = 100 × ( 0.5 · level%  +  0.3 · rain z  +  0.2 · rise rate )', { x: 0.8, y: 1.55, w: 11.7, h: 0.75, fontFace: 'Courier New', fontSize: 20, bold: true, color: ACC, valign: 'middle', margin: 0, isTextBox: true });
  s.addText('level% = (level − base) / (danger − base)  ·  rain z = (6 h mean − μ) / σ ÷ 6  ·  rise = (m/h) ÷ 0.4  — each term capped to 0-1', { x: 0.8, y: 2.25, w: 11.7, h: 0.45, fontFace: FONT, fontSize: 14, color: MUTED, valign: 'middle', margin: 0, isTextBox: true });

  const bands = [['CRITICAL', '≥ 70', CRIT, 'FFFFFF'], ['HIGH', '50 - 70', HIGH, BG], ['ELEVATED', '30 - 50', ELEV, BG], ['NORMAL', '< 30', NORM, BG]];
  bands.forEach((b, i) => {
    const x = 0.6 + i * 3.075;
    s.addShape(pres.ShapeType.roundRect, { x, y: 3.1, w: 2.9, h: 1.0, rectRadius: 0.1, fill: { color: b[2] }, line: { color: b[2], width: 0 }, objectName: 'band' });
    s.addText([{ text: b[0], options: { bold: true, fontSize: 20, breakLine: true } }, { text: 'score ' + b[1], options: { fontSize: 14 } }], { x, y: 3.1, w: 2.9, h: 1.0, fontFace: FONT, color: b[3], align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  });

  card(s, 0.6, 4.4, 5.9, 2.3);
  s.addText('Anomaly flag', { x: 0.85, y: 4.5, w: 5.4, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: TEXT, margin: 0, isTextBox: true });
  bullets(s, ['Rainfall z ≥ 3σ above the gauge\'s normal', 'River-level z ≥ 3σ above its mean', 'River rising ≥ 0.25 m per hour'], 0.85, 5.0, 5.4, 1.6, 15);
  card(s, 6.8, 4.4, 5.9, 2.3);
  s.addText('Pipeline stages (one query)', { x: 7.05, y: 4.5, w: 5.4, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: TEXT, margin: 0, isTextBox: true });
  s.addText('$match → $group → $lookup(river window)\n→ $lookup(baseline) → $lookup(station)\n→ $set(z-scores, score, severity) → $sort', { x: 7.05, y: 5.0, w: 5.4, h: 1.5, fontFace: 'Courier New', fontSize: 14, color: ACC, valign: 'top', margin: 0, isTextBox: true });
}

// =====================================================================================
// 11. Risk map
// =====================================================================================
{
  const s = slide('Live demo: interactive risk map and heatmap', 'Show: hover a gauge for the tooltip, toggle heatmap, filter by severity or continent, risk zones coloured by worst gauge inside them. Pulsing rings mark CRITICAL and HIGH gauges.', 'Demo');
  bullets(s, [
    'Hover for rainfall, river level and risk status',
    'Click a gauge for full statistics',
    'Zones coloured by worst gauge inside',
    'Heatmap shows risk intensity across regions',
    'Filter by severity, continent or name',
  ], 0.6, 1.55, 3.9, 5, 16);
  shot(s, 'map.png', 4.8, 1.5, 7.9, 900 / 1600);
}

// =====================================================================================
// 12. Drill-down
// =====================================================================================
{
  const s = slide('Station drill-down: from alert to evidence', 'Click any alert and the drill-down shows the reasoning: how close to danger level, how fast rising, how unusual the rainfall is. The hydrograph shows rainfall hyetograph inverted above the river level with warning and danger lines.', 'Demo');
  shot(s, 'station.png', 0.6, 1.5, 7.9, 1000 / 1600);
  textCard(s, 8.85, 1.5, 3.85, 1.9, 'Why this gauge?', 'Plain-language reasons: % of danger level, rise rate, rainfall σ.', CRIT, { bodySize: 14 });
  textCard(s, 8.85, 3.6, 3.85, 1.9, 'Hydrograph', 'Rainfall bars with river level against warning and danger thresholds.', ACC, { bodySize: 14 });
  textCard(s, 8.85, 5.7, 3.85, 1.2, 'Local history', 'Past events within 250 km via $geoNear.', VIO, { bodySize: 14, headSize: 16 });
}

// =====================================================================================
// 13. Analytics
// =====================================================================================
{
  const s = slide('Analytics: trends, rankings and anomalies', 'Everything here is computed on the fly by aggregation pipelines. Switch between hourly, daily and monthly granularity; the system reports how long the aggregation took.', 'Demo');
  shot(s, 'analytics_c.png', 0.6, 1.45, 8.3, 950 / 1600);
  bullets(s, [
    'Hourly, daily and monthly trends by continent',
    'Regional risk ranking from latest snapshot',
    'Live anomaly table with z-scores and rise rate',
    'Historical events: year, type, season',
  ], 9.25, 1.55, 3.5, 4.5, 15);
}

// =====================================================================================
// 14. Pipeline lab + reports
// =====================================================================================
{
  const s = slide('Pipeline Lab and situation reports', 'The Pipeline Lab exposes the exact aggregation pipelines and lets the audience run them against live data with timing. Reports are generated from the same results and stored in MongoDB.', 'Demo');
  shot(s, 'lab.png', 0.6, 1.5, 5.95, 900 / 1600);
  shot(s, 'reports_c.png', 6.8, 1.5, 5.95, 900 / 1600);
  s.addText('Pipeline Lab: inspect and run every pipeline with timings', { x: 0.6, y: 5.2, w: 5.95, h: 0.8, fontFace: FONT, fontSize: 16, bold: true, color: TEXT, margin: 0, isTextBox: true, valign: 'top' });
  s.addText('Situation report: severity summary, top gauges, regions of concern, recommended actions', { x: 6.8, y: 5.2, w: 5.95, h: 0.8, fontFace: FONT, fontSize: 16, bold: true, color: TEXT, margin: 0, isTextBox: true, valign: 'top' });
}

// =====================================================================================
// 15. Modules
// =====================================================================================
{
  const s = slide('Project modules and how they were built', 'This maps the six synopsis modules onto the implementation.', 'Implementation');
  const head = (t) => ({ text: t, options: { bold: true, color: ACC, fill: { color: PANEL2 }, fontFace: FONT, fontSize: 14 } });
  const cell = (t, o = {}) => ({ text: t, options: { color: TEXT, fill: { color: PANEL }, fontFace: FONT, fontSize: 14, ...o } });
  const rows = [
    [head('Synopsis module'), head('Implementation')],
    ['6.1 Data collection & preprocessing', 'Seeder + simulator generate and validate station, rainfall, river and weather records'],
    ['6.2 MongoDB data storage', 'Time-series and standard collections with 2dsphere indexes'],
    ['6.3 Processing & aggregation', 'Pipelines for totals, trends, rankings, rate of change, baselines'],
    ['6.4 Risk zone & anomaly detection', 'Risk score, severity bands, z-score and rise-rate anomaly flags, alerts'],
    ['6.5 Interactive map & dashboard', 'React-Leaflet map, heatmap, KPI cards, Recharts, station drill-down'],
    ['6.6 Analytics & reporting', 'Analytics page, stored situation reports, printable PDF view'],
  ].map((r, i) => (i === 0 ? r : [cell(r[0], { bold: true }), cell(r[1])]));
  s.addTable(rows, { x: 0.6, y: 1.5, w: 12.1, colW: [4.3, 7.8], rowH: 0.62, border: { type: 'solid', pt: 0.75, color: BORDER }, valign: 'middle', margin: [0, 0.12, 0, 0.12] });
  s.addText('Stack: React 19 + Vite · Recharts · React-Leaflet · Node.js + Express · MongoDB 7', { x: 0.6, y: 6.2, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 16, color: MUTED, margin: 0, isTextBox: true });
}

// =====================================================================================
// 16. History chart (native)
// =====================================================================================
{
  const s = slide('Historical disaster patterns', 'Generated by a single $facet aggregation over the disaster_events collection. The data is synthetic, but the pipeline is the same one that would run on a real catalogue. Point out the monsoon-season peak July to September.', 'Results');
  const types = ev.byType;
  s.addChart(pres.charts.BAR, [{ name: 'Events', labels: types.map((t) => t.type), values: types.map((t) => t.events) }], {
    x: 0.6, y: 1.5, w: 6.0, h: 4.8, barDir: 'bar', chartColors: [ACC],
    showTitle: true, title: 'Events by hazard type (2000-2026)', titleColor: TEXT, titleFontSize: 16, titleFontFace: FONT,
    showValue: true, dataLabelColor: TEXT, dataLabelFontSize: 12, dataLabelFontFace: FONT,
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 12, catAxisLabelFontFace: FONT, catAxisOrientation: 'maxMin',
    valAxisLabelColor: MUTED, valAxisLabelFontSize: 12, valAxisLabelFontFace: FONT,
    valGridLine: { color: BORDER, size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false,
  });
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  s.addChart(pres.charts.BAR, [{ name: 'Events', labels: months, values: ev.byMonth.map((m) => m.events) }], {
    x: 6.8, y: 1.5, w: 5.9, h: 4.8, barDir: 'col', chartColors: [VIO],
    showTitle: true, title: 'Seasonality: events by month', titleColor: TEXT, titleFontSize: 16, titleFontFace: FONT,
    showValue: true, dataLabelColor: TEXT, dataLabelFontSize: 12, dataLabelFontFace: FONT,
    catAxisLabelColor: MUTED, catAxisLabelFontSize: 12, catAxisLabelFontFace: FONT,
    valAxisLabelColor: MUTED, valAxisLabelFontSize: 12, valAxisLabelFontFace: FONT,
    valGridLine: { color: BORDER, size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false,
  });
  s.addText(`${ev.totals.events} events · ${(ev.totals.deaths).toLocaleString('en-US')} lives lost · ${Math.round(ev.totals.affected / 1e6)} M people affected · computed in ${Math.round(ev.ms)} ms with one $facet pass (synthetic data)`, { x: 0.6, y: 6.5, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED, margin: 0, isTextBox: true });
}

// =====================================================================================
// 17. Outcomes + future
// =====================================================================================
{
  const s = slide('Outcomes and future scope', 'Left: what was delivered versus the synopsis expected outcomes. Right: natural extensions.', 'Results');
  card(s, 0.6, 1.5, 6.0, 5.2);
  s.addText('Delivered', { x: 0.9, y: 1.65, w: 5.4, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: NORM, margin: 0, isTextBox: true });
  bullets(s, [
    'Centralised MongoDB with 3.6 M records',
    'Database-driven interactive risk map and heatmap',
    'Anomaly detection and risk scoring in aggregation pipelines',
    'Hourly, daily and monthly trends',
    'KPI dashboard, alerts and stored reports',
    'Pipeline Lab showing every query',
  ], 0.9, 2.3, 5.4, 4.3, 15);
  card(s, 6.8, 1.5, 5.9, 5.2);
  s.addText('Future scope', { x: 7.1, y: 1.65, w: 5.3, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: ACC, margin: 0, isTextBox: true });
  bullets(s, [
    'Real IoT and satellite feeds replacing the simulator',
    'Predictive flood forecasting with ML',
    'SMS and push alerting to authorities',
    'Sharded MongoDB cluster for national scale',
    'Integration with emergency-response systems',
  ], 7.1, 2.3, 5.3, 4.3, 15);
}

// =====================================================================================
// 18. Close
// =====================================================================================
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: 'Results' });
  s.addText('Thank you', { x: 0.7, y: 1.2, w: 12, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: TEXT, margin: 0, isTextBox: true });
  s.addText('Questions?', { x: 0.7, y: 2.4, w: 12, h: 0.8, fontFace: FONT, fontSize: 30, color: ACC, margin: 0, isTextBox: true });
  card(s, 0.7, 3.8, 8.2, 1.7);
  s.addText('Try the live system', { x: 1.0, y: 3.95, w: 7.6, h: 0.4, fontFace: FONT, fontSize: 16, color: MUTED, margin: 0, isTextBox: true });
  s.addText(URL, { x: 1.0, y: 4.4, w: 7.6, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: ACC, margin: 0, isTextBox: true, hyperlink: { url: URL } });
  s.addText('Served from the team laptop via Tailscale Funnel', { x: 1.0, y: 5.0, w: 7.6, h: 0.35, fontFace: FONT, fontSize: 14, color: MUTED, margin: 0, isTextBox: true });
  s.addText('DRISHTI · दृष्टि  —  Vichitra Attri · Vidhyashree S · Vidya Bai K · Vikram K', { x: 0.7, y: 6.6, w: 12, h: 0.4, fontFace: 'Nirmala UI', fontSize: 14, color: MUTED, margin: 0, isTextBox: true });
  s.addNotes('Open the live link on the projector, or fall back to localhost:5055 if the network is down.');
}

pres.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f));
