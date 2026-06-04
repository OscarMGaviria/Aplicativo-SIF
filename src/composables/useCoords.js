import * as turf from '@turf/turf'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { chainSegments, getAbscissaAtPoint } from './useStationing'

const ROAD_LAYER_IDS = ['primaria', 'secundaria', 'terciaria']
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export function useCoords() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const coordStore = useCoordStore()

  // Called after every style.load
  function initCoordsLayer() {
    const map = mapStore.instance
    if (!map) return

    if (!map.getSource('coord-points')) {
      map.addSource('coord-points', { type: 'geojson', data: EMPTY_FC })

      map.addLayer({
        id: 'coord-points-circle',
        type: 'circle',
        source: 'coord-points',
        paint: {
          'circle-radius': 7,
          'circle-color': '#7c3aed',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff'
        }
      })

      map.addLayer({
        id: 'coord-points-label',
        type: 'symbol',
        source: 'coord-points',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, -1.5],
          'text-anchor': 'bottom',
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#4c1d95',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5
        }
      })
    }

    syncLayer()
  }

  function syncLayer() {
    const map = mapStore.instance
    if (!map?.getSource('coord-points')) return
    map.getSource('coord-points').setData({
      type: 'FeatureCollection',
      features: coordStore.points.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name }
      }))
    })
  }

  function _findNearestRoad(lng, lat, map) {
    const pixel = map.project([lng, lat])
    const px = pixel.x, py = pixel.y
    const layers = ROAD_LAYER_IDS.filter(id => map.getLayer(id))
    if (!layers.length) return null

    const features = map.queryRenderedFeatures(
      [[px - 20, py - 20], [px + 20, py + 20]],
      { layers }
    )
    if (!features.length) return null

    const pt = turf.point([lng, lat])
    let best = null, bestDist = Infinity
    for (const f of features) {
      const snapped = turf.nearestPointOnLine(f, pt, { units: 'kilometers' })
      if (snapped.properties.dist < bestDist) { bestDist = snapped.properties.dist; best = f }
    }
    if (!best) return null

    const codigo = best.properties.CODIGO_VIA || ''
    const nombre = best.properties.NOMBRE_VIA || ''
    const term = (codigo || nombre).toLowerCase()

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

    const chainedCoords = (segs.length > 0 ? chainSegments(segs) : null)
      ?? best.geometry.coordinates.map(c => [c[0], c[1]])
    const abs = getAbscissaAtPoint(lng, lat, chainedCoords)

    return {
      nombre, codigo,
      layerId: best.layer?.id || '',
      abscisa: abs.formatted,
      distFromLine: abs.distFromLine
    }
  }

  function handleMapClick(event) {
    if (!coordStore.addModeActive) return

    const { lng, lat } = event.lngLat
    const map = mapStore.instance
    const nearestRoad = map ? _findNearestRoad(lng, lat, map) : null
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

  return { initCoordsLayer, syncLayer, handleMapClick, removePoint, updatePointName, flyToPoint }
}
