import * as turf from '@turf/turf'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { chainSegments, getAbscissaAtPoint } from './useStationing'

const ROAD_LAYER_IDS = ['primaria', 'secundaria', 'terciaria']
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

// Module-level cache to track active Marker instances
const activeMarkers = {}

export function useCoords() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const coordStore = useCoordStore()

  // ─── Generic custom layer renderer ───────────────────────────────────────────
  // Adds or refreshes a GeoJSON source+layers on the map for a single geometry type.
  // geomType: 'point' | 'line' | 'polygon'
  // style: object with paint properties (see DEFAULT_STYLES in layerStore)
  function addCustomMapLayer(layerId, geojson, geomType, style = {}) {
    const map = mapStore.instance
    if (!map) return

    const visible = layerStore.visibility[layerId] !== false ? 'visible' : 'none'

    if (!map.getSource(layerId)) {
      map.addSource(layerId, { type: 'geojson', data: geojson })
    } else {
      map.getSource(layerId).setData(geojson)
    }

    if (geomType === 'point') {
      if (!map.getLayer(layerId + '-circle')) {
        map.addLayer({
          id: layerId + '-circle',
          type: 'circle',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'circle-radius': style.radius ?? 6,
            'circle-color': style.color ?? '#3d5af1',
            'circle-stroke-width': style.strokeWidth ?? 1.5,
            'circle-stroke-color': style.strokeColor ?? '#ffffff'
          }
        })
      }
    } else if (geomType === 'line') {
      if (!map.getLayer(layerId + '-line')) {
        map.addLayer({
          id: layerId + '-line',
          type: 'line',
          source: layerId,
          layout: { 'line-join': 'round', 'line-cap': 'round', visibility: visible },
          paint: {
            'line-color': style.color ?? '#06b6d4',
            'line-width': style.width ?? 3.5,
            'line-opacity': style.opacity ?? 0.85
          }
        })
      }
    } else if (geomType === 'polygon') {
      if (!map.getLayer(layerId + '-fill')) {
        map.addLayer({
          id: layerId + '-fill',
          type: 'fill',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'fill-color': style.fillColor ?? '#06b6d4',
            'fill-opacity': style.fillOpacity ?? 0.15
          }
        })
      }
      if (!map.getLayer(layerId + '-outline')) {
        map.addLayer({
          id: layerId + '-outline',
          type: 'line',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'line-color': style.borderColor ?? '#0891b2',
            'line-width': style.borderWidth ?? 1.5,
            'line-opacity': style.borderOpacity ?? 0.7
          }
        })
      }
    }
  }

  // Called after every style.load
  function initCoordsLayer() {
    // Re-instantiate markers if style reloads (setStyle removes all DOM markers from map container)
    for (const id in activeMarkers) {
      activeMarkers[id].remove()
      delete activeMarkers[id]
    }
    syncLayer()

    // Restore all custom layers from cache
    layerStore.customLayers.forEach(l => {
      const data = layerStore._cache[l.id]
      if (!data) return
      if (l.geomType) {
        addCustomMapLayer(l.id, data, l.geomType, l.style ?? {})
      } else {
        // Legacy GeoJSON layers without geomType
        showGeoJsonOverlay(l.id, data)
      }
    })

    // Legacy: restore old fixed-id KML overlays if still present in coordStore
    if (coordStore.kmlLines?.length > 0 || coordStore.kmlPolygons?.length > 0) {
      showKmlOverlay(coordStore.kmlLines, coordStore.kmlPolygons)
    }
  }

  function syncLayer() {
    const map = mapStore.instance
    if (!map) return

    // Filter points by visibility of their parent layer
    const visiblePoints = coordStore.points.filter(p => {
      if (p.layerId && layerStore.visibility[p.layerId] === false) return false
      return true
    })

    // 1. Remove markers that are no longer in visiblePoints
    const visibleIds = new Set(visiblePoints.map(p => p.id))
    for (const id in activeMarkers) {
      if (!visibleIds.has(id)) {
        activeMarkers[id].remove()
        delete activeMarkers[id]
      }
    }

    // 2. Add or update markers
    for (const p of visiblePoints) {
      if (!activeMarkers[p.id]) {
        const marker = new maplibregl.Marker()
          .setLngLat([p.lng, p.lat])
          .addTo(map)

        const el = marker.getElement()
        const label = document.createElement('div')
        label.className = 'marker-label'
        label.textContent = p.name
        label.style.position = 'absolute'
        label.style.top = '-22px'
        label.style.left = '50%'
        label.style.transform = 'translateX(-50%)'
        label.style.fontSize = '11px'
        label.style.fontWeight = '700'
        label.style.color = '#4c1d95'
        label.style.backgroundColor = 'rgba(255, 255, 255, 0.92)'
        label.style.backdropFilter = 'blur(4px)'
        label.style.padding = '2px 6px'
        label.style.borderRadius = '4px'
        label.style.border = '1px solid #c0c0d8'
        label.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)'
        label.style.whiteSpace = 'nowrap'
        label.style.fontFamily = 'system-ui, sans-serif'
        label.style.pointerEvents = 'none'

        el.appendChild(label)
        activeMarkers[p.id] = marker
      } else {
        activeMarkers[p.id].setLngLat([p.lng, p.lat])
        const el = activeMarkers[p.id].getElement()
        const label = el.querySelector('.marker-label')
        if (label) label.textContent = p.name
      }
    }
  }

  function _findNearestRoad(lng, lat, map) {
    if (!map) return null

    const pixel = map.project([lng, lat])
    const px = pixel.x, py = pixel.y
    const layers = ROAD_LAYER_IDS.filter(id => map.getLayer(id))
    if (!layers.length) return null

    const features = map.queryRenderedFeatures(
      [[px - 20, py - 20], [px + 20, py + 20]],
      { layers }
    )
    if (!features.length) return null

    const bestFeature = features[0]
    const codigo = bestFeature.properties.CODIGO_VIA || ''
    const nombre = bestFeature.properties.NOMBRE_VIA || ''
    const term = (codigo || nombre).toLowerCase()
    const bestLayerId = bestFeature.layer?.id || ''

    if (!term) return null

    const segs = []
    for (const layerId of ROAD_LAYER_IDS) {
      const data = layerStore._cache[layerId]
      if (!data) continue
      for (const f of data.features) {
        const c = (f.properties.CODIGO_VIA || '').toLowerCase()
        const n = (f.properties.NOMBRE_VIA || '').toLowerCase()
        if (c === term || n === term) segs.push(f)
      }
    }

    if (!segs.length) return null

    const chainedCoords = chainSegments(segs)
    if (!chainedCoords) return null
    const abs = getAbscissaAtPoint(lng, lat, chainedCoords)

    return {
      nombre, codigo,
      layerId: bestLayerId,
      abscisa: abs.formatted,
      distFromLine: abs.distFromLine
    }
  }

  function handleMapClick(event) {
    if (!coordStore.addModeActive) return

    const { lng, lat } = event.lngLat
    const map = mapStore.instance
    let nearestRoad = null
    try {
      nearestRoad = map ? _findNearestRoad(lng, lat, map) : null
    } catch (err) {
      console.warn('[useCoords] nearestRoad lookup failed:', err)
    }
    const idx = coordStore.points.length + 1

    coordStore.addPoint({
      id: `${Date.now()}`,
      idx,
      name: `P${idx}`,
      lng: parseFloat(lng.toFixed(6)),
      lat: parseFloat(lat.toFixed(6)),
      nearestRoad
    })

    syncLayer()
  }

  function removePoint(id) {
    coordStore.removePoint(id)
    syncLayer()
  }

  function updatePointName(id, name) {
    coordStore.updateName(id, name)
    syncLayer()
  }

  function flyToPoint(p) {
    const map = mapStore.instance
    if (!map) return
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14) })
  }

  // ─── Legacy KML overlay (fixed source IDs) ─────────────────────────────────
  // Kept for backward compatibility with old saved project files.
  function showKmlOverlay(lines, polygons) {
    const map = mapStore.instance
    if (!map) return

    const visible = layerStore.visibility['custom-kml'] !== false ? 'visible' : 'none'

    if (!map.getSource('kml-lines')) {
      map.addSource('kml-lines', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'kml-lines-layer',
        type: 'line',
        source: 'kml-lines',
        layout: { visibility: visible },
        paint: { 'line-color': '#06b6d4', 'line-width': 3.5, 'line-opacity': 0.85 }
      })
    } else {
      if (map.getLayer('kml-lines-layer')) map.setLayoutProperty('kml-lines-layer', 'visibility', visible)
    }

    if (!map.getSource('kml-polygons')) {
      map.addSource('kml-polygons', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'kml-polygons-fill',
        type: 'fill',
        source: 'kml-polygons',
        layout: { visibility: visible },
        paint: { 'fill-color': '#06b6d4', 'fill-opacity': 0.15 }
      })
      map.addLayer({
        id: 'kml-polygons-outline',
        type: 'line',
        source: 'kml-polygons',
        layout: { visibility: visible },
        paint: { 'line-color': '#06b6d4', 'line-width': 1.5, 'line-opacity': 0.7 }
      })
    } else {
      if (map.getLayer('kml-polygons-fill')) map.setLayoutProperty('kml-polygons-fill', 'visibility', visible)
      if (map.getLayer('kml-polygons-outline')) map.setLayoutProperty('kml-polygons-outline', 'visibility', visible)
    }

    map.getSource('kml-lines').setData({
      type: 'FeatureCollection',
      features: lines.map(l => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: l.coordinates },
        properties: { name: l.name }
      }))
    })

    map.getSource('kml-polygons').setData({
      type: 'FeatureCollection',
      features: polygons.map(p => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: p.coordinates },
        properties: { name: p.name }
      }))
    })
  }

  // ─── Legacy GeoJSON overlay (mixed geometry, no geomType) ──────────────────
  function showGeoJsonOverlay(layerId, geojson) {
    const map = mapStore.instance
    if (!map) return

    if (!map.getSource(layerId)) {
      map.addSource(layerId, { type: 'geojson', data: geojson })
    } else {
      map.getSource(layerId).setData(geojson)
    }

    const types = new Set()
    if (Array.isArray(geojson.features)) {
      geojson.features.forEach(f => { if (f.geometry) types.add(f.geometry.type) })
    }

    const visible = layerStore.visibility[layerId] ? 'visible' : 'none'

    if (types.has('Polygon') || types.has('MultiPolygon')) {
      if (!map.getLayer(layerId + '-fill')) {
        map.addLayer({
          id: layerId + '-fill', type: 'fill', source: layerId,
          layout: { visibility: visible },
          paint: { 'fill-color': '#e11d48', 'fill-opacity': 0.15 }
        })
      }
      if (!map.getLayer(layerId + '-outline')) {
        map.addLayer({
          id: layerId + '-outline', type: 'line', source: layerId,
          layout: { visibility: visible },
          paint: { 'line-color': '#e11d48', 'line-width': 1.5 }
        })
      }
    }

    if (types.has('LineString') || types.has('MultiLineString')) {
      if (!map.getLayer(layerId + '-line')) {
        map.addLayer({
          id: layerId + '-line', type: 'line', source: layerId,
          layout: { visibility: visible },
          paint: { 'line-color': '#e11d48', 'line-width': 3.5, 'line-opacity': 0.85 }
        })
      }
    }

    if (types.has('Point') || types.has('MultiPoint')) {
      if (!map.getLayer(layerId + '-circle')) {
        map.addLayer({
          id: layerId + '-circle', type: 'circle', source: layerId,
          layout: { visibility: visible },
          paint: {
            'circle-radius': 6, 'circle-color': '#e11d48',
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff'
          }
        })
      }
    }
  }

  return {
    initCoordsLayer, syncLayer, handleMapClick, removePoint,
    updatePointName, flyToPoint, showKmlOverlay, showGeoJsonOverlay,
    addCustomMapLayer, _findNearestRoad
  }
}
