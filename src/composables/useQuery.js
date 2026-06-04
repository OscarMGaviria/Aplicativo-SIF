import * as turf from '@turf/turf'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore } from '../stores/layerStore'
import { useQueryStore } from '../stores/queryStore'
import {
  chainSegments, getAbscissaAtPoint, getPointAtPK,
  getTotalLengthKm, formatPK
} from './useStationing'

const ROAD_LAYER_IDS = ['primaria', 'secundaria', 'terciaria']
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

// Campos candidatos para el nombre de una cantera (en orden de preferencia)
const CANTERA_NAME_FIELDS = ['NOMBRE_', 'NOMBRE', 'NOMBRE_CANTERA', 'RAZON_SOCIAL',
  'NOMBRE_PREDIO', 'NOM_CANTERA', 'DESCRIPCION']

function getCanteraName(props) {
  for (const field of CANTERA_NAME_FIELDS) {
    if (props[field] && String(props[field]).trim()) return String(props[field]).trim()
  }
  // Fallback: primer campo string no técnico con valor
  const skip = new Set(['OBJECTID', 'FID', 'GlobalID', 'Shape__Area', 'Shape__Length'])
  for (const [k, v] of Object.entries(props)) {
    if (!skip.has(k) && v && typeof v === 'string' && v.trim()) return v.trim()
  }
  return 'Cantera'
}

let _canteraPopup = null
let _roadPopup = null

function _removeCanteraPopup() {
  if (_canteraPopup) { _canteraPopup.remove(); _canteraPopup = null }
}

function _showRoadPopup(map, coords, formatted) {
  if (_roadPopup) { _roadPopup.remove(); _roadPopup = null }
  _roadPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    anchor: 'bottom',
    offset: [0, -10],
    className: 'road-abscissa-tooltip'
  })
    .setLngLat(coords)
    .setHTML(`<span>${formatted}</span>`)
    .addTo(map)
}

function _removeRoadPopup() {
  if (_roadPopup) { _roadPopup.remove(); _roadPopup = null }
}

