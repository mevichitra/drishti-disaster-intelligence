import { useEffect, useState } from 'react'
import { usePoll } from './api.js'
import { fmtTime } from './util.jsx'
import CommandCenter from './pages/CommandCenter.jsx'
import RiskMapPage from './pages/RiskMapPage.jsx'
import Analytics from './pages/Analytics.jsx'
import Reports from './pages/Reports.jsx'
import Lab from './pages/Lab.jsx'
import StationPanel from './components/StationPanel.jsx'

const TABS = [
  ['command', 'Command Centre'],
  ['map', 'Risk Map'],
  ['analytics', 'Analytics'],
  ['reports', 'Reports'],
  ['lab', 'Pipeline Lab'],
]

function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0b1220" stroke="#22314f" />
      <path d="M6 32c8-14 18-20 26-20s18 6 26 20c-8 14-18 20-26 20S14 46 6 32z" fill="none" stroke="#3cc8ff" strokeWidth="4" />
      <circle cx="32" cy="32" r="9" fill="#ff3b5c" />
      <circle cx="32" cy="32" r="3.5" fill="#0b1220" />
    </svg>
  )
}

export default function App() {
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'command')
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get('station'))
  const ov = usePoll('/overview', 6000).data

  useEffect(() => {
    location.hash = tab
  }, [tab])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <div className="brand-name">DRISHTI<small>दृष्टि</small></div>
            <div className="brand-full">Disaster Risk Intelligence &amp; Situational Hazard Tracking Interface</div>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <span className="spacer" />
        <div className="clock">
          <div><span className={`live-dot ${ov?.live ? '' : 'off'}`} />{ov?.live ? 'LIVE SIMULATED FEED' : 'FEED PAUSED'}</div>
          <b>{ov ? fmtTime(ov.asOf) : '…'}</b>
        </div>
      </header>

      <main className="main">
        {tab === 'command' && <CommandCenter selectedId={selected} onSelect={setSelected} />}
        {tab === 'map' && <RiskMapPage selectedId={selected} onSelect={setSelected} />}
        {tab === 'analytics' && <Analytics onSelect={setSelected} />}
        {tab === 'reports' && <Reports />}
        {tab === 'lab' && <Lab />}
      </main>

      {selected && <StationPanel key={selected} id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
