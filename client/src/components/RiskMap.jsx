import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, GeoJSON, Tooltip, useMap } from 'react-leaflet'
import L from './leafletGlobal.js'
import 'leaflet.heat'
import { SEV_COLOR, n1, n2 } from '../util.jsx'

function HeatLayer({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const layer = L.heatLayer(points, {
      radius: 38,
      blur: 30,
      minOpacity: 0.25,
      maxZoom: 6,
      gradient: { 0.2: '#1f6feb', 0.4: '#3ddc97', 0.6: '#ffd23f', 0.8: '#ff8a3d', 1.0: '#ff3b5c' },
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
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 6), { duration: 0.9 })
  }, [target?.lat, target?.lng, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function pulseIcon(color) {
  return L.divIcon({
    className: 'pulse-icon',
    html: `<span style="--c:${color}"></span>`,
    iconSize: [0, 0],
  })
}

export default function RiskMap({ stations = [], zones, selectedId, onSelect, height = 520, layers, focus }) {
  const L0 = layers || { stations: true, zones: true, heat: false }
  const heatPts = useMemo(
    () => stations.map((s) => [s.lat, s.lng, Math.min(1, (s.score / 100) ** 1.25 * 1.15)]),
    [stations],
  )
  const zoneKey = useMemo(
    () => (zones ? zones.features.map((f) => f.properties.severity[0] + Math.round(f.properties.maxScore / 5)).join('') : ''),
    [zones],
  )
  const sel = stations.find((s) => s.id === selectedId)
  const flyTarget = focus || (sel ? { lat: sel.lat, lng: sel.lng } : null)

  return (
    <MapContainer center={[22, 25]} zoom={2} minZoom={2} worldCopyJump style={{ height, width: '100%' }}>
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
        opacity={0.8}
      />
      {L0.zones && zones && (
        <GeoJSON
          key={zoneKey}
          data={zones}
          style={(f) => ({
            color: SEV_COLOR[f.properties.severity],
            weight: 1.2,
            fillColor: SEV_COLOR[f.properties.severity],
            fillOpacity: f.properties.severity === 'NORMAL' ? 0.07 : 0.2,
          })}
          onEachFeature={(f, layer) =>
            layer.bindTooltip(
              `<div class="tt"><b>${f.properties.name}</b><div>${f.properties.classification} flood-risk zone · pop. ${f.properties.populationM} M</div><div>Peak score ${f.properties.maxScore} · ${f.properties.severity}</div></div>`,
              { sticky: true },
            )
          }
        />
      )}
      {L0.heat && <HeatLayer points={heatPts} />}
      {L0.stations &&
        stations.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.id === selectedId ? 10 : 4 + s.score / 14}
            pathOptions={{
              color: s.id === selectedId ? '#fff' : SEV_COLOR[s.severity],
              weight: s.id === selectedId ? 3 : 1.5,
              fillColor: SEV_COLOR[s.severity],
              fillOpacity: 0.75,
            }}
            eventHandlers={{ click: () => onSelect?.(s.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div className="tt">
                <b>{s.name}</b>
                <div>{s.country} · {s.river}</div>
                <div>
                  Risk <b style={{ display: 'inline', color: SEV_COLOR[s.severity] }}>{n1(s.score)}</b> · {s.severity}
                </div>
                <div>River {n2(s.level)} m · rain {n1(s.rainWin)} mm/h</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      {L0.stations &&
        stations
          .filter((s) => s.severity === 'CRITICAL' || s.severity === 'HIGH')
          .map((s) => (
            <Marker key={'p' + s.id} position={[s.lat, s.lng]} icon={pulseIcon(SEV_COLOR[s.severity])} interactive={false} />
          ))}
      <FlyTo target={flyTarget} />
    </MapContainer>
  )
}