function cleanStr(str) {
  if (!str) return ''
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function useQuery() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const queryStore = useQueryStore()

  // Called after every style.load — must run before any query
  function initQueryLayers() {
    const map = mapStore.instance
    if (!map) return

    // Render order: hover (bottom) → selected line → selected endpoints → selected point (top)
    if (!map.getSource('query-hover')) {
      map.addSource('query-hover', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'query-hover',
        type: 'line',
        source: 'query-hover',
        paint: { 'line-color': '#fbbf24', 'line-width': 8, 'line-opacity': 0.45, 'line-blur': 3 }
      })
    }

    if (!map.getSource('query-line')) {
      map.addSource('query-line', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'query-line',
        type: 'line',
        source: 'query-line',
        paint: { 'line-color': '#ff5f1f', 'line-width': 4, 'line-opacity': 0.9 }
      })
    }

    if (!map.getSource('query-endpoints')) {
      map.addSource('query-endpoints', { type: 'geojson', data: EMPTY_FC })
      
      // Endpoints circles (green for start, red for end)
      map.addLayer({
        id: 'query-endpoints',
        type: 'circle',
        source: 'query-endpoints',
        paint: {
          'circle-radius': 6.5,
          'circle-color': [
            'match',
            ['get', 'type'],
            'start', '#10b981', // Emerald green
            'end', '#ef4444',   // Red
            '#cccccc'
          ],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff'
        }
      })

      // Endpoints labels
      map.addLayer({
        id: 'query-endpoints-label',
        type: 'symbol',
        source: 'query-endpoints',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom'
        },
        paint: {
          'text-color': '#1e293b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      })
    }

    if (!map.getSource('query-point')) {
      map.addSource('query-point', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'query-point',
        type: 'circle',
        source: 'query-point',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ff5f1f',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff'
        }
      })
    }

    // Restore last result visuals after style reload
    if (queryStore.result) _applyResultToMap(queryStore.result)
  }

  function updateHover(feature) {
    const src = mapStore.instance?.getSource('query-hover')
    if (!src) return
    src.setData(feature ? { type: 'FeatureCollection', features: [feature] } : EMPTY_FC)
  }

  function clearResults() {
    const map = mapStore.instance
    if (map?.getSource('query-line')) map.getSource('query-line').setData(EMPTY_FC)
    if (map?.getSource('query-point')) map.getSource('query-point').setData(EMPTY_FC)
    if (map?.getSource('query-endpoints')) map.getSource('query-endpoints').setData(EMPTY_FC)
    _removeCanteraPopup()
    _removeRoadPopup()
    queryStore.clear()
  }

  function _setLineData(coords) {
    const src = mapStore.instance?.getSource('query-line')
    if (src) src.setData(coords ? { type: 'FeatureCollection', features: [turf.lineString(coords)] } : EMPTY_FC)
  }

  function _setEndpointsData(coords) {
    const src = mapStore.instance?.getSource('query-endpoints')
    if (!src) return
    if (!coords || coords.length < 2) {
      src.setData(EMPTY_FC)
      return
    }
    const startPt = turf.point(coords[0], { type: 'start', label: 'Inicio' })
    const endPt = turf.point(coords[coords.length - 1], { type: 'end', label: 'Fin' })
    src.setData({
      type: 'FeatureCollection',
      features: [startPt, endPt]
    })
  }

  function _setPointData(coords) {
    const src = mapStore.instance?.getSource('query-point')
    if (src) src.setData(coords ? { type: 'FeatureCollection', features: [turf.point(coords)] } : EMPTY_FC)
  }

  function _applyResultToMap(result) {
    if (!result) return
    if (result.chainedCoords) {
      _setLineData(result.chainedCoords)
      _setEndpointsData(result.chainedCoords)
    } else {
      _setLineData(null)
      _setEndpointsData(null)
    }
    if (result.snappedCoords) _setPointData(result.snappedCoords)
    else _setPointData(null)
  }

  function searchRoads(term) {
    if (!term || term.trim().length < 2) return []
    const t = cleanStr(term)
    const seen = new Set()
    const out = []
    for (const layerId of ROAD_LAYER_IDS) {
      const data = layerStore._cache[layerId]
      if (!data) continue
      for (const f of data.features) {
        const codigo = f.properties.CODIGO_VIA || ''
        const nombre = f.properties.NOMBRE_VIA || ''
        const key = codigo || nombre
        if (!key || seen.has(key)) continue
        if (cleanStr(codigo).includes(t) || cleanStr(nombre).includes(t)) {
          seen.add(key)
          out.push({ codigo, nombre, layerId })
          if (out.length >= 20) return out
        }
      }
    }
    return out
  }

  function _getSegments(codigo, nombre) {
    let c = cleanStr(codigo)
    let n = cleanStr(nombre)

    // If only one argument is passed, treat it as both code and name for fallback
    if (typeof nombre === 'undefined') {
      c = cleanStr(codigo)
      n = c
    }

    if (!c && !n) return []
    const out = []
    for (const layerId of ROAD_LAYER_IDS) {
      const data = layerStore._cache[layerId]
      if (!data) continue
      for (const f of data.features) {
        const fCodigo = cleanStr(f.properties.CODIGO_VIA)
        const fNombre = cleanStr(f.properties.NOMBRE_VIA)
        if ((c && fCodigo === c) || (n && fNombre === n)) {
          out.push(f)
        }
      }
    }
    return out
  }

  function _competente(layerId, raw) {
    if (raw) return raw
    if (layerId === 'secundaria') return 'Gobernación de Antioquia'
    return ''
  }

  function _buildRoad(feature, layerId = '') {
    const props = feature.properties
    const codigo = props.CODIGO_VIA || ''
    const nombre = props.NOMBRE_VIA || ''
    const competente = _competente(layerId, props.COMPETENTE)
    const orden = props.ORDEN !== undefined ? props.ORDEN : ''
    const segs = _getSegments(codigo, nombre)
    const chainedCoords = (segs.length > 0 ? chainSegments(segs) : null)
      ?? chainSegments([feature])
    return { codigo, nombre, competente, orden, chainedCoords, totalKm: getTotalLengthKm(chainedCoords) }
  }

  function queryByCoords(lng, lat) {
    const pt = turf.point([lng, lat])
    let best = null, bestDist = Infinity
    for (const layerId of ROAD_LAYER_IDS) {
      const data = layerStore._cache[layerId]
      if (!data) continue
      for (const f of data.features) {
        const snapped = turf.nearestPointOnLine(f, pt, { units: 'kilometers' })
        if (snapped.properties.dist < bestDist) { bestDist = snapped.properties.dist; best = { feature: f, layerId } }
      }
    }
    if (!best) return queryStore.setError('No se encontró ninguna vía cercana.')

    const { codigo, nombre, competente, orden, chainedCoords, totalKm } = _buildRoad(best.feature, best.layerId)
    const abs = getAbscissaAtPoint(lng, lat, chainedCoords)

    _setLineData(chainedCoords)
    _setEndpointsData(chainedCoords)
    _setPointData(abs.snappedCoords)
    mapStore.instance?.flyTo({ center: abs.snappedCoords, zoom: Math.max(mapStore.instance.getZoom(), 13) })
    if (mapStore.instance) _showRoadPopup(mapStore.instance, abs.snappedCoords, abs.formatted)

    queryStore.setResult({
      type: 'point', pk: abs.pk, formatted: abs.formatted,
      snappedCoords: abs.snappedCoords, distFromLine: abs.distFromLine,
      nombre, codigo, competente, orden, layerId: best.layerId, totalKm, chainedCoords
    })
  }

  function queryByRoad(codigo, nombre) {
    const segs = _getSegments(codigo, nombre)
    if (!segs.length) {
      const termLabel = codigo && nombre ? `${codigo} — ${nombre}` : (codigo || nombre || '')
      return queryStore.setError(`No se encontró la vía: "${termLabel}"`)
    }

    const chainedCoords = chainSegments(segs)
    const props = segs[0].properties
    const totalKm = getTotalLengthKm(chainedCoords)
    const layerId = ROAD_LAYER_IDS.find(id => layerStore._cache[id]?.features.includes(segs[0])) || 'terciaria'
    const competente = _competente(layerId, props.COMPETENTE)
    const orden = props.ORDEN !== undefined ? props.ORDEN : ''

    _setLineData(chainedCoords)
    _setEndpointsData(chainedCoords)
    _setPointData(null)

    const bbox = turf.bbox(turf.lineString(chainedCoords))
    mapStore.instance?.fitBounds(bbox, { padding: 80 })

    queryStore.setResult({
      type: 'road',
      codigo: props.CODIGO_VIA || '',
      nombre: props.NOMBRE_VIA || '',
      competente,
      orden,
      layerId,
      segmentCount: segs.length,
      totalKm,
      chainedCoords
    })
  }

  function queryByPK(codigo, nombre, pkMeters) {
    let c = codigo
    let n = nombre
    let pk = pkMeters
    if (typeof pk === 'undefined') {
      c = codigo
      n = codigo
      pk = nombre
    }

    const segs = _getSegments(c, n)
    if (!segs.length) {
      const termLabel = c && n && c !== n ? `${c} — ${n}` : (c || n || '')
      return queryStore.setError(`No se encontró la vía: "${termLabel}"`)
    }

    const chainedCoords = chainSegments(segs)
    const totalKm = getTotalLengthKm(chainedCoords)
    const coords = getPointAtPK(pk, chainedCoords)

    if (!coords) return queryStore.setError(`Abscisa fuera de rango. Longitud: ${formatPK(totalKm * 1000)}`)

    const props = segs[0].properties
    const pkLayerId = ROAD_LAYER_IDS.find(id => layerStore._cache[id]?.features.includes(segs[0])) || 'terciaria'
    const competente = _competente(pkLayerId, props.COMPETENTE)
    const orden = props.ORDEN !== undefined ? props.ORDEN : ''
    _setLineData(chainedCoords)
    _setEndpointsData(chainedCoords)
    _setPointData(coords)
    mapStore.instance?.flyTo({ center: coords, zoom: Math.max(mapStore.instance?.getZoom() ?? 0, 14) })
    if (mapStore.instance) _showRoadPopup(mapStore.instance, coords, formatPK(pk))

    queryStore.setResult({
      type: 'point', pk, formatted: formatPK(pk),
      snappedCoords: coords, nombre: props.NOMBRE_VIA || '', codigo: props.CODIGO_VIA || '',
      competente, orden, layerId: pkLayerId, totalKm, chainedCoords
    })
  }

  // Always-active click handler — registered once in MapCanvas
  function handleMapClick(event) {
    const map = mapStore.instance
    if (!map) return

    const { x, y } = event.point

    // Canteras (puntos): máxima prioridad — click preciso sobre el ícono
    if (map.getLayer('canteras')) {
      const hits = map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], {
        layers: ['canteras']
      })
      if (hits.length > 0) {
        const f = hits[0]
        const coords = f.geometry.coordinates

        // Sin punto naranja para canteras — el ícono propio es suficiente
        _setLineData(null)
        _setPointData(null)

        // Tooltip con el nombre encima del ícono
        _removeCanteraPopup()
        const name = getCanteraName(f.properties)
        _canteraPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          offset: [0, -20],
          className: 'cantera-tooltip'
        })
          .setLngLat(coords)
          .setHTML(`<span>${name}</span>`)
          .addTo(map)

        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 14), duration: 600 })
        queryStore.setResult({ type: 'cantera', properties: { ...f.properties }, coords })
        return
      }
    }

    const pt = turf.point([event.lngLat.lng, event.lngLat.lat])

    // PRIORITIZATION: Check if there is an active road selected and if the click is close (< 300 meters)
    const activeRoad = queryStore.result
    if (activeRoad && activeRoad.chainedCoords) {
      const snapped = turf.nearestPointOnLine(turf.lineString(activeRoad.chainedCoords), pt, { units: 'kilometers' })
      if (snapped.properties.dist < 0.3) { // 300 meters tolerance
        const abs = getAbscissaAtPoint(event.lngLat.lng, event.lngLat.lat, activeRoad.chainedCoords)
        
        _setLineData(activeRoad.chainedCoords)
        _setEndpointsData(activeRoad.chainedCoords)
        _setPointData(abs.snappedCoords)
        map.flyTo({ center: abs.snappedCoords, zoom: Math.max(map.getZoom(), 14) })
        _showRoadPopup(map, abs.snappedCoords, abs.formatted)

        queryStore.setResult({
          type: 'point',
          pk: abs.pk,
          formatted: abs.formatted,
          snappedCoords: abs.snappedCoords,
          distFromLine: abs.distFromLine,
          nombre: activeRoad.nombre,
          codigo: activeRoad.codigo,
          competente: activeRoad.competente || '',
          orden: activeRoad.orden !== undefined ? activeRoad.orden : '',
          layerId: activeRoad.layerId,
          totalKm: activeRoad.totalKm,
          chainedCoords: activeRoad.chainedCoords
        })
        return
      }
    }

    const layers = ROAD_LAYER_IDS.filter(id => map.getLayer(id))
    if (!layers.length) return

    // Increased tolerance to 25px so thin tertiary roads are selectable
    const features = map.queryRenderedFeatures([[x - 25, y - 25], [x + 25, y + 25]], { layers })
    if (!features.length) return

    let best = null, bestDist = Infinity
    for (const f of features) {
      const snapped = turf.nearestPointOnLine(f, pt, { units: 'kilometers' })
      if (snapped.properties.dist < bestDist) { bestDist = snapped.properties.dist; best = f }
    }

    const layerId = best.layer?.id || ''
    const { codigo, nombre, competente, orden, chainedCoords, totalKm } = _buildRoad(best, layerId)
    if (!chainedCoords) return

    const abs = getAbscissaAtPoint(event.lngLat.lng, event.lngLat.lat, chainedCoords)

    _setLineData(chainedCoords)
    _setEndpointsData(chainedCoords)
    _setPointData(abs.snappedCoords)

    // Fly to show the full road extent
    const bbox = turf.bbox(turf.lineString(chainedCoords))
    map.fitBounds(bbox, { padding: 80, maxZoom: 14, duration: 800 })
    _showRoadPopup(map, abs.snappedCoords, abs.formatted)

    queryStore.setResult({
      type: 'point', pk: abs.pk, formatted: abs.formatted,
      snappedCoords: abs.snappedCoords, distFromLine: abs.distFromLine,
      nombre, codigo, competente, orden, layerId, totalKm, chainedCoords
    })
  }

  return {
    initQueryLayers, updateHover, clearResults,
    searchRoads, queryByCoords, queryByRoad, queryByPK, handleMapClick
  }
}
