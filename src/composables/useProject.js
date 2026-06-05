import * as turf from '@turf/turf'
import JSZip from 'jszip'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore, DEFAULT_STYLES } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { useQueryStore } from '../stores/queryStore'
import { useCoords } from './useCoords'
import { useMap } from './useMap'
import { useQuery } from './useQuery'

// ─── KML helpers ─────────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function featureToKml(feature) {
  if (!feature.geometry) return ''
  const name = escapeXml(feature.properties?.name ?? '')
  const wrap = (inner) => `<Placemark><name>${name}</name>${inner}</Placemark>`

  const { type, coordinates } = feature.geometry
  if (type === 'Point') {
    return wrap(`<Point><coordinates>${coordinates[0]},${coordinates[1]},0</coordinates></Point>`)
  }
  if (type === 'LineString') {
    const coords = coordinates.map(c => `${c[0]},${c[1]},0`).join(' ')
    return wrap(`<LineString><coordinates>${coords}</coordinates></LineString>`)
  }
  if (type === 'MultiLineString') {
    return coordinates.map((line, i) => {
      const coords = line.map(c => `${c[0]},${c[1]},0`).join(' ')
      return wrap(`<LineString><coordinates>${coords}</coordinates></LineString>`)
    }).join('')
  }
  if (type === 'Polygon') {
    const ring = coordinates[0].map(c => `${c[0]},${c[1]},0`).join(' ')
    return wrap(`<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>`)
  }
  if (type === 'MultiPolygon') {
    return coordinates.map(poly => {
      const ring = poly[0].map(c => `${c[0]},${c[1]},0`).join(' ')
      return wrap(`<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>`)
    }).join('')
  }
  return ''
}

