import { useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { usePoll } from '../api.js'
import { T, chart } from '../tokens.js'
import { SevTag, fmtShort, fmtTime, n0, n1, n2 } from '../util.jsx'

export default function StationPanel({ id, onClose }) {
  const [hours, setHours] = useState(72)
  const [view, setView] = useState('hydro')
  const { data, error } = usePoll(`/stations/${id}?hours=${hours}`, 6000)

  const merged = useMemo(() => {
    if (!data) return []
    const m = new Map()
    const row = (ts) => {
      const k = +new Date(ts)
      if (!m.has(k)) m.set(k, { t: k })
      return m.get(k)
    }
    for (const r of data.river) Object.assign(row(r.ts), { level: r.levelM, rise: r.riseRate })
    for (const r of data.rain) row(r.ts).rain = r.rainfallMm
    for (const r of data.weather) Object.assign(row(r.ts), { temp: r.tempC, hum: r.humidityPct, wind: r.windKph, pres: r.pressureHpa })
    return [...m.values()].sort((a, b) => a.t - b.t)
  }, [data])

  const shell = (children) => <aside className="sheet" aria-label="Gauge sheet">{children}</aside>
  if (error) return shell(<><button className="x" onClick={onClose}>×</button><p className="empty">Could not load this gauge ({error.message}).</p></>)
  if (!data) return shell(<p className="empty">Loading gauge…</p>)

  const { station: st, current: c, baseline: b, zone, nearEvents, alert } = data
  const unit = hours > 200 ? 'day' : 'hour'
  const xAxis = <XAxis dataKey="t" tick={chart.tick} tickFormatter={(t) => fmtShort(t, unit)} minTickGap={48} stroke={T.ink} tickLine={false} />

  return shell(
    <>
      <div className="sheet-h">
        <div>
          <div className="mono muted" style={{ fontSize: 12 }}>{st._id} · {st.river} · {st.country}</div>
          <h2>{st.name}</h2>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SevTag s={c?.severity || 'NORMAL'} />
            {c?.anomaly && <span className="chip">ANOMALY</span>}
            {zone && <span className="chip">{zone.classification} risk zone</span>}
          </div>
        </div>
        <button className="x" onClick={onClose} aria-label="Close gauge sheet">×</button>
      </div>

      {c && (
        <>
          <div className="bigscore">
            <span className="v">{n1(c.score)}</span>
            <span className="muted">composite risk score, 0 – 100</span>
          </div>
          <div className="bandscale"><i /><i /><i /><i /><u style={{ left: `${Math.min(99.5, c.score)}%` }} /></div>
          <div className="bandticks"><span>0</span><span>30</span><span>50</span><span>70 – 100</span></div>

          <dl className="facts">
            <div><dt>River level</dt><dd>{n2(c.level)} m · {Math.round(c.levelPct * 100)}% of danger ({n2(st.dangerLevelM)} m)</dd></div>
            <div><dt>Rate of rise (6 h)</dt><dd>{c.riseRate >= 0 ? '+' : ''}{n2(c.riseRate)} m/h</dd></div>
            <div><dt>Rainfall now</dt><dd>{n1(c.rainWin)} mm/h · {n1(c.zRain)}σ vs normal</dd></div>
            <div><dt>Rainfall, 24 h</dt><dd>{n0(c.rain24h)} mm</dd></div>
            <div><dt>Discharge</dt><dd>{n0(c.discharge)} m³/s</dd></div>
            <div><dt>Level z-score</dt><dd>{n1(c.zLevel)}σ</dd></div>
          </dl>
        </>
      )}

      <div className="block">
        <h3>
          <span>Readings</span>
          <small>{fmtTime(data.asOf)}</small>
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <div className="seg">
            {[['hydro', 'Hydrograph'], ['weather', 'Weather'], ['rise', 'Rate of rise']].map(([k, l]) => (
              <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
          <div className="seg">
            {[24, 72, 168, 336].map((h) => (
              <button key={h} className={hours === h ? 'on' : ''} onClick={() => setHours(h)}>{h < 48 ? `${h} h` : `${h / 24} d`}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          {view === 'hydro' ? (
            <ComposedChart data={merged} margin={{ left: 0, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} {...chart.grid} />
              {xAxis}
              <YAxis yAxisId="l" tick={chart.tick} width={40} domain={['auto', 'auto']} stroke="none" tickFormatter={(v) => `${v} m`} />
              <YAxis yAxisId="r" orientation="right" reversed tick={chart.tick} width={40} stroke="none" tickFormatter={(v) => `${v}`} />
              <Tooltip {...chart.tooltip} labelFormatter={fmtTime} formatter={(v, n) => [n === 'Rainfall' ? `${v} mm/h` : `${v} m`, n]} />
              <Bar yAxisId="r" dataKey="rain" name="Rainfall" fill={T.waterTint} stroke={T.water} strokeWidth={0.5} />
              <Line yAxisId="l" type="monotone" dataKey="level" name="River level" stroke={T.ink} strokeWidth={2} dot={false} />
              <ReferenceLine yAxisId="l" y={st.warningLevelM} stroke={T.sev.ELEVATED} strokeWidth={1.5} label={{ value: `Warning ${n2(st.warningLevelM)}`, fill: T.ink2, fontSize: 11, position: 'insideBottomLeft', fontFamily: T.font.mono }} />
              <ReferenceLine yAxisId="l" y={st.dangerLevelM} stroke={T.sev.CRITICAL} strokeWidth={1.5} label={{ value: `Danger ${n2(st.dangerLevelM)}`, fill: T.sev.CRITICAL, fontSize: 11, position: 'insideTopLeft', fontFamily: T.font.mono }} />
            </ComposedChart>
          ) : view === 'weather' ? (
            <LineChart data={merged} margin={{ left: 0, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} {...chart.grid} />
              {xAxis}
              <YAxis yAxisId="a" tick={chart.tick} width={36} stroke="none" />
              <YAxis yAxisId="b" orientation="right" tick={chart.tick} width={44} domain={['auto', 'auto']} stroke="none" />
              <Tooltip {...chart.tooltip} labelFormatter={fmtTime} />
              <Line yAxisId="a" dataKey="temp" name="Temp °C" stroke={T.ink} dot={false} strokeWidth={1.6} />
              <Line yAxisId="a" dataKey="hum" name="Humidity %" stroke={T.water} dot={false} strokeWidth={1.6} />
              <Line yAxisId="a" dataKey="wind" name="Wind km/h" stroke={T.ink3} dot={false} strokeWidth={1.6} strokeDasharray="4 3" />
              <Line yAxisId="b" dataKey="pres" name="Pressure hPa" stroke={T.sev.ELEVATED} dot={false} strokeWidth={1.6} />
            </LineChart>
          ) : (
            <AreaChart data={merged} margin={{ left: 0, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} {...chart.grid} />
              {xAxis}
              <YAxis tick={chart.tick} width={44} stroke="none" tickFormatter={(v) => `${v}`} />
              <Tooltip {...chart.tooltip} labelFormatter={fmtTime} formatter={(v) => [`${v} m/h`, 'Rise rate']} />
              <ReferenceLine y={0.25} stroke={T.sev.HIGH} strokeWidth={1.5} label={{ value: 'anomaly threshold 0.25', fill: T.ink2, fontSize: 11, position: 'insideTopLeft', fontFamily: T.font.mono }} />
              <Area dataKey="rise" stroke={T.ink} strokeWidth={1.6} fill={T.water} fillOpacity={0.2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
        {view === 'rise' && <p className="footnote" style={{ marginTop: 6 }}>MongoDB <span className="chip">$setWindowFields</span> + <span className="chip">$derivative</span> over a 3-hour sliding window.</p>}
        {view === 'hydro' && <p className="footnote" style={{ marginTop: 6 }}>Rainfall bars hang from the top (mm/h, right axis); river level is the line (m, left axis).</p>}
      </div>

      {alert && (
        <div className="block">
          <h3><span>Active alert</span><small>since {fmtTime(alert.triggeredAt)}</small></h3>
          <p>Peak score {n1(alert.peakScore)} ({alert.peakSeverity}). {alert.reasons?.join(' · ')}</p>
        </div>
      )}

      <div className="block">
        <h3><span>Normal range for this gauge</span><small>baseline from history</small></h3>
        {b ? (
          <table className="tbl">
            <thead><tr><th>Measure</th><th className="num">Mean</th><th className="num">σ</th><th className="num">p95</th><th className="num">Max / p99</th></tr></thead>
            <tbody>
              <tr><td>Rainfall mm/h</td><td className="num">{n2(b.rain?.mean)}</td><td className="num">{n2(b.rain?.std)}</td><td className="num">{n1(b.rain?.p95)}</td><td className="num">{n1(b.rain?.p99)}</td></tr>
              <tr><td>River level m</td><td className="num">{n2(b.river?.mean)}</td><td className="num">{n2(b.river?.std)}</td><td className="num">{n2(b.river?.p95)}</td><td className="num">{n2(b.river?.max)}</td></tr>
            </tbody>
          </table>
        ) : <p className="muted">No baseline.</p>}
      </div>

      <div className="block">
        <h3><span>Past events within 250 km</span><small>$geoNear · 2dsphere</small></h3>
        {nearEvents.length ? (
          <table className="tbl">
            <thead><tr><th>Event</th><th className="num">Year</th><th className="num">Deaths</th><th className="num">km</th></tr></thead>
            <tbody>
              {nearEvents.map((e, i) => (
                <tr key={i}><td>{e.title}</td><td className="num">{new Date(e.date).getUTCFullYear()}</td><td className="num">{n0(e.deaths)}</td><td className="num">{e.distKm}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No recorded events nearby.</p>}
      </div>

      <div className="block">
        <h3><span>Site</span></h3>
        <dl className="facts" style={{ marginTop: 0, borderTop: 0 }}>
          <div><dt>Coordinates</dt><dd>{st.location.coordinates[1].toFixed(3)}°, {st.location.coordinates[0].toFixed(3)}°</dd></div>
          <div><dt>Elevation</dt><dd>{st.elevationM} m</dd></div>
          <div><dt>Sensors</dt><dd>{st.sensors.join(', ')}</dd></div>
          <div><dt>Installed</dt><dd>{st.installedYear}</dd></div>
        </dl>
      </div>
    </>,
  )
}
