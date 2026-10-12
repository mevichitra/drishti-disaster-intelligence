import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, Area,
} from 'recharts'
import { usePoll } from '../api.js'
import { CONT_COLOR, Kpi, Sev, SEV_COLOR, fmtShort, n0, n1, n2 } from '../util.jsx'

const axis = { stroke: '#5f7399', fontSize: 11 }
const tip = { contentStyle: { background: '#0e1627', border: '1px solid #22314f', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#8da0c2' } }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Analytics({ onSelect }) {
  const [unit, setUnit] = useState('day')
  const trend = usePoll(`/trends?unit=${unit}`, 15000).data
  const regions = usePoll('/regions', 10000).data
  const ev = usePoll('/events/stats', 0).data
  const stations = usePoll('/stations', 10000).data
  const anomalies = (stations?.stations || []).filter((s) => s.anomaly).sort((a, b) => b.score - a.score).slice(0, 12)

  const rain = trend?.series || []
  const conts = trend?.continents || []

  return (
    <>
      <div className="card">
        <h3>
          <span>Rainfall &amp; river-level trends by continent</span>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {trend && <span className="hint">aggregated in {n0(trend.ms)} ms over millions of records</span>}
            <span className="seg">
              {[['hour', 'Hourly · 72 h'], ['day', 'Daily · 45 d'], ['month', 'Monthly · 12 mo']].map(([u, l]) => (
                <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>{l}</button>
              ))}
            </span>
          </span>
        </h3>
        <div className="grid g-2">
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Average rainfall per gauge (mm per {unit})</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rain} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke="#1a2742" vertical={false} />
                <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={36} />
                <YAxis {...axis} width={40} />
                <Tooltip {...tip} labelFormatter={(t) => fmtShort(t, unit)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {conts.map((c) => (
                  <Line key={c} type="monotone" dataKey={`rain_${c}`} name={c} stroke={CONT_COLOR[c]} dot={false} strokeWidth={1.8} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Average river level as % of danger level</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rain} margin={{ left: 0, right: 10 }}>
                <CartesianGrid stroke="#1a2742" vertical={false} />
                <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={36} />
                <YAxis {...axis} width={40} unit="%" />
                <Tooltip {...tip} labelFormatter={(t) => fmtShort(t, unit)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {conts.map((c) => (
                  <Line key={c} type="monotone" dataKey={`fill_${c}`} name={c} stroke={CONT_COLOR[c]} dot={false} strokeWidth={1.8} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid g-2">
        <div className="card">
          <h3>Regional risk ranking <span className="hint">{regions ? `${n1(regions.ms)} ms · $group on risk_snapshots` : ''}</span></h3>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="t">
              <thead><tr><th>Country</th><th>Continent</th><th className="num">Gauges</th><th>Peak risk</th><th className="num">Crit</th><th className="num">High</th><th className="num">Anom</th></tr></thead>
              <tbody>
                {(regions?.regions || []).map((r) => {
                  const sev = r.maxScore >= 70 ? 'CRITICAL' : r.maxScore >= 50 ? 'HIGH' : r.maxScore >= 30 ? 'ELEVATED' : 'NORMAL'
                  return (
                    <tr key={r.country}>
                      <td><b>{r.country}</b></td>
                      <td className="muted">{r.continent}</td>
                      <td className="num">{r.stations}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="bar" style={{ '--c': SEV_COLOR[sev] }}><i style={{ width: `${r.maxScore}%` }} /></div>
                          <span className="num" style={{ width: 40 }}>{n1(r.maxScore)}</span>
                        </div>
                      </td>
                      <td className="num">{r.critical || ''}</td>
                      <td className="num">{r.high || ''}</td>
                      <td className="num">{r.anomalies || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Active anomalies <span className="hint">z ≥ 3σ or rise ≥ 0.25 m/h</span></h3>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="t">
              <thead><tr><th>Gauge</th><th>Severity</th><th className="num">Rain mm/h</th><th className="num">Level m</th><th className="num">Rise m/h</th></tr></thead>
              <tbody>
                {anomalies.map((s) => (
                  <tr key={s.id} className="click" onClick={() => onSelect(s.id)}>
                    <td>{s.name}<div className="muted" style={{ fontSize: 11 }}>{s.country}</div></td>
                    <td><Sev s={s.severity} /></td>
                    <td className="num">{n1(s.rainWin)}</td>
                    <td className="num">{n2(s.level)}</td>
                    <td className="num">{n2(s.riseRate)}</td>
                  </tr>
                ))}
                {!anomalies.length && <tr><td colSpan="5" className="empty">No anomalies right now</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {ev && (
        <>
          <div className="grid g-kpi">
            <Kpi label="Historical events" value={n0(ev.totals.events)} sub="2000 – 2026 (synthetic)" color="#3cc8ff" />
            <Kpi label="Lives lost" value={n0(ev.totals.deaths)} sub="cumulative" color="#ff3b5c" />
            <Kpi label="People affected" value={`${(ev.totals.affected / 1e6).toFixed(0)} M`} sub="cumulative" color="#ff8a3d" />
            <Kpi label="Damage" value={`$${(ev.totals.damageUsdM / 1000).toFixed(0)} B`} sub="cumulative" color="#ffd23f" />
          </div>

          <div className="grid g-2">
            <div className="card">
              <h3>Disaster events per year <span className="hint">$facet · {n1(ev.ms)} ms</span></h3>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={ev.byYear} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke="#1a2742" vertical={false} />
                  <XAxis dataKey="year" {...axis} />
                  <YAxis yAxisId="l" {...axis} width={34} />
                  <YAxis yAxisId="r" orientation="right" {...axis} width={44} />
                  <Tooltip {...tip} />
                  <Bar yAxisId="l" dataKey="events" name="Events" fill="#3cc8ff" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="deaths" name="Deaths" stroke="#ff3b5c" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Seasonality — events by month</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ev.byMonth.map((m) => ({ ...m, name: MONTHS[m.month - 1] }))} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke="#1a2742" vertical={false} />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} width={34} />
                  <Tooltip {...tip} cursor={{ fill: '#16223a' }} />
                  <Bar dataKey="events" fill="#b18cff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid g-2">
            <div className="card">
              <h3>By hazard type &amp; continent</h3>
              <table className="t">
                <thead><tr><th>Type</th><th className="num">Events</th><th className="num">Deaths</th><th className="num">Damage $M</th></tr></thead>
                <tbody>
                  {ev.byType.map((t) => <tr key={t.type}><td>{t.type}</td><td className="num">{n0(t.events)}</td><td className="num">{n0(t.deaths)}</td><td className="num">{n0(t.damageUsdM)}</td></tr>)}
                </tbody>
              </table>
              <table className="t" style={{ marginTop: 12 }}>
                <thead><tr><th>Continent</th><th className="num">Events</th><th className="num">Deaths</th><th className="num">Damage $M</th></tr></thead>
                <tbody>
                  {ev.byContinent.map((t) => <tr key={t.continent}><td><span style={{ color: CONT_COLOR[t.continent] }}>●</span> {t.continent}</td><td className="num">{n0(t.events)}</td><td className="num">{n0(t.deaths)}</td><td className="num">{n0(t.damageUsdM)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Deadliest recorded events</h3>
              <table className="t">
                <thead><tr><th>Event</th><th>Country</th><th className="num">Deaths</th><th className="num">Affected</th></tr></thead>
                <tbody>
                  {ev.deadliest.map((d, i) => (
                    <tr key={i}><td>{d.title}</td><td className="muted">{d.country}</td><td className="num">{n0(d.deaths)}</td><td className="num">{(d.affected / 1e6).toFixed(1)} M</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
