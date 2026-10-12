import { useMemo, useState } from 'react'
import { usePoll } from '../api.js'
import RiskMap, { MapLegend } from '../components/RiskMap.jsx'
import { SEV_ORDER, SevGlyph, n1 } from '../util.jsx'

export default function MapPage({ selectedId, onSelect }) {
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
  const top = shown.reduce((a, b) => (b.score > (a?.score ?? -1) ? b : a), null)
  const toggle = (s) => {
    const n = new Set(sev)
    n.has(s) ? n.delete(s) : n.add(s)
    setSev(n)
  }

  return (
    <>
      <div className="toolbar" style={{ borderBottom: '1px solid var(--rule)' }}>
        <input type="text" placeholder="Search gauge or country" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} aria-label="Search" />
        <select value={continent} onChange={(e) => setContinent(e.target.value)} aria-label="Continent">
          <option value="">All continents</option>
          {continents.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Severity filter">
          {SEV_ORDER.map((s) => (
            <button key={s} className={sev.has(s) ? 'on' : ''} onClick={() => toggle(s)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <SevGlyph s={s} size={13} />{s[0] + s.slice(1).toLowerCase()}
              </span>
            </button>
          ))}
        </div>
        <span className="muted mono" style={{ fontSize: 12 }}>{shown.length} / {all.length} gauges</span>
        <span style={{ flex: 1 }} />
        {[['stations', 'Gauges'], ['zones', 'Risk zones'], ['heat', 'Heat surface']].map(([k, l]) => (
          <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} style={{ accentColor: 'var(--ink)' }} />{l}
          </label>
        ))}
      </div>
      <div className="map-frame">
        <RiskMap stations={shown} zones={zones} selectedId={selectedId} onSelect={onSelect} height="calc(100vh - 250px)" layers={layers} />
        <MapLegend extra={top && <span className="mono">Highest in view: {top.name} {n1(top.score)}</span>} />
      </div>
    </>
  )
}
