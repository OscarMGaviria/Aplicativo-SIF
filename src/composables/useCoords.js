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

  // Called after every style.load
  function initCoordsLayer() {
    // Re-instantiate markers if style reloads (setStyle removes all DOM markers from map container)
    for (const id in activeMarkers) {
      activeMarkers[id].remove()
      delete activeMarkers[id]
    }
    syncLayer()
    
    // Restore KML overlays if present in the store
    showKmlOverlay(coordStore.kmlLines, coordStore.kmlPolygons)

    // Restore custom GeoJSON layers if present in the store
    layerStore.customLayers.forEach(l => {
      if (l.type === 'geojson') {
        const data = layerStore._cache[l.id]
        if (data) {
          showGeoJsonOverlay(l.id, data)
        }
      }
    })
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
        // Create native Maplibre Marker
        const marker = new maplibregl.Marker()
          .setLngLat([p.lng, p.lat])
          .addTo(map)

        // Append floating text label above the pin
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
        // Update position and label text
        activeMarkers[p.id].setLngLat([p.lng, p.lat])
        const el = activeMarkers[p.id].getElement()
        const label = el.querySelector('.marker-label')
        if (label) label.textContent = p.name
      }
    }

    // 3. Clear KML overlays and registry if KML data is empty
    const hasKmlPoints = coordStore.points.some(p => p.layerId === 'custom-kml')
    if (coordStore.kmlLines.length === 0 && coordStore.kmlPolygons.length === 0 && !hasKmlPoints) {
      layerStore.removeCustomLayer('custom-kml')
      if (map.getSource('kml-lines')) map.getSource('kml-lines').setData(EMPTY_FC)
      if (map.getSource('kml-polygons')) map.getSource('kml-polygons').setData(EMPTY_FC)
    }
  }

  function _findNearestRoad(lng, lat, map) {
    if (!map) return null

    const pixel = map.project([lng, lat])
    const px = pixel.x, py = pixel.y
    const layers = ROAD_LAYER_IDS.filter(id => map.getLayer(id))
    if (!layers.length) return null

    // Instant spatial index lookup on visible vector features (20px box)
    const features = map.queryRenderedFeatures(
      [[px - 20, py - 20], [px + 20, py + 20]],
      { layers }
    )
    if (!features.length) return null

    // Retrieve original GeoJSON geometries from cache based on features properties
    const bestFeature = features[0]
    const codigo = bestFeature.properties.CODIGO_VIA || ''
    const nombre = bestFeature.properties.NOMBRE_VIA || ''
    const term = (codigo || nombre).toLowerCase()
    const bestLayerId = bestFeature.layer?.id || ''

    if (!term) return null

    // Look up cached segments matching the code/name (extremely fast)
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

  function showKmlOverlay(lines, polygons) {
    const map = mapStore.instance
    if (!map) return

    const visible = layerStore.visibility['custom-kml'] !== false ? 'visible' : 'none'

    // 1. Line Source & Layer
    if (!map.getSource('kml-lines')) {
      map.addSource('kml-lines', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'kml-lines-layer',
        type: 'line',
        source: 'kml-lines',
        layout: { visibility: visible },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 3.5,
          'line-opacity': 0.85
        }
      })
    } else {
      if (map.getLayer('kml-lines-layer')) {
        map.setLayoutProperty('kml-lines-layer', 'visibility', visible)
      }
    }
    
    // 2. Polygon Source & Layer
    if (!map.getSource('kml-polygons')) {
      map.addSource('kml-polygons', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'kml-polygons-fill',
        type: 'fill',
        source: 'kml-polygons',
        layout: { visibility: visible },
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.15
        }
      })
      map.addLayer({
        id: 'kml-polygons-outline',
        type: 'line',
        source: 'kml-polygons',
        layout: { visibility: visible },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 1.5,
          'line-opacity': 0.7
        }
      })
    } else {
      if (map.getLayer('kml-polygons-fill')) {
        map.setLayoutProperty('kml-polygons-fill', 'visibility', visible)
      }
      if (map.getLayer('kml-polygons-outline')) {
        map.setLayoutProperty('kml-polygons-outline', 'visibility', visible)
      }
    }

    // Set data
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

  function showGeoJsonOverlay(layerId, geojson) {
    const map = mapStore.instance
    if (!map) return

    // Add source
    if (!map.getSource(layerId)) {
      map.addSource(layerId, { type: 'geojson', data: geojson })
    } else {
      map.getSource(layerId).setData(geojson)
    }

    // Determine geometry types present in the GeoJSON to add appropriate layers
    const types = new Set()
    if (Array.isArray(geojson.features)) {
      geojson.features.forEach(f => {
        if (f.geometry) types.add(f.geometry.type)
      })
    }

    const visible = layerStore.visibility[layerId] ? 'visible' : 'none'

    // 1. Polygon layers
    if (types.has('Polygon') || types.has('MultiPolygon')) {
      if (!map.getLayer(layerId + '-fill')) {
        map.addLayer({
          id: layerId + '-fill',
          type: 'fill',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'fill-color': '#e11d48', // rose/pink
            'fill-opacity': 0.15
          }
        })
      }
      if (!map.getLayer(layerId + '-line')) {
        map.addLayer({
          id: layerId + '-line',
          type: 'line',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'line-color': '#e11d48',
            'line-width': 1.5
          }
        })
      }
    }

    // 2. Line layers
    if (types.has('LineString') || types.has('MultiLineString')) {
      if (!map.getLayer(layerId + '-line')) {
        map.addLayer({
          id: layerId + '-line',
          type: 'line',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'line-color': '#e11d48',
            'line-width': 3.5,
            'line-opacity': 0.85
          }
        })
      }
    }

    // 3. Point layers
    if (types.has('Point') || types.has('MultiPoint')) {
      if (!map.getLayer(layerId + '-circle')) {
        map.addLayer({
          id: layerId + '-circle',
          type: 'circle',
          source: layerId,
          layout: { visibility: visible },
          paint: {
            'circle-radius': 6,
            'circle-color': '#e11d48',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff'
          }
        })
      }
    }
  }

  return {
    initCoordsLayer, syncLayer, handleMapClick, removePoint,
    updatePointName, flyToPoint, showKmlOverlay, showGeoJsonOverlay, _findNearestRoad
  }
}
