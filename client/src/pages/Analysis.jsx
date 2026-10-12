import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePoll } from '../api.js'
import { T, chart } from '../tokens.js'
import { Section, SevGlyph, SevTag, fmtShort, n0, n1, n2, sevOf } from '../util.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function SmallMultiples({ rows, conts, prefix, unit, suffix, color }) {
  const max = useMemo(() => Math.max(1, ...rows.flatMap((r) => conts.map((c) => r[`${prefix}_${c}`] || 0))), [rows, conts, prefix])
  return (
    <div className="small-multiples">
      {conts.map((c) => {
        const vals = rows.map((r) => r[`${prefix}_${c}`]).filter((v) => v != null)
        const last = vals[vals.length - 1]
        const peak = Math.max(...vals)
        return (
          <div key={c}>
            <div className="sm-h">
              <b>{c}</b>
              <span>now {n1(last)}{suffix} · peak {n1(peak)}{suffix}</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={rows} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
                <CartesianGrid vertical={false} {...chart.grid} />
                <XAxis dataKey="t" tick={chart.tick} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={60} stroke={T.ink} tickLine={false} height={20} />
                <YAxis domain={[0, Math.ceil(max)]} tick={chart.tick} width={40} stroke="none" tickCount={3} tickFormatter={(v) => Math.round(v)} />
                <Tooltip {...chart.tooltip} labelFormatter={(t) => fmtShort(t, unit)} formatter={(v) => [`${v}${suffix}`, c]} />
                <Area type="monotone" dataKey={`${prefix}_${c}`} stroke={color} strokeWidth={1.6} fill={color} fillOpacity={0.14} connectNulls isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}

export default function Analysis({ onSelect }) {
  const [unit, setUnit] = useState('day')
  const [metric, setMetric] = useState('rain')
  const trend = usePoll(`/trends?unit=${unit}`, 15000).data
  const regions = usePoll('/regions', 10000).data
  const ev = usePoll('/events/stats', 0).data
  const stations = usePoll('/stations', 10000).data
  const anomalies = (stations?.stations || []).filter((s) => s.anomaly).sort((a, b) => b.score - a.score).slice(0, 12)
  const peakMonth = ev ? ev.byMonth.reduce((a, b) => (b.events > a.events ? b : a)).month : null

  return (
    <>
      <Section
        n="01"
        title="Trends by continent"
        meta={trend ? `aggregated in ${n0(trend.ms)} ms · rainfall_records + river_levels` : ''}
      >
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Metric">
            {[['rain', 'Rainfall'], ['fill', 'River fill']].map(([k, l]) => (
              <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{l}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Granularity">
            {[['hour', 'Hourly, 72 h'], ['day', 'Daily, 45 d'], ['month', 'Monthly, 12 mo']].map(([u, l]) => (
              <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>{l}</button>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {metric === 'rain' ? `Mean rainfall per gauge (mm per ${unit}).` : 'Mean river level as % of danger level.'} All panels share one scale.
          </span>
        </div>
        {trend ? (
          <SmallMultiples
            rows={trend.series}
            conts={trend.continents}
            prefix={metric}
            unit={unit}
            suffix={metric === 'rain' ? ' mm' : '%'}
            color={metric === 'rain' ? T.water : T.ink}
          />
        ) : <div className="empty">Aggregating…</div>}
      </Section>

      <div className="cols c-2">
        <Section n="02" title="Regional risk ranking" meta={regions ? `${n1(regions.ms)} ms · $group on risk_snapshots` : ''}>
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th /><th>Country</th><th className="num">Gauges</th><th>Peak score</th><th className="num">Crit</th><th className="num">High</th><th className="num">Anom</th></tr></thead>
              <tbody>
                {(regions?.regions || []).map((r) => {
                  const sev = sevOf(r.maxScore)
                  return (
                    <tr key={r.country}>
                      <td style={{ width: 22 }}><SevGlyph s={sev} /></td>
                      <td>{r.country}<div className="sub">{r.continent}</div></td>
                      <td className="num">{r.stations}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div className="scale" style={{ '--c': T.sev[sev], width: 80 }}><i style={{ width: `${r.maxScore}%` }} /></div>
                          <span className="num" style={{ width: 38 }}>{n1(r.maxScore)}</span>
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
        </Section>

        <Section n="03" title="Anomalies now" meta="rain ≥ 3σ · level ≥ 3σ · rise ≥ 0.25 m/h">
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Gauge</th><th>Severity</th><th className="num">Rain mm/h</th><th className="num">Level m</th><th className="num">Rise m/h</th></tr></thead>
              <tbody>
                {anomalies.map((s) => (
                  <tr key={s.id} className="click" onClick={() => onSelect(s.id)}>
                    <td>{s.name}<div className="sub">{s.country}</div></td>
                    <td><SevTag s={s.severity} /></td>
                    <td className="num">{n1(s.rainWin)}</td>
                    <td className="num">{n2(s.level)}</td>
                    <td className="num">{s.riseRate >= 0 ? '+' : ''}{n2(s.riseRate)}</td>
                  </tr>
                ))}
                {!anomalies.length && <tr><td colSpan="5" className="empty">No anomalies at present.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {ev && (
        <>
          <Section n="04" title="Historical record, 2000 – 2026" meta={`$facet · ${n1(ev.ms)} ms · synthetic catalogue`}>
            <div className="figs" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
              {[
                ['Events', n0(ev.totals.events), 'floods, cyclones, slides'],
                ['Lives lost', n0(ev.totals.deaths), 'cumulative'],
                ['People affected', `${Math.round(ev.totals.affected / 1e6)}M`, 'cumulative'],
                ['Damage', `$${Math.round(ev.totals.damageUsdM / 1000)}B`, 'cumulative'],
              ].map(([l, v, s], i) => (
                <div className="fig" key={l} style={{ borderLeft: i ? '1px solid var(--rule)' : 0, paddingLeft: i ? 16 : 0 }}>
                  <div className="label">{l}</div>
                  <div className="v" style={{ fontSize: 30 }}>{v}</div>
                  <div className="s">{s}</div>
                </div>
              ))}
            </div>
            <div className="cols c-2">
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Events per year</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={ev.byYear} margin={{ left: 0, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} {...chart.grid} />
                    <XAxis dataKey="year" tick={chart.tick} stroke={T.ink} tickLine={false} minTickGap={20} />
                    <YAxis tick={chart.tick} width={30} stroke="none" />
                    <Tooltip {...chart.tooltip} cursor={{ fill: T.sunken }} formatter={(v, n) => [n0(v), n]} />
                    <Bar dataKey="events" name="Events" fill={T.water} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Season · events by month <span style={{ textTransform: 'none', letterSpacing: 0 }}>(peak: {peakMonth ? MONTHS[peakMonth - 1] : ''})</span></div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={ev.byMonth.map((m) => ({ ...m, name: MONTHS[m.month - 1] }))} margin={{ left: 0, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} {...chart.grid} />
                    <XAxis dataKey="name" tick={chart.tick} stroke={T.ink} tickLine={false} />
                    <YAxis tick={chart.tick} width={30} stroke="none" />
                    <Tooltip {...chart.tooltip} cursor={{ fill: T.sunken }} />
                    <Bar dataKey="events" name="Events">
                      {ev.byMonth.map((m) => <Cell key={m.month} fill={m.month === peakMonth ? T.ink : T.water} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>

          <div className="cols c-2">
            <Section n="05" title="By hazard type and continent">
              <table className="tbl">
                <thead><tr><th>Hazard</th><th className="num">Events</th><th className="num">Deaths</th><th className="num">Damage $M</th></tr></thead>
                <tbody>{ev.byType.map((t) => <tr key={t.type}><td>{t.type}</td><td className="num">{n0(t.events)}</td><td className="num">{n0(t.deaths)}</td><td className="num">{n0(t.damageUsdM)}</td></tr>)}</tbody>
              </table>
              <table className="tbl" style={{ marginTop: 20 }}>
                <thead><tr><th>Continent</th><th className="num">Events</th><th className="num">Deaths</th><th className="num">Damage $M</th></tr></thead>
                <tbody>{ev.byContinent.map((t) => <tr key={t.continent}><td>{t.continent}</td><td className="num">{n0(t.events)}</td><td className="num">{n0(t.deaths)}</td><td className="num">{n0(t.damageUsdM)}</td></tr>)}</tbody>
              </table>
            </Section>
            <Section n="06" title="Deadliest recorded events">
              <table className="tbl">
                <thead><tr><th>Event</th><th>Country</th><th className="num">Deaths</th><th className="num">Affected</th></tr></thead>
                <tbody>
                  {ev.deadliest.map((d, i) => (
                    <tr key={i}><td>{d.title}</td><td className="muted">{d.country}</td><td className="num">{n0(d.deaths)}</td><td className="num">{(d.affected / 1e6).toFixed(1)}M</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        </>
      )}
    </>
  )
}
