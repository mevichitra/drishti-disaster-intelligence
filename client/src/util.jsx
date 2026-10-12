export const SEV_COLOR = { CRITICAL: '#ff3b5c', HIGH: '#ff8a3d', ELEVATED: '#ffd23f', NORMAL: '#3ddc97' }
export const SEV_ORDER = ['CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL']
export const CONT_COLOR = {
  Asia: '#3cc8ff',
  Europe: '#b18cff',
  Africa: '#ffb347',
  'North America': '#4be3a1',
  'South America': '#ff6f91',
  Oceania: '#f4e04d',
}

export const n0 = (x) => (x == null ? '–' : Math.round(x).toLocaleString('en-US'))
export const compact = (x) =>
  x == null ? '–' : x >= 1e6 ? `${(x / 1e6).toFixed(2)} M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)} K` : String(x)
export const n1 = (x) => (x == null ? '–' : Number(x).toFixed(1))
export const n2 = (x) => (x == null ? '–' : Number(x).toFixed(2))

export function fmtTime(t) {
  if (!t) return '–'
  const d = new Date(t)
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}
export function fmtShort(t, unit = 'hour') {
  const d = new Date(t)
  if (unit === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  if (unit === 'day') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })
}

export function Sev({ s }) {
  return <span className={`sev ${s}`}>{s}</span>
}

export function Kpi({ label, value, sub, color }) {
  return (
    <div className="card kpi" style={{ '--c': color }}>
      <div className="label">{label}</div>
      <div className="value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}
