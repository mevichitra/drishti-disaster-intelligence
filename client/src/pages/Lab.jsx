import { useState } from 'react'
import { api, usePoll } from '../api.js'
import { Section, n0 } from '../util.jsx'

function Pipeline({ p, i }) {
  const [res, setRes] = useState(null)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      setRes(await api(`/lab/${p.id}/run`, { method: 'POST' }))
    } finally {
      setBusy(false)
    }
  }
  const stages = p.pipeline.map((s) => Object.keys(s)[0])
  return (
    <div style={{ borderTop: '1px solid var(--ink)', padding: '14px 0 22px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>{p.title}</h3>
        <span className="chip" style={{ marginLeft: 'auto' }}>{p.collection}</span>
      </div>
      <p className="muted" style={{ margin: '4px 0 10px 30px' }}>{p.blurb}</p>
      <div className="mono" style={{ margin: '0 0 12px 30px', fontSize: 12.5 }}>{stages.join('  →  ')}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 30 }}>
        <button className="btn sm" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run on live data'}</button>
        <button className="btn sm sec" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} pipeline JSON</button>
        {res && <span className="mono" style={{ fontSize: 12.5 }}>{res.ms} ms · {n0(res.count)} documents out</span>}
      </div>
      {show && <pre className="code" style={{ margin: '10px 0 0 30px' }}>{JSON.stringify(p.pipeline, null, 2)}</pre>}
      {res?.sample.length > 0 && <pre className="code" style={{ margin: '10px 0 0 30px', maxHeight: 220 }}>{JSON.stringify(res.sample, null, 2)}</pre>}
    </div>
  )
}

export default function Lab() {
  const { data } = usePoll('/lab', 0)
  return (
    <Section n="01" title="Aggregation pipelines" meta="every figure in DRISHTI comes from one of these">
      <p style={{ maxWidth: '46em', marginBottom: 16, color: 'var(--ink2)' }}>
        The numbers on the other pages are produced inside MongoDB by the pipelines below, running directly on the stored sensor records.
        Run any of them against the live database and inspect the stages.
      </p>
      {data?.pipelines.map((p, i) => <Pipeline key={p.id} p={p} i={i} />)}
    </Section>
  )
}
