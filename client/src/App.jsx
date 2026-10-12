import { useEffect, useState } from 'react'
import { usePoll } from './api.js'
import { StaffGauge, fmtTime } from './util.jsx'
import Situation from './pages/Situation.jsx'
import MapPage from './pages/MapPage.jsx'
import Analysis from './pages/Analysis.jsx'
import Reports from './pages/Reports.jsx'
import Lab from './pages/Lab.jsx'
import StationPanel from './components/StationPanel.jsx'

const TABS = [
  ['situation', 'Situation'],
  ['map', 'Map'],
  ['analysis', 'Analysis'],
  ['reports', 'Reports'],
  ['pipelines', 'Pipelines'],
]

export default function App() {
  const [tab, setTab] = useState(() => {
    const h = location.hash.slice(1)
    return TABS.some(([k]) => k === h) ? h : 'situation'
  })
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get('station'))
  const ov = usePoll('/overview', 6000).data

  useEffect(() => {
    location.hash = tab
  }, [tab])

  return (
    <>
      <header className="mast">
        <div className="mast-in">
          <div className="brand">
            <StaffGauge />
            <div>
              <div className="wordmark">
                DRISHTI<span className="deva">दृष्टि</span>
              </div>
              <div className="fullform">Disaster Risk Intelligence &amp; Situational Hazard Tracking Interface</div>
            </div>
          </div>
          <nav className="nav" aria-label="Sections">
            {TABS.map(([k, l], i) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                {l}
              </button>
            ))}
          </nav>
          <div className="asof">
            <span className="stamp">Simulated data</span>
            <span className="t">
              <span className={`live ${ov?.live ? '' : 'off'}`} title={ov?.live ? 'Live feed running' : 'Feed paused while idle'} />
              {ov ? fmtTime(ov.asOf) : '…'}
            </span>
          </div>
        </div>
      </header>

      <main className="page">
        {tab === 'situation' && <Situation onSelect={setSelected} selectedId={selected} />}
        {tab === 'map' && <MapPage selectedId={selected} onSelect={setSelected} />}
        {tab === 'analysis' && <Analysis onSelect={setSelected} />}
        {tab === 'reports' && <Reports />}
        {tab === 'pipelines' && <Lab />}
      </main>

      {selected && (
        <>
          <div className="scrim" onClick={() => setSelected(null)} />
          <StationPanel key={selected} id={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </>
  )
}