function buildKml(folders) {
  const body = folders.map(({ name, features }) => {
    const placemarks = features.map(featureToKml).filter(Boolean).join('\n')
    return `  <Folder><name>${escapeXml(name)}</name>\n${placemarks}\n  </Folder>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n${body}\n</Document>\n</kml>`
}

// ─── Main composable ──────────────────────────────────────────────────────────

export function useProject() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const coordStore = useCoordStore()

  // ─── Save project (own format) ─────────────────────────────────────────────
  function saveProject() {
    const map = mapStore.instance
    if (!map) return
    const queryStore = useQueryStore()

    const projectMetadata = {
      version: 6,
      center: map.getCenter().toArray(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      baseMap: mapStore.currentBaseMap,
      layers: { ...layerStore.visibility },
      customLayers: layerStore.customLayers,
      customGeoJsonData: Object.fromEntries(
        layerStore.customLayers.map(l => [l.id, layerStore._cache[l.id] ?? null]).filter(([, v]) => v)
      )
    }

    const features = []

    for (const p of coordStore.points) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { type: 'custom-point', id: p.id, idx: p.idx, name: p.name, nearestRoad: p.nearestRoad ?? null, layerId: p.layerId ?? null }
      })
    }

    const res = queryStore.result
    if (res?.snappedCoords) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: res.snappedCoords },
        properties: { type: 'query-point', pk: res.pk, formatted: res.formatted, nombre: res.nombre, codigo: res.codigo, competente: res.competente, orden: res.orden, layerId: res.layerId, distFromLine: res.distFromLine }
      })
    }
    if (res?.chainedCoords) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: res.chainedCoords },
        properties: { type: 'query-road', nombre: res.nombre, codigo: res.codigo, competente: res.competente, orden: res.orden, layerId: res.layerId, totalKm: res.totalKm }
      })
    }

    const geojson = { type: 'FeatureCollection', generator: 'Abscisas Red Vial', projectMetadata, features }
    _download(JSON.stringify(geojson, null, 2), 'proyecto-abscisas.geojson', 'application/geo+json')
  }

  // ─── Export GeoJSON (all user data + custom layers) ────────────────────────
  function exportGeoJSON() {
    const allFeatures = []

    // User-created markers
    for (const p of coordStore.points) {
      allFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name, _layer: 'Puntos creados' }
      })
    }

    // All custom imported layers
    for (const l of layerStore.customLayers) {
      const data = layerStore._cache[l.id]
      if (!data?.features) continue
      data.features.forEach(f => {
        allFeatures.push({
          ...f,
          properties: { ...(f.properties ?? {}), _layer: l.label }
        })
      })
    }

    if (!allFeatures.length) return

    const geojson = { type: 'FeatureCollection', features: allFeatures }
    _download(JSON.stringify(geojson, null, 2), 'exportacion.geojson', 'application/geo+json')
  }

  // ─── Export KMZ (all user data + custom layers) ────────────────────────────
  async function exportKMZ() {
    const folders = []

    // User-created markers
    if (coordStore.points.length > 0) {
      folders.push({
        name: 'Puntos creados',
        features: coordStore.points.map(p => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { name: p.name }
        }))
      })
    }

    // Custom imported layers
    for (const l of layerStore.customLayers) {
      const data = layerStore._cache[l.id]
      if (!data?.features?.length) continue
      folders.push({ name: l.label, features: data.features })
    }

    if (!folders.length) return

    const kml = buildKml(folders)
    const zip = new JSZip()
    zip.file('doc.kml', kml)
    const blob = await zip.generateAsync({ type: 'blob' })
    _download(blob, 'exportacion.kmz', 'application/vnd.google-earth.kmz')
  }

  // ─── Load KML / KMZ — creates separate layers per geometry type ────────────
  async function loadKmlKmz(file) {
    const map = mapStore.instance
    if (!map) return

    let kmlText = ''
    if (file.name.toLowerCase().endsWith('.kmz')) {
      const zip = await JSZip.loadAsync(file)
      const kmlFileName = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.kml'))
      if (!kmlFileName) throw new Error('No se encontró ningún archivo KML dentro del KMZ')
      kmlText = await zip.files[kmlFileName].async('string')
    } else {
      kmlText = await file.text()
    }

    const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml')
    const placemarks = xmlDoc.getElementsByTagName('Placemark')

    const pointFeatures = []
    const lineFeatures = []
    const polygonFeatures = []

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i]
      const nameNode = pm.getElementsByTagName('name')[0]
      const pmName = nameNode ? nameNode.textContent.trim() : `Elemento ${i + 1}`

      // Points
      const pointNodes = pm.getElementsByTagName('Point')
      for (let j = 0; j < pointNodes.length; j++) {
        const coordsNode = pointNodes[j].getElementsByTagName('coordinates')[0]
        if (coordsNode) {
          const parts = coordsNode.textContent.trim().split(/\s+/)[0].split(',')
          const lng = parseFloat(parts[0]), lat = parseFloat(parts[1])
          if (!isNaN(lng) && !isNaN(lat)) {
            pointFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))] },
              properties: { name: pointNodes.length > 1 ? `${pmName} - Pto ${j + 1}` : pmName }
            })
          }
        }
      }

      // LineStrings
      const lineNodes = pm.getElementsByTagName('LineString')
      for (let j = 0; j < lineNodes.length; j++) {
        const coordsNode = lineNodes[j].getElementsByTagName('coordinates')[0]
        if (coordsNode) {
          const coords = _parseKmlCoords(coordsNode.textContent)
          if (coords.length >= 2) {
            lineFeatures.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: coords },
              properties: { name: lineNodes.length > 1 ? `${pmName} - Lín ${j + 1}` : pmName }
            })
          }
        }
      }

      // Polygons
      const polyNodes = pm.getElementsByTagName('Polygon')
      for (let j = 0; j < polyNodes.length; j++) {
        const outerNode = polyNodes[j].getElementsByTagName('outerBoundaryIs')[0]
        if (outerNode) {
          const coordsNode = outerNode.getElementsByTagName('coordinates')[0]
          if (coordsNode) {
            const coords = _parseKmlCoords(coordsNode.textContent)
            if (coords.length >= 3) {
              polygonFeatures.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [coords] },
                properties: { name: polyNodes.length > 1 ? `${pmName} - Pol ${j + 1}` : pmName }
              })
            }
          }
        }
      }
    }

    if (!pointFeatures.length && !lineFeatures.length && !polygonFeatures.length) {
      throw new Error('El archivo KML/KMZ no contiene coordenadas ni elementos geográficos válidos.')
    }

    const { addCustomMapLayer } = useCoords()
    const baseName = file.name.replace(/\.(kml|kmz)$/i, '')
    const ts = Date.now()
    const allCoords = []

    if (pointFeatures.length > 0) {
      const id = `kml-${ts}-points`
      const fc = { type: 'FeatureCollection', features: pointFeatures }
      const style = { ...DEFAULT_STYLES.point }
      layerStore._cache[id] = fc
      layerStore.addCustomLayer({ id, label: `${baseName} – Puntos`, geomType: 'point', type: 'kml-points', featuresCount: pointFeatures.length, style })
      addCustomMapLayer(id, fc, 'point', style)
      pointFeatures.forEach(f => allCoords.push(f.geometry.coordinates))
    }

    if (lineFeatures.length > 0) {
      const id = `kml-${ts}-lines`
      const fc = { type: 'FeatureCollection', features: lineFeatures }
      const style = { ...DEFAULT_STYLES.line }
      layerStore._cache[id] = fc
      layerStore.addCustomLayer({ id, label: `${baseName} – Líneas`, geomType: 'line', type: 'kml-lines', featuresCount: lineFeatures.length, style })
      addCustomMapLayer(id, fc, 'line', style)
      lineFeatures.forEach(f => f.geometry.coordinates.forEach(c => allCoords.push(c)))
    }

    if (polygonFeatures.length > 0) {
      const id = `kml-${ts}-polygons`
      const fc = { type: 'FeatureCollection', features: polygonFeatures }
      const style = { ...DEFAULT_STYLES.polygon }
      layerStore._cache[id] = fc
      layerStore.addCustomLayer({ id, label: `${baseName} – Polígonos`, geomType: 'polygon', type: 'kml-polygons', featuresCount: polygonFeatures.length, style })
      addCustomMapLayer(id, fc, 'polygon', style)
      polygonFeatures.forEach(f => f.geometry.coordinates[0].forEach(c => allCoords.push(c)))
    }

    if (allCoords.length > 0) {
      const bbox = turf.bbox(turf.featureCollection(allCoords.map(c => turf.point(c))))
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
    }
  }

  function _parseKmlCoords(text) {
    return text.trim().split(/\s+/)
      .map(c => { const p = c.split(','); return [parseFloat(p[0]), parseFloat(p[1])] })
      .filter(c => !isNaN(c[0]) && !isNaN(c[1]))
  }

  // ─── Load project or raw GeoJSON ────────────────────────────────────────────
  async function loadProject(file) {
    if (/\.(kml|kmz)$/i.test(file.name)) {
      await loadKmlKmz(file)
      return
    }

    const text = await file.text()
    const data = JSON.parse(text)
    const map = mapStore.instance
    if (!map) return

    const { setBaseMap } = useMap()
    const { syncLayer, showKmlOverlay, showGeoJsonOverlay, addCustomMapLayer } = useCoords()
    const { initQueryLayers, clearResults } = useQuery()
    const queryStore = useQueryStore()

    // ── Raw GeoJSON (no projectMetadata) ──────────────────────────────────────
    const isRawGeoJson = !data.projectMetadata
    if (isRawGeoJson) {
      let geojsonData = data
      if (data.type === 'Feature') {
        geojsonData = { type: 'FeatureCollection', features: [data] }
      } else if (['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection'].includes(data.type)) {
        geojsonData = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: data, properties: {} }] }
      }

      const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : []
      if (!features.length || !features.some(f => f.geometry != null)) {
        throw new Error('El archivo no contiene geometrías para mostrar en el mapa.')
      }

      // Detect dominant geometry type(s)
      const types = new Set()
      features.forEach(f => {
        if (f.geometry) {
          const t = f.geometry.type
          if (t.includes('Point')) types.add('point')
          else if (t.includes('Line')) types.add('line')
          else if (t.includes('Polygon')) types.add('polygon')
        }
      })

      const ts = Date.now()
      const baseName = file.name.replace(/\.geojson$/i, '').replace(/\.json$/i, '')

      if (types.size === 1) {
        // Single geometry type → one typed layer
        const geomType = [...types][0]
        const id = `geojson-${ts}`
        const style = { ...DEFAULT_STYLES[geomType] }
        layerStore._cache[id] = geojsonData
        layerStore.addCustomLayer({ id, label: file.name, geomType, type: 'geojson', featuresCount: features.length, style })
        addCustomMapLayer(id, geojsonData, geomType, style)
      } else {
        // Mixed types → separate layers per type
        const splitMap = { point: [], line: [], polygon: [] }
        features.forEach(f => {
          if (!f.geometry) return
          const t = f.geometry.type
          if (t.includes('Point')) splitMap.point.push(f)
          else if (t.includes('Line')) splitMap.line.push(f)
          else if (t.includes('Polygon')) splitMap.polygon.push(f)
        })
        for (const [geomType, feats] of Object.entries(splitMap)) {
          if (!feats.length) continue
          const id = `geojson-${ts}-${geomType}`
          const fc = { type: 'FeatureCollection', features: feats }
          const style = { ...DEFAULT_STYLES[geomType] }
          layerStore._cache[id] = fc
          layerStore.addCustomLayer({ id, label: `${baseName} – ${_geomLabel(geomType)}`, geomType, type: 'geojson', featuresCount: feats.length, style })
          addCustomMapLayer(id, fc, geomType, style)
        }
      }

      const bbox = turf.bbox(geojsonData)
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
      return
    }

    // ── Project file (has projectMetadata) ─────────────────────────────────────
    if (data.type === 'FeatureCollection') {
      const meta = data.projectMetadata
      if (meta) {
        layerStore.clearCustomLayers()

        if (meta.center) map.flyTo({ center: meta.center, zoom: meta.zoom ?? 12, bearing: meta.bearing ?? 0, pitch: meta.pitch ?? 0 })
        if (meta.baseMap) setBaseMap(meta.baseMap)
        if (meta.layers) Object.entries(meta.layers).forEach(([id, vis]) => { if (id in layerStore.visibility) layerStore.visibility[id] = vis })

        // Restore legacy kmlLines/kmlPolygons
        if (meta.kmlLines || meta.kmlPolygons) {
          coordStore.setKmlData(meta.kmlLines || [], meta.kmlPolygons || [])
          showKmlOverlay(coordStore.kmlLines, coordStore.kmlPolygons)
        }

        // Restore custom layers (v6+: have geomType+style)
        if (Array.isArray(meta.customLayers)) {
          meta.customLayers.forEach(l => {
            layerStore.addCustomLayer(l)
            if (meta.layers?.[l.id] !== undefined) layerStore.visibility[l.id] = meta.layers[l.id]
          })
        }

        if (meta.customGeoJsonData) {
          Object.entries(meta.customGeoJsonData).forEach(([id, geojson]) => {
            if (!geojson) return
            layerStore._cache[id] = geojson
            const layer = layerStore.customLayers.find(l => l.id === id)
            if (layer?.geomType) {
              addCustomMapLayer(id, geojson, layer.geomType, layer.style ?? {})
            } else {
              showGeoJsonOverlay(id, geojson)
            }
          })
        }
      }

      const pointsList = []
      let queryResult = null
      if (Array.isArray(data.features)) {
        for (const f of data.features) {
          const props = f.properties
          if (!props) continue
          if (props.type === 'custom-point') {
            pointsList.push({ id: props.id, idx: props.idx, name: props.name, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], nearestRoad: props.nearestRoad, layerId: props.layerId ?? null })
          } else if (props.type === 'query-point') {
            queryResult = queryResult || {}
            Object.assign(queryResult, { type: 'point', pk: props.pk, formatted: props.formatted, snappedCoords: f.geometry.coordinates, nombre: props.nombre, codigo: props.codigo, competente: props.competente, orden: props.orden, layerId: props.layerId, distFromLine: props.distFromLine })
          } else if (props.type === 'query-road') {
            queryResult = queryResult || {}
            if (queryResult.type !== 'point') queryResult.type = 'road'
            Object.assign(queryResult, { nombre: props.nombre, codigo: props.codigo, competente: props.competente, orden: props.orden, layerId: props.layerId, totalKm: props.totalKm, chainedCoords: f.geometry.coordinates })
          }
        }
      }

      coordStore.setPoints(pointsList)
      syncLayer()

      if (queryResult) { queryStore.setResult(queryResult); initQueryLayers() }
      else clearResults()
    }
  }

  function _geomLabel(geomType) {
    return geomType === 'point' ? 'Puntos' : geomType === 'line' ? 'Líneas' : 'Polígonos'
  }

  function _download(content, filename, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return { saveProject, loadProject, exportGeoJSON, exportKMZ }
}
