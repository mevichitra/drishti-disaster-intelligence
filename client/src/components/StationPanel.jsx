import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer, Area, AreaChart, LineChart, Legend,
} from 'recharts'
import { usePoll } from '../api.js'
import { Sev, SEV_COLOR, fmtShort, fmtTime, n0, n1, n2 } from '../util.jsx'

const axis = { stroke: '#5f7399', fontSize: 11 }
const tip = { contentStyle: { background: '#0e1627', border: '1px solid #22314f', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#8da0c2' } }

export default function StationPanel({ id, onClose }) {
  const [hours, setHours] = useState(72)
  const [view, setView] = useState('hydro')
  const { data, error } = usePoll(`/stations/${id}?hours=${hours}`, 6000)

  const merged = useMemo(() => {
    if (!data) return []
    const m = new Map()
    for (const r of data.river) m.set(+new Date(r.ts), { t: +new Date(r.ts), level: r.levelM, rise: r.riseRate, discharge: r.dischargeCms })
    for (const r of data.rain) {
      const o = m.get(+new Date(r.ts)) || { t: +new Date(r.ts) }
      o.rain = r.rainfallMm
      m.set(+new Date(r.ts), o)
    }
    for (const r of data.weather) {
      const o = m.get(+new Date(r.ts)) || { t: +new Date(r.ts) }
      Object.assign(o, { temp: r.tempC, hum: r.humidityPct, wind: r.windKph, pres: r.pressureHpa })
      m.set(+new Date(r.ts), o)
    }
    return [...m.values()].sort((a, b) => a.t - b.t)
  }, [data])

  if (error) return <aside className="drawer"><button className="x" onClick={onClose}>×</button><p>Failed to load: {error.message}</p></aside>
  if (!data) return <aside className="drawer"><div className="empty">Loading station…</div></aside>

  const { station: st, current: c, baseline: b, zone, nearEvents, alert } = data
  const unit = hours > 200 ? 'day' : 'hour'
  const color = SEV_COLOR[c?.severity || 'NORMAL']

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <div className="muted" style={{ fontSize: 12 }}>{st._id} · {st.river} · {st.country}</div>
          <h2 style={{ fontSize: 22, marginTop: 2 }}>{st.name}</h2>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Sev s={c?.severity || 'NORMAL'} />
            {c?.anomaly && <span className="chip">ANOMALY</span>}
            {zone && <span className="chip">{zone.classification} risk zone</span>}
          </div>
        </div>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
      </div>

      {c && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="muted">Composite risk score</span>
            <b style={{ fontFamily: 'var(--mono)', fontSize: 26, color }}>{n1(c.score)}<span className="muted" style={{ fontSize: 13 }}> / 100</span></b>
          </div>
          <div className="gauge"><i style={{ left: `${Math.min(100, c.score)}%` }} /></div>
          <ul className="reasons">
            <li>River at <b>{Math.round(c.levelPct * 100)}%</b> of danger level ({n2(c.level)} m; warning {n2(st.warningLevelM)} m, danger {n2(st.dangerLevelM)} m)</li>
            <li>Rising <b>{n2(c.riseRate)}</b> m/h over the last 6 h</li>
            <li>Rainfall <b>{n1(c.rainWin)}</b> mm/h — <b>{n1(c.zRain)}σ</b> vs. historical normal · 24 h total <b>{n0(c.rain24h)}</b> mm</li>
          </ul>
        </div>
      )}

      <div className="stat-row">
        <div className="stat"><div className="l">River level</div><div className="v">{n2(c?.level)}<span className="u"> m</span></div></div>
        <div className="stat"><div className="l">Discharge</div><div className="v">{n0(c?.discharge)}<span className="u"> m³/s</span></div></div>
        <div className="stat"><div className="l">Level z-score</div><div className="v">{n1(c?.zLevel)}<span className="u"> σ</span></div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}>
        <div className="seg">
          <button className={view === 'hydro' ? 'on' : ''} onClick={() => setView('hydro')}>Hydrograph</button>
          <button className={view === 'weather' ? 'on' : ''} onClick={() => setView('weather')}>Weather</button>
          <button className={view === 'rise' ? 'on' : ''} onClick={() => setView('rise')}>Rate of rise</button>
        </div>
        <div className="seg">
          {[24, 72, 168, 336].map((h) => (
            <button key={h} className={hours === h ? 'on' : ''} onClick={() => setHours(h)}>{h < 48 ? `${h}h` : `${h / 24}d`}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '14px 8px 6px' }}>
        <ResponsiveContainer width="100%" height={260}>
          {view === 'hydro' ? (
            <ComposedChart data={merged} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid stroke="#1a2742" vertical={false} />
              <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={40} />
              <YAxis yAxisId="l" {...axis} width={38} domain={['auto', 'auto']} unit="m" />
              <YAxis yAxisId="r" orientation="right" {...axis} width={36} reversed unit="mm" />
              <Tooltip {...tip} labelFormatter={(t) => fmtTime(t)} formatter={(v, n) => [n === 'Rainfall' ? `${v} mm/h` : `${v} m`, n]} />
              <Bar yAxisId="r" dataKey="rain" name="Rainfall" fill="#3cc8ff" opacity={0.6} />
              <Line yAxisId="l" type="monotone" dataKey="level" name="River level" stroke="#fff" dot={false} strokeWidth={2} />
              <ReferenceLine yAxisId="l" y={st.warningLevelM} stroke="#ffd23f" strokeDasharray="5 4" label={{ value: 'Warning', fill: '#ffd23f', fontSize: 10, position: 'insideTopLeft' }} />
              <ReferenceLine yAxisId="l" y={st.dangerLevelM} stroke="#ff3b5c" strokeDasharray="5 4" label={{ value: 'Danger', fill: '#ff3b5c', fontSize: 10, position: 'insideTopLeft' }} />
            </ComposedChart>
          ) : view === 'weather' ? (
            <LineChart data={merged} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid stroke="#1a2742" vertical={false} />
              <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={40} />
              <YAxis yAxisId="a" {...axis} width={34} />
              <YAxis yAxisId="b" orientation="right" {...axis} width={44} domain={['auto', 'auto']} />
              <Tooltip {...tip} labelFormatter={(t) => fmtTime(t)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="a" dataKey="temp" name="Temp °C" stroke="#ffb347" dot={false} />
              <Line yAxisId="a" dataKey="hum" name="Humidity %" stroke="#3cc8ff" dot={false} />
              <Line yAxisId="a" dataKey="wind" name="Wind km/h" stroke="#b18cff" dot={false} />
              <Line yAxisId="b" dataKey="pres" name="Pressure hPa" stroke="#4be3a1" dot={false} />
            </LineChart>
          ) : (
            <AreaChart data={merged} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid stroke="#1a2742" vertical={false} />
              <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={40} />
              <YAxis {...axis} width={40} unit="m/h" />
              <Tooltip {...tip} labelFormatter={(t) => fmtTime(t)} formatter={(v) => [`${v} m/h`, 'Rise rate']} />
              <ReferenceLine y={0.25} stroke="#ff8a3d" strokeDasharray="4 4" label={{ value: 'anomaly threshold', fill: '#ff8a3d', fontSize: 10, position: 'insideTopLeft' }} />
              <Area dataKey="rise" stroke="#ff8a3d" fill="#ff8a3d" fillOpacity={0.25} />
            </AreaChart>
          )}
        </ResponsiveContainer>
        {view === 'rise' && <div className="muted" style={{ fontSize: 11.5, padding: '0 8px 6px' }}>Computed in MongoDB with <span className="chip">$setWindowFields</span> + <span className="chip">$derivative</span> over a 3-hour sliding window.</div>}
      </div>

      <div className="grid g-2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Normal range (baseline)</h3>
          {b ? (
            <table className="t">
              <tbody>
                <tr><td>Rainfall mean / σ</td><td className="num">{n2(b.rain?.mean)} / {n2(b.rain?.std)} mm/h</td></tr>
                <tr><td>Rainfall p95 / p99</td><td className="num">{n1(b.rain?.p95)} / {n1(b.rain?.p99)} mm/h</td></tr>
                <tr><td>River mean / σ</td><td className="num">{n2(b.river?.mean)} / {n2(b.river?.std)} m</td></tr>
                <tr><td>River p95 / max</td><td className="num">{n2(b.river?.p95)} / {n2(b.river?.max)} m</td></tr>
              </tbody>
            </table>
          ) : <div className="muted">n/a</div>}
        </div>
        <div className="card">
          <h3>Site</h3>
          <table className="t">
            <tbody>
              <tr><td>Coordinates</td><td className="num">{st.location.coordinates[1].toFixed(3)}, {st.location.coordinates[0].toFixed(3)}</td></tr>
              <tr><td>Elevation</td><td className="num">{st.elevationM} m</td></tr>
              <tr><td>Sensors</td><td className="num" style={{ fontSize: 11 }}>{st.sensors.join(', ')}</td></tr>
              <tr><td>Installed</td><td className="num">{st.installedYear}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {alert && (
        <div className="card" style={{ marginTop: 14, borderColor: color }}>
          <h3>Active alert</h3>
          <div style={{ fontSize: 13 }}>Since {fmtTime(alert.triggeredAt)} · peak score {n1(alert.peakScore)} ({alert.peakSeverity})</div>
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Historical events within 250 km <span className="hint">$geoNear on 2dsphere</span></h3>
        {nearEvents.length ? (
          <table className="t">
            <thead><tr><th>Event</th><th>Date</th><th className="num">Deaths</th><th className="num">km</th></tr></thead>
            <tbody>
              {nearEvents.map((e, i) => (
                <tr key={i}><td>{e.title}</td><td>{new Date(e.date).getUTCFullYear()}</td><td className="num">{n0(e.deaths)}</td><td className="num">{e.distKm}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <div className="muted">No recorded events nearby.</div>}
      </div>
    </aside>
  )
}
