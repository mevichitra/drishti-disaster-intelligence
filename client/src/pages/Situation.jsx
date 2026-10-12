import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, usePoll } from '../api.js'
import RiskMap, { MapLegend } from '../components/RiskMap.jsx'
import { T, chart } from '../tokens.js'
import { SEV_COLOR, SEV_ORDER, SevGlyph, Section, compact, fmtShort, n0, n1 } from '../util.jsx'

function Lede({ ov, stations }) {
  if (!ov || !stations.length) return <p className="lede">&nbsp;</p>
  const n = stations.length
  const { CRITICAL: c, HIGH: h } = ov.severity
  const worst = [...stations].sort((a, b) => b.score - a.score)[0]
  const head =
    c > 0 ? (
      <>
        <b className="c">{c}</b> of {n} gauges are at critical level and <b>{h}</b> at high.
      </>
    ) : (
      <>
        No gauge is critical; <b>{h}</b> of {n} are at high.
      </>
    )
  return (
    <p className="lede">
      {head} The most severe reading is at <b>{worst.name}</b>, {worst.country}: river at {Math.round(worst.levelPct * 100)}% of danger level, risk score {n1(worst.score)}.
    </p>
  )
}

export default function Situation({ selectedId, onSelect }) {
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
  const ranked = [...stations].sort((a, b) => b.score - a.score)
  const cities = [...new Set(stations.map((s) => s.city))].sort()

  const trigger = async () => {
    if (!city) return
    const r = await api(`/simulate/${encodeURIComponent(city)}`, { method: 'POST' })
    setMsg(`Storm cell started over ${city}: ${Math.round(r.dur)} h, peak ${r.peak.toFixed(0)} mm/h.`)
    setTimeout(() => setMsg(''), 7000)
  }

  const fill = (trend?.series || []).map((r) => {
    const v = trend.continents.map((c) => r[`fill_${c}`]).filter((x) => x != null)
    return { t: r.t, fill: v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null }
  })

  return (
    <>
      <div className="ledger">
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Situation · {ov ? new Date(ov.asOf).toISOString().slice(0, 10) : ''}</div>
          <Lede ov={ov} stations={stations} />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>The network · one square per gauge, highest risk first</div>
          <div className="waffle">
            {ranked.map((s) => (
              <button
                key={s.id}
                className={s.severity}
                style={{ '--c': SEV_COLOR[s.severity] }}
                title={`${s.name} — ${s.severity} ${n1(s.score)}`}
                onClick={() => onSelect(s.id)}
                aria-label={`${s.name}, ${s.severity}, score ${n1(s.score)}`}
              />
            ))}
          </div>
          <div className="waffle-key">
            {SEV_ORDER.map((s) => (
              <span key={s}><SevGlyph s={s} /> {s[0] + s.slice(1).toLowerCase()} <b>{ov?.severity[s] ?? '–'}</b></span>
            ))}
          </div>
        </div>
      </div>

      <div className="figs" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {[
          ['Gauges', ov?.stations, `${ov?.countries ?? '–'} countries`],
          ['Active alerts', ov?.activeAlerts, 'raised and unresolved'],
          ['Anomalies', ov?.anomalies, 'outside own baseline'],
          ['Rain, 24 h mean', ov ? `${n0(ov.avgRain24h)} mm` : '–', `max ${n0(ov?.maxRain24h)} mm`],
          ['Records', ov ? compact(ov.records.total) : '–', 'sensor documents'],
          ['On disk', ov ? `${n0(ov.dataMb)} MB` : '–', 'MongoDB data size'],
        ].map(([l, v, s], i) => (
          <div className="fig" key={l} style={{ borderLeft: i ? '1px solid var(--rule)' : 0, paddingLeft: i ? 16 : 0 }}>
            <div className="label">{l}</div>
            <div className="v" style={{ fontSize: 30 }}>{v ?? '–'}</div>
            <div className="s">{s}</div>
          </div>
        ))}
      </div>

      <Section n="01" title="Risk map and alert register" meta={ov ? `${al?.alerts.length ?? 0} active alerts` : ''}>
        <div className="cols c-main">
          <div className="map-frame">
            <RiskMap stations={stations} zones={zones} selectedId={selectedId} onSelect={onSelect} height={620} layers={layers} />
            <div className="map-panel tr">
              {[['stations', 'Gauges'], ['zones', 'Risk zones'], ['heat', 'Heat surface']].map(([k, l]) => (
                <label key={k}><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <MapLegend />
          </div>

          <div>
            <div className="register">
              {al?.alerts.length === 0 && <div className="empty">No active alerts.</div>}
              {al?.alerts.map((a) => (
                <button key={a._id} className="reg-row" onClick={() => onSelect(a.stationId)}>
                  <SevGlyph s={a.severity} size={16} />
                  <div>
                    <div className="nm">{a.stationName}</div>
                    <div className="why">{a.country} · {a.reasons?.join(' · ')}</div>
                  </div>
                  <div>
                    <div className="sc">{n1(a.score)}</div>
                    <div className="st">{a.severity}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>Demo · inject a storm cell</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={city} onChange={(e) => setCity(e.target.value)} style={{ flex: 1 }} aria-label="City">
                  <option value="">Choose a city…</option>
                  {cities.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button className="btn" onClick={trigger} disabled={!city}>Trigger</button>
              </div>
              {msg && <p className="footnote" style={{ border: 0, paddingTop: 6 }}>{msg}</p>}
            </div>
          </div>
        </div>
      </Section>

      <div className="cols c-3">
        <Section n="02" title="Highest risk" meta="top 8 gauges">
          <table className="tbl">
            <thead><tr><th /><th>Gauge</th><th className="num">Level</th><th className="num">Score</th></tr></thead>
            <tbody>
              {ranked.slice(0, 8).map((s) => (
                <tr key={s.id} className="click" onClick={() => onSelect(s.id)}>
                  <td style={{ width: 22 }}><SevGlyph s={s.severity} /></td>
                  <td>{s.name}<div className="sub">{s.country}</div></td>
                  <td className="num">{Math.round(s.levelPct * 100)}%</td>
                  <td className="num"><b>{n1(s.score)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n="03" title="Rainfall, last 24 h" meta="mm per gauge · top countries">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lb?.rows || []} layout="vertical" margin={{ left: 0, right: 30 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} {...chart.grid} />
              <XAxis type="number" tick={chart.tick} stroke="none" />
              <YAxis type="category" dataKey="country" tick={{ ...chart.tick, fill: T.ink }} width={92} stroke={T.ink} tickLine={false} />
              <Tooltip {...chart.tooltip} cursor={{ fill: T.sunken }} formatter={(v) => [`${v} mm`, '24 h mean']} />
              <Bar dataKey="total24h" fill={T.water} label={{ position: 'right', fill: T.ink, fontSize: 11, fontFamily: T.font.mono }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section n="04" title="River fill, last 72 h" meta="mean % of danger level">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={fill} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} {...chart.grid} />
              <XAxis dataKey="t" tick={chart.tick} tickFormatter={(t) => fmtShort(t, 'hour').slice(0, 6)} minTickGap={50} stroke={T.ink} tickLine={false} />
              <YAxis tick={chart.tick} width={40} stroke="none" tickFormatter={(v) => `${v}%`} />
              <Tooltip {...chart.tooltip} labelFormatter={(t) => fmtShort(t, 'hour')} formatter={(v) => [`${v}%`, 'mean fill']} />
              <Area type="monotone" dataKey="fill" stroke={T.ink} strokeWidth={1.6} fill={T.water} fillOpacity={0.22} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      </div>

      <p className="footnote">
        Gauge names and locations are real flood-prone cities; all readings are synthetic, generated for this
        BIS701 project and stored in MongoDB. Risk score = 0.5 · river level + 0.3 · rainfall anomaly + 0.2 · rate of rise
        (see Pipelines).
      </p>
    </>
  )
}
