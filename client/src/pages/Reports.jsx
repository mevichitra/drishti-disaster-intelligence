import { useState } from 'react'
import { api, usePoll } from '../api.js'
import { Sev, fmtTime, n0, n1 } from '../util.jsx'

export default function Reports() {
  const { data: list, reload } = usePoll('/reports', 0)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const r = await api('/reports', { method: 'POST' })
      setReport(r)
      reload()
    } finally {
      setBusy(false)
    }
  }
  const current = report || list?.reports?.[0]

  return (
    <>
      <div className="card no-print" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ margin: 0 }}>Situation reports</h3>
          <div className="muted" style={{ marginTop: 4 }}>Generate a decision-support summary from the latest MongoDB aggregation results. Reports are stored in the <span className="chip">reports</span> collection.</div>
        </div>
        {list?.reports?.length > 0 && (
          <select onChange={(e) => setReport(list.reports.find((r) => r._id === e.target.value))} value={current?._id || ''}>
            {list.reports.map((r) => <option key={r._id} value={r._id}>{fmtTime(r.generatedAt)}</option>)}
          </select>
        )}
        <button className="btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate new report'}</button>
        {current && <button className="btn ghost" onClick={() => window.print()}>Print / Save PDF</button>}
      </div>

      {!current && <div className="empty">No reports yet — click “Generate new report”.</div>}
      {current && (
        <article className="report">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#3a4a68', fontWeight: 700 }}>DRISHTI · DISASTER RISK INTELLIGENCE &amp; SITUATIONAL HAZARD TRACKING INTERFACE</div>
              <h2>{current.title}</h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#3a4a68' }}>Data as of<br /><b>{fmtTime(current.asOf)}</b></div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>{current.summary}</p>

          <h4>Severity distribution</h4>
          <div style={{ display: 'flex', gap: 22 }}>
            {['CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL'].map((s) => (
              <div key={s}><Sev s={s} /><div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{current.severity[s]}</div></div>
            ))}
          </div>

          <h4>Highest-risk gauges</h4>
          <table>
            <thead><tr><th>Gauge</th><th>Country</th><th>Severity</th><th>Score</th><th>River level</th><th>% of danger</th><th>24 h rain</th></tr></thead>
            <tbody>
              {current.topStations.map((s) => (
                <tr key={s.id}><td><b>{s.name}</b></td><td>{s.country}</td><td><Sev s={s.severity} /></td><td>{n1(s.score)}</td><td>{s.level} m</td><td>{Math.round(s.levelPct * 100)}%</td><td>{n0(s.rain24h)} mm</td></tr>
              ))}
            </tbody>
          </table>

          <h4>Regions of concern</h4>
          <table>
            <thead><tr><th>Country</th><th>Continent</th><th>Peak score</th><th>Mean score</th><th>Critical</th><th>High</th></tr></thead>
            <tbody>
              {current.topRegions.map((r) => (
                <tr key={r.country}><td><b>{r.country}</b></td><td>{r.continent}</td><td>{n1(r.maxScore)}</td><td>{n1(r.avgScore)}</td><td>{r.critical}</td><td>{r.high}</td></tr>
              ))}
            </tbody>
          </table>

          <h4>Recommended actions</h4>
          <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>{current.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>

          <div style={{ marginTop: 26, fontSize: 11, color: '#6b7a96', borderTop: '1px solid #e1e7f2', paddingTop: 8 }}>
            Generated {fmtTime(current.generatedAt)}. Data source: simulated sensor network stored in MongoDB (academic demonstration — not for operational use).
          </div>
        </article>
      )}
    </>
  )
}
