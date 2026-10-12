import { useMemo, useState } from 'react'
import { usePoll } from '../api.js'
import RiskMap from '../components/RiskMap.jsx'
import { SEV_COLOR, SEV_ORDER, n1 } from '../util.jsx'

export default function RiskMapPage({ selectedId, onSelect }) {
  const st = usePoll('/stations', 6000).data
  const zones = usePoll('/zones', 6000).data
  const [layers, setLayers] = useState({ stations: true, zones: true, heat: true })
  const [sev, setSev] = useState(new Set(SEV_ORDER))
  const [continent, setContinent] = useState('')
  const [q, setQ] = useState('')

  const all = st?.stations || []
  const continents = [...new Set(all.map((s) => s.continent))].sort()
  const shown = useMemo(
    () => all.filter((s) => sev.has(s.severity) && (!continent || s.continent === continent) && (!q || (s.name + s.country).toLowerCase().includes(q.toLowerCase()))),
    [all, sev, continent, q],
  )
  const toggle = (s) => {
    const n = new Set(sev)
    n.has(s) ? n.delete(s) : n.add(s)
    setSev(n)
  }

  return (
    <>
      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: 12 }}>
        <input
          placeholder="Search gauge or country…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', minWidth: 240 }}
        />
        <select value={continent} onChange={(e) => setContinent(e.target.value)}>
          <option value="">All continents</option>
          {continents.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="seg">
          {SEV_ORDER.map((s) => (
            <button key={s} className={sev.has(s) ? 'on' : ''} onClick={() => toggle(s)} style={sev.has(s) ? { background: SEV_COLOR[s], borderColor: SEV_COLOR[s], color: s === 'CRITICAL' ? '#fff' : '#08101c' } : undefined}>{s}</button>
          ))}
        </div>
        <span className="muted">{shown.length} of {all.length} gauges</span>
        <span className="spacer" />
        {['stations', 'zones', 'heat'].map((k) => (
          <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />
            {{ stations: 'Gauges', zones: 'Risk zones', heat: 'Heatmap' }[k]}
          </label>
        ))}
      </div>
      <div className="map-wrap">
        <RiskMap stations={shown} zones={zones} selectedId={selectedId} onSelect={onSelect} height="calc(100vh - 230px)" layers={layers} />
        <div className="map-legend">
          <span>Marker size = risk score</span>
          {SEV_ORDER.map((s) => <span key={s}><i style={{ background: SEV_COLOR[s] }} />{s}</span>)}
          {shown[0] && <span>Top: {shown.slice().sort((a, b) => b.score - a.score)[0].name} ({n1(shown.slice().sort((a, b) => b.score - a.score)[0].score)})</span>}
        </div>
      </div>
    </>
  )
}
