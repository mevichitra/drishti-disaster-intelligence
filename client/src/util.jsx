import { T } from './tokens.js'

export const SEV_COLOR = T.sev
export const SEV_ORDER = ['CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL']
export const SEV_LABEL = { CRITICAL: 'Critical', HIGH: 'High', ELEVATED: 'Elevated', NORMAL: 'Normal' }
export const sevOf = (score) => (score >= 70 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'ELEVATED' : 'NORMAL')

export const n0 = (x) => (x == null ? '–' : Math.round(x).toLocaleString('en-US'))
export const n1 = (x) => (x == null ? '–' : Number(x).toFixed(1))
export const n2 = (x) => (x == null ? '–' : Number(x).toFixed(2))
export const compact = (x) =>
  x == null ? '–' : x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}K` : String(x)

export function fmtTime(t) {
  if (!t) return '–'
  return new Date(t).toISOString().replace('T', ' ').slice(0, 16) + 'Z'
}
export function fmtShort(t, unit = 'hour') {
  const d = new Date(t)
  if (unit === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  if (unit === 'day') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })
}

// Severity glyph: shape carries the level as well as colour (DESIGN.md "Severity glyphs").
export function glyphSvg(sev, size = 14) {
  const c = T.sev[sev]
  const ink = T.ink
  const body = {
    NORMAL: `<circle cx="10" cy="10" r="5.2" fill="${T.paper}" stroke="${c}" stroke-width="2"/>`,
    ELEVATED: `<circle cx="10" cy="10" r="5.6" fill="${c}" stroke="${ink}" stroke-width="0.8"/>`,
    HIGH: `<polygon points="10,3.6 16.4,15.4 3.6,15.4" fill="${c}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>`,
    CRITICAL: `<circle cx="10" cy="10" r="8.4" fill="${T.paper}" stroke="${ink}" stroke-width="1.4"/><polygon points="10,3.8 16,10 10,16.2 4,10" fill="${c}" stroke="${ink}" stroke-width="0.8"/>`,
  }[sev]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`
}

export function SevGlyph({ s, size = 14 }) {
  return <span style={{ display: 'inline-flex', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: glyphSvg(s, size) }} />
}

export function SevTag({ s }) {
  return (
    <span className="sevtag">
      <SevGlyph s={s} size={14} />
      {s}
    </span>
  )
}

export function Section({ n, title, meta, children }) {
  return (
    <section>
      <div className="sec-h">
        <span className="n">{n}</span>
        <h2>{title}</h2>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

export function StaffGauge({ size = 34 }) {
  // the mark: a staff gauge with a waterline and an upper-limit tick
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" fill={T.ink} />
      <rect x="9" y="7" width="10" height="26" fill="none" stroke={T.paper} strokeWidth="1.6" />
      <rect x="9" y="19" width="10" height="14" fill={T.paper} />
      {[11, 15, 19, 23, 27, 31].map((y, i) => (
        <line key={y} x1="19" x2={i % 2 ? 23 : 26} y1={y} y2={y} stroke={T.paper} strokeWidth="1.4" />
      ))}
      <path d="M4 19 H36" stroke={T.sev.HIGH} strokeWidth="2.4" />
      <path d="M32 9 L36 13 H28 Z" fill={T.sev.CRITICAL} />
    </svg>
  )
}
