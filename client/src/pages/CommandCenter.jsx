import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { api, usePoll } from '../api.js'
import RiskMap from '../components/RiskMap.jsx'
import { Kpi, Sev, SEV_COLOR, compact, fmtTime, n0, n1 } from '../util.jsx'

const axis = { stroke: '#5f7399', fontSize: 11 }
const tip = { contentStyle: { background: '#0e1627', border: '1px solid #22314f', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#8da0c2' } }

export default function CommandCenter({ selectedId, onSelect }) {
  const ov = usePoll('/overview', 6000).data
  const st = usePoll('/stations', 6000).data
  const zones = usePoll('/zones', 6000).data
  const al = usePoll('/alerts?limit=40', 6000).data
  const lb = usePoll('/leaderboard', 12000).data
  const trend = usePoll('/trends?unit=hour', 12000).data
  const [layers, setLayers] = useState({ stations: true, zones: true, heat: false })
  const [city, setCity] = useState('')
  const [msg, setMsg] = useState('')

  const stations = st?.stations || []
  const worst = [...stations].sort((a, b) => b.score - a.score).slice(0, 8)
  const cities = [...new Set(stations.map((s) => s.city))].sort()

  const trigger = async () => {
    if (!city) return
    const r = await api(`/simulate/${encodeURIComponent(city)}`, { method: 'POST' })
    setMsg(`Storm cell started over ${city}: ${Math.round(r.dur)} h, peak ${r.peak.toFixed(0)} mm/h`)
    setTimeout(() => setMsg(''), 7000)
  }

  const trendRows = (trend?.series || []).map((r) => {
    const rain = trend.continents.map((c) => r[`rain_${c}`]).filter((v) => v != null)
    const fill = trend.continents.map((c) => r[`fill_${c}`]).filter((v) => v != null)
    return {
      t: r.t,
      rain: rain.length ? +(rain.reduce((a, b) => a + b, 0) / rain.length).toFixed(2) : 0,
      fill: fill.length ? +(fill.reduce((a, b) => a + b, 0) / fill.length).toFixed(1) : 0,
    }
  })

  return (
    <>
      <div className="grid g-kpi">
        <Kpi label="Critical gauges" value={ov?.severity.CRITICAL ?? '–'} sub="risk score ≥ 70" color={SEV_COLOR.CRITICAL} />
        <Kpi label="High risk" value={ov?.severity.HIGH ?? '–'} sub="risk score 50–70" color={SEV_COLOR.HIGH} />
        <Kpi label="Elevated" value={ov?.severity.ELEVATED ?? '–'} sub="risk score 30–50" color={SEV_COLOR.ELEVATED} />
        <Kpi label="Anomalies" value={ov?.anomalies ?? '–'} sub="statistical outliers vs. baseline" color="#b18cff" />
        <Kpi label="Monitoring network" value={ov?.stations ?? '–'} sub={`${ov?.countries ?? '–'} countries · 6 continents`} color="#3cc8ff" />
        <Kpi label="Sensor records" value={ov ? compact(ov.records.total) : '–'} sub={ov ? `${n0(ov.records.total)} docs · ${n0(ov.dataMb)} MB` : ''} color="#4be3a1" />
      </div>

      <div className="grid g-main">
        <div className="map-wrap">
          <RiskMap stations={stations} zones={zones} selectedId={selectedId} onSelect={onSelect} height={600} layers={layers} />
          <div className="map-controls">
            <label><input type="checkbox" checked={layers.stations} onChange={(e) => setLayers({ ...layers, stations: e.target.checked })} /> Gauges</label>
            <label><input type="checkbox" checked={layers.zones} onChange={(e) => setLayers({ ...layers, zones: e.target.checked })} /> Risk zones</label>
            <label><input type="checkbox" checked={layers.heat} onChange={(e) => setLayers({ ...layers, heat: e.target.checked })} /> Heatmap</label>
          </div>
          <div className="map-legend">
            {['CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL'].map((s) => (
              <span key={s}><i style={{ background: SEV_COLOR[s] }} />{s}</span>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>
            Live alerts <span className="hint">{al ? `${al.alerts.length} active` : ''}</span>
          </h3>
          <div className="alert-list">
            {al?.alerts.length === 0 && <div className="empty">No active alerts</div>}
            {al?.alerts.map((a) => (
              <button key={a._id} className="alert-item" style={{ '--c': SEV_COLOR[a.severity] }} onClick={() => onSelect(a.stationId)}>
                <div className="t">
                  <span>{a.stationName}</span>
                  <span className="s" style={{ color: SEV_COLOR[a.severity] }}>{n1(a.score)}</span>
                </div>
                <div className="m">
                  <Sev s={a.severity} /> {a.country} · since {fmtTime(a.triggeredAt).slice(5)}
                  <br />
                  {a.reasons?.join(' · ')}
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Demo control — inject a storm cell into the simulated network</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={city} onChange={(e) => setCity(e.target.value)} style={{ flex: 1 }}>
                <option value="">Choose a city…</option>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="btn sm" onClick={trigger} disabled={!city}>Trigger</button>
            </div>
            {msg && <div style={{ color: 'var(--accent)', fontSize: 12, marginTop: 6 }}>{msg}</div>}
          </div>
        </div>
      </div>

      <div className="grid g-3">
        <div className="card">
          <h3>Highest-risk gauges</h3>
          <table className="t">
            <thead><tr><th>Gauge</th><th>Country</th><th className="num">Score</th></tr></thead>
            <tbody>
              {worst.map((s) => (
                <tr key={s.id} className="click" onClick={() => onSelect(s.id)}>
                  <td>{s.name}</td>
                  <td className="muted">{s.country}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div className="bar" style={{ '--c': SEV_COLOR[s.severity], width: 70 }}><i style={{ width: `${s.score}%` }} /></div>
                      <span className="num" style={{ width: 38 }}>{n1(s.score)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Rainfall in last 24 h <span className="hint">avg mm per gauge, top countries</span></h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={lb?.rows || []} layout="vertical" margin={{ left: 18, right: 14 }}>
              <CartesianGrid stroke="#1a2742" horizontal={false} />
              <XAxis type="number" {...axis} />
              <YAxis type="category" dataKey="country" {...axis} width={90} />
              <Tooltip {...tip} cursor={{ fill: '#16223a' }} formatter={(v) => [`${v} mm`, '24 h avg']} />
              <Bar dataKey="total24h" radius={[0, 5, 5, 0]}>
                {(lb?.rows || []).map((_, i) => <Cell key={i} fill={i < 3 ? '#3cc8ff' : '#2a5d86'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Global river fill, last 72 h <span className="hint">% of danger level</span></h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trendRows} margin={{ left: 0, right: 8 }}>
              <defs>
                <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff8a3d" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff8a3d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a2742" vertical={false} />
              <XAxis dataKey="t" {...axis} tickFormatter={(t) => new Date(t).toISOString().slice(5, 13).replace('T', ' ') + 'h'} minTickGap={50} />
              <YAxis {...axis} width={34} unit="%" />
              <Tooltip {...tip} labelFormatter={(t) => fmtTime(t)} formatter={(v) => [`${v}%`, 'avg fill']} />
              <Area type="monotone" dataKey="fill" stroke="#ff8a3d" strokeWidth={2} fill="url(#gf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
