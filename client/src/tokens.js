// Single source of truth for the DRISHTI design system (see /DESIGN.md).
// Injected as CSS custom properties by applyTokens(); charts and map import the values directly.

export const T = {
  paper: '#F1F3EF',
  surface: '#FAFBF8',
  sunken: '#E6EAE4',
  rule: '#CBD2CA',
  ink: '#15211E',
  ink2: '#43524E',
  ink3: '#6C7A75',
  water: '#0B5C7A',
  waterTint: '#C9DEE6',
  sev: {
    NORMAL: '#5B8A8F',
    ELEVATED: '#C79A1B',
    HIGH: '#D1561F',
    CRITICAL: '#A3102E',
  },
  sevTint: {
    NORMAL: '#DCE7E7',
    ELEVATED: '#F1E3B3',
    HIGH: '#F3CDB9',
    CRITICAL: '#E8BFC6',
  },
  cont: {
    Asia: '#0B5C7A',
    Europe: '#6D5BA8',
    Africa: '#7B8F2A',
    'North America': '#2F8F6B',
    'South America': '#A04F7A',
    Oceania: '#4A5A66',
  },
  font: {
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    serif: "'IBM Plex Serif', Georgia, serif",
    mono: "'IBM Plex Mono', ui-monospace, Consolas, monospace",
    deva: "'Tiro Devanagari Hindi', 'Nirmala UI', serif",
  },
}

export function applyTokens(root = document.documentElement) {
  const set = (k, v) => root.style.setProperty(k, v)
  for (const k of ['paper', 'surface', 'sunken', 'rule', 'ink', 'ink2', 'ink3', 'water']) set(`--${k}`, T[k])
  set('--water-tint', T.waterTint)
  for (const [k, v] of Object.entries(T.sev)) set(`--sev-${k.toLowerCase()}`, v)
  for (const [k, v] of Object.entries(T.sevTint)) set(`--tint-${k.toLowerCase()}`, v)
  set('--sans', T.font.sans)
  set('--serif', T.font.serif)
  set('--mono', T.font.mono)
  set('--deva', T.font.deva)
}

// shared chart styling
export const chart = {
  tick: { fill: T.ink3, fontSize: 11, fontFamily: T.font.mono },
  grid: { stroke: T.rule, strokeDasharray: '0' },
  tooltip: {
    contentStyle: { background: T.surface, border: `1px solid ${T.ink}`, borderRadius: 2, fontSize: 12, fontFamily: T.font.mono, padding: '6px 8px' },
    labelStyle: { color: T.ink3, marginBottom: 2 },
    itemStyle: { color: T.ink, padding: 0 },
    cursor: { stroke: T.ink, strokeWidth: 1 },
  },
}
