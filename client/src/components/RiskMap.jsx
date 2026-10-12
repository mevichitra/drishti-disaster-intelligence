import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, GeoJSON, Tooltip, useMap } from 'react-leaflet'
import L from './leafletGlobal.js'
import 'leaflet.heat'
import { T } from '../tokens.js'
import { SEV_ORDER, SevGlyph, glyphSvg, n1, n2 } from '../util.jsx'

function HeatLayer({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const layer = L.heatLayer(points, {
      radius: 34,
      blur: 26,
      minOpacity: 0.2,
      maxZoom: 6,
      gradient: { 0.25: '#F1E3B3', 0.5: T.sev.ELEVATED, 0.75: T.sev.HIGH, 1.0: T.sev.CRITICAL },
    }).addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, points])
  return null
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 6), { duration: 0.8 })
  }, [target?.lat, target?.lng, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const iconCache = new Map()
function icon(sev, score, selected) {
  const size = Math.round(13 + (score / 100) * 11) + (selected ? 4 : 0)
  const key = `${sev}-${size}-${selected}`
  if (!iconCache.has(key)) {
    const ring = selected ? `<span style="position:absolute;inset:-5px;border:2px solid ${T.ink};border-radius:50%"></span>` : ''
    iconCache.set(
      key,
      L.divIcon({
        className: 'glyph-icon',
        html: `<span style="position:relative;display:block;width:${size}px;height:${size}px">${ring}${glyphSvg(sev, size)}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    )
  }
  return iconCache.get(key)
}

export function MapLegend({ extra }) {
  return (
    <div className="map-panel bl">
      {[...SEV_ORDER].reverse().map((s) => (
        <span key={s} className="key">
          <SevGlyph s={s} size={14} />
          {s[0] + s.slice(1).toLowerCase()}
        </span>
      ))}
      <span className="muted">Symbol size = risk score</span>
      {extra}
    </div>
  )
}

export default function RiskMap({ stations = [], zones, selectedId, onSelect, height = 560, layers, focus }) {
  const on = layers || { stations: true, zones: true, heat: false }
  const heatPts = useMemo(() => stations.map((s) => [s.lat, s.lng, Math.min(1, (s.score / 100) ** 1.2 * 1.1)]), [stations])
  const zoneKey = useMemo(
    () => (zones ? zones.features.map((f) => f.properties.severity[0] + Math.round(f.properties.maxScore / 5)).join('') : ''),
    [zones],
  )
  const sel = stations.find((s) => s.id === selectedId)
  const flyTarget = focus || (sel ? { lat: sel.lat, lng: sel.lng } : null)
  const sorted = useMemo(() => [...stations].sort((a, b) => a.score - b.score), [stations]) // worst drawn last (on top)

  return (
    <MapContainer center={[24, 20]} zoom={2} minZoom={2} worldCopyJump style={{ height, width: '100%' }}>
      <TileLayer
        attribution="Tiles © Esri — Esri, DeLorme, NAVTEQ"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
      />
      {on.zones && zones && (
        <GeoJSON
          key={zoneKey}
          data={zones}
          style={(f) => {
            const sev = f.properties.severity
            return {
              color: sev === 'NORMAL' ? T.ink3 : T.sev[sev],
              weight: sev === 'NORMAL' ? 0.8 : 1.6,
              dashArray: '4 3',
              fillColor: T.sev[sev],
              fillOpacity: sev === 'NORMAL' ? 0.04 : sev === 'ELEVATED' ? 0.14 : 0.22,
            }
          }}
          onEachFeature={(f, layer) =>
            layer.bindTooltip(
              `<div class="tt"><b>${f.properties.name}</b><div class="m">${f.properties.classification} flood-risk zone · pop. ${f.properties.populationM}M</div><div class="m">worst gauge ${f.properties.maxScore} · ${f.properties.severity}</div></div>`,
              { sticky: true },
            )
          }
        />
      )}
      {on.heat && <HeatLayer points={heatPts} />}
      {on.stations &&
        sorted.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={icon(s.severity, s.score, s.id === selectedId)} eventHandlers={{ click: () => onSelect?.(s.id) }}>
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="tt">
                <b>{s.name}</b>
                <div className="m">{s.country} · {s.river}</div>
                <div className="m">{s.severity} · score {n1(s.score)}</div>
                <div className="m">level {n2(s.level)} m · rain {n1(s.rainWin)} mm/h</div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      <FlyTo target={flyTarget} />
    </MapContainer>
  )
}
