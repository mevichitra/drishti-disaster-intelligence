import { useState } from 'react'
import { api, usePoll } from '../api.js'
import { SevTag, fmtTime, n0, n1, StaffGauge } from '../util.jsx'

export default function Reports() {
  const { data: list, reload } = usePoll('/reports', 0)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      setReport(await api('/reports', { method: 'POST' }))
      reload()
    } finally {
      setBusy(false)
    }
  }
  const current = report || list?.reports?.[0]

  return (
    <>
      <div className="toolbar no-print" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="label">Situation reports</div>
          <div className="muted" style={{ marginTop: 2 }}>Built from the latest aggregation results and stored in the <span className="chip">reports</span> collection.</div>
        </div>
        {list?.reports?.length > 0 && (
          <select onChange={(e) => setReport(list.reports.find((r) => r._id === e.target.value))} value={current?._id || ''} aria-label="Report">
            {list.reports.map((r) => <option key={r._id} value={r._id}>{fmtTime(r.generatedAt)}</option>)}
          </select>
        )}
        <button className="btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate report'}</button>
        {current && <button className="btn sec" onClick={() => window.print()}>Print / save PDF</button>}
      </div>

      {!current && <div className="empty">No reports yet. Generate one.</div>}
      {current && (
        <article className="report">
          <div className="rh">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <StaffGauge size={38} />
              <div>
                <div className="label" style={{ color: '#444' }}>DRISHTI · Situation report</div>
                <h2>{current.title.replace('DRISHTI ', '')}</h2>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 12, textAlign: 'right' }}>
              Data as of<br /><b>{fmtTime(current.asOf)}</b>
            </div>
          </div>

          <p style={{ fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1.45, margin: '18px 0 0' }}>{current.summary}</p>

          <h4>Severity</h4>
          <div style={{ display: 'flex', gap: 36 }}>
            {['CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL'].map((s) => (
              <div key={s}>
                <SevTag s={s} />
                <div className="mono" style={{ fontSize: 30, fontWeight: 500, marginTop: 2 }}>{current.severity[s]}</div>
              </div>
            ))}
          </div>

          <h4>Highest-risk gauges</h4>
          <table>
            <thead><tr><th>Gauge</th><th>Country</th><th>Severity</th><th>Score</th><th>Level</th><th>% danger</th><th>Rain 24 h</th></tr></thead>
            <tbody>
              {current.topStations.map((s) => (
                <tr key={s.id}><td><b>{s.name}</b></td><td>{s.country}</td><td><SevTag s={s.severity} /></td><td className="mono">{n1(s.score)}</td><td className="mono">{s.level} m</td><td className="mono">{Math.round(s.levelPct * 100)}%</td><td className="mono">{n0(s.rain24h)} mm</td></tr>
              ))}
            </tbody>
          </table>

          <h4>Regions of concern</h4>
          <table>
            <thead><tr><th>Country</th><th>Continent</th><th>Peak</th><th>Mean</th><th>Critical</th><th>High</th></tr></thead>
            <tbody>
              {current.topRegions.map((r) => (
                <tr key={r.country}><td><b>{r.country}</b></td><td>{r.continent}</td><td className="mono">{n1(r.maxScore)}</td><td className="mono">{n1(r.avgScore)}</td><td className="mono">{r.critical}</td><td className="mono">{r.high}</td></tr>
              ))}
            </tbody>
          </table>

          <h4>Recommended actions</h4>
          <ol style={{ lineHeight: 1.65, paddingLeft: 20, margin: 0 }}>{current.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>

          <p style={{ marginTop: 26, fontSize: 11, color: '#555', borderTop: '1px solid #bbb', paddingTop: 8 }}>
            Generated {fmtTime(current.generatedAt)}. Source: simulated sensor network stored in MongoDB. Academic demonstration, not for operational use.
          </p>
        </article>
      )}
    </>
  )
}
