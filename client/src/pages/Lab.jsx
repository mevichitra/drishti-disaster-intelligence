import { useState } from 'react'
import { api, usePoll } from '../api.js'
import { n0 } from '../util.jsx'

function Card({ p }) {
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
  return (
    <div className="card">
      <h3>
        <span>{p.title}</span>
        <span className="chip">{p.collection}</span>
      </h3>
      <div className="muted" style={{ marginBottom: 10 }}>{p.blurb}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn sm" onClick={run} disabled={busy}>{busy ? 'Running…' : '▶ Run on live data'}</button>
        <button className="btn ghost sm" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} pipeline</button>
        {res && <span style={{ fontFamily: 'var(--mono)', color: 'var(--norm)' }}>{res.ms} ms · {n0(res.count)} docs out</span>}
      </div>
      {show && <pre className="code" style={{ marginTop: 10 }}>{JSON.stringify(p.pipeline, null, 2)}</pre>}
      {res && res.sample.length > 0 && (
        <pre className="code" style={{ marginTop: 10, maxHeight: 220 }}>{JSON.stringify(res.sample, null, 2)}</pre>
      )}
    </div>
  )
}

export default function Lab() {
  const { data } = usePoll('/lab', 0)
  return (
    <>
      <div className="card">
        <h3 style={{ margin: 0 }}>Pipeline Lab — MongoDB aggregation under the hood</h3>
        <div className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
          Every number on this dashboard is produced by a MongoDB aggregation pipeline running directly on the stored
          sensor records. Run any pipeline below against the live database and inspect the exact stages used.
        </div>
      </div>
      <div className="grid g-2">{data?.pipelines.map((p) => <Card key={p.id} p={p} />)}</div>
    </>
  )
}
