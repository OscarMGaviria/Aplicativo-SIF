import * as turf from '@turf/turf'
import JSZip from 'jszip'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { useQueryStore } from '../stores/queryStore'
import { useCoords } from './useCoords'
import { useMap } from './useMap'
import { useQuery } from './useQuery'

export function useProject() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const coordStore = useCoordStore()

  function saveProject() {
    const map = mapStore.instance
    if (!map) return

    const queryStore = useQueryStore()

    // 1. Build project metadata (saved inside GeoJSON root-level properties)
    const projectMetadata = {
      version: 5, // Increment version for customLayers/customGeoJsonData persistence
      center: map.getCenter().toArray(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      baseMap: mapStore.currentBaseMap,
      layers: { ...layerStore.visibility },
      kmlLines: coordStore.kmlLines,     // Persist imported KML lines
      kmlPolygons: coordStore.kmlPolygons, // Persist imported KML polygons
      customLayers: layerStore.customLayers,
      customGeoJsonData: Object.fromEntries(
        layerStore.customLayers
          .filter(l => l.type === 'geojson')
          .map(l => [l.id, layerStore._cache[l.id]])
      )
    }

    // 2. Build GeoJSON Features array
    const features = []

    // Custom Points
    for (const p of coordStore.points) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lng, p.lat]
        },
        properties: {
          type: 'custom-point',
          id: p.id,
          idx: p.idx,
          name: p.name,
          nearestRoad: p.nearestRoad ? { ...p.nearestRoad } : null,
          layerId: p.layerId || null
        }
      })
    }

    // Queried Snapped Point (from query results)
    const res = queryStore.result
    if (res) {
      if (res.snappedCoords) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: res.snappedCoords
          },
          properties: {
            type: 'query-point',
            pk: res.pk,
            formatted: res.formatted,
            nombre: res.nombre,
            codigo: res.codigo,
            competente: res.competente,
            orden: res.orden,
            layerId: res.layerId,
            distFromLine: res.distFromLine
          }
        })
      }

      // Queried Road geometry (chained segments line)
      if (res.chainedCoords) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: res.chainedCoords
          },
          properties: {
            type: 'query-road',
            nombre: res.nombre,
            codigo: res.codigo,
            competente: res.competente,
            orden: res.orden,
            layerId: res.layerId,
            totalKm: res.totalKm
          }
        })
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      generator: 'Abscisas Red Vial',
      projectMetadata,
      features
    }

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proyecto-abscisas.geojson'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadKmlKmz(file) {
    const map = mapStore.instance
    if (!map) return

    let kmlText = ''
    if (file.name.endsWith('.kmz')) {
      const zip = await JSZip.loadAsync(file)
      const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'))
      if (!kmlFile) throw new Error('No se encontró ningún archivo KML dentro del KMZ')
      kmlText = await zip.files[kmlFile].async('string')
    } else {
      kmlText = await file.text()
    }

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml')
    const placemarks = xmlDoc.getElementsByTagName('Placemark')

    const newPoints = []
    const lines = []
    const polygons = []

    const { _findNearestRoad, syncLayer, showKmlOverlay } = useCoords()

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i]
      const nameNode = pm.getElementsByTagName('name')[0]
      const name = nameNode ? nameNode.textContent.trim() : `Elemento KML ${i + 1}`

      // 1. Process all Points in this Placemark (supporting MultiGeometry)
      const pointNodes = pm.getElementsByTagName('Point')
      for (let j = 0; j < pointNodes.length; j++) {
        const pointNode = pointNodes[j]
        const coordsNode = pointNode.getElementsByTagName('coordinates')[0]
        if (coordsNode) {
          const coords = coordsNode.textContent.trim().split(/\s+/)[0].split(',')
          const lng = parseFloat(coords[0])
          const lat = parseFloat(coords[1])
          if (!isNaN(lng) && !isNaN(lat)) {
            let nearestRoad = null
            try {
              nearestRoad = _findNearestRoad(lng, lat, map)
            } catch (err) {
              console.warn('[useProject] nearestRoad lookup failed for KML point:', err)
            }
            newPoints.push({
              id: `${Date.now()}-${i}-${j}`,
              idx: coordStore.points.length + newPoints.length + 1,
              name: pointNodes.length > 1 ? `${name} - Pto ${j + 1}` : name,
              lng: parseFloat(lng.toFixed(6)),
              lat: parseFloat(lat.toFixed(6)),
              nearestRoad,
              layerId: 'custom-kml'
            })
          }
        }
      }

      // 2. Process all LineStrings in this Placemark (supporting MultiGeometry)
      const lineNodes = pm.getElementsByTagName('LineString')
      for (let j = 0; j < lineNodes.length; j++) {
        const lineNode = lineNodes[j]
        const coordsNode = lineNode.getElementsByTagName('coordinates')[0]
        if (coordsNode) {
          const coordStrings = coordsNode.textContent.trim().split(/\s+/)
          const coordinates = coordStrings.map(c => {
            const parts = c.split(',')
            return [parseFloat(parts[0]), parseFloat(parts[1])]
          }).filter(c => !isNaN(c[0]) && !isNaN(c[1]))
          if (coordinates.length >= 2) {
            lines.push({
              name: lineNodes.length > 1 ? `${name} - Lín ${j + 1}` : name,
              coordinates
            })
          }
        }
      }

      // 3. Process all Polygons in this Placemark (supporting MultiGeometry)
      const polyNodes = pm.getElementsByTagName('Polygon')
      for (let j = 0; j < polyNodes.length; j++) {
        const polyNode = polyNodes[j]
        const outerNode = polyNode.getElementsByTagName('outerBoundaryIs')[0]
        if (outerNode) {
          const coordsNode = outerNode.getElementsByTagName('coordinates')[0]
          if (coordsNode) {
            const coordStrings = coordsNode.textContent.trim().split(/\s+/)
            const coordinates = coordStrings.map(c => {
              const parts = c.split(',')
              return [parseFloat(parts[0]), parseFloat(parts[1])]
            }).filter(c => !isNaN(c[0]) && !isNaN(c[1]))
            if (coordinates.length >= 3) {
              polygons.push({
                name: polyNodes.length > 1 ? `${name} - Pol ${j + 1}` : name,
                coordinates: [coordinates]
              })
            }
          }
        }
      }
    }

    if (newPoints.length === 0 && lines.length === 0 && polygons.length === 0) {
      throw new Error('El archivo KML/KMZ no contiene coordenadas ni elementos geográficos válidos (Puntos, Líneas o Polígonos).')
    }

    // Save KML lines and polygons in the Pinia store for persistence
    coordStore.setKmlData(lines, polygons)

    if (newPoints.length > 0) {
      const updatedPoints = [...coordStore.points, ...newPoints]
      coordStore.setPoints(updatedPoints)
      syncLayer()
    }

    // Display lines/polygons on the map
    showKmlOverlay(lines, polygons)

    // Register custom KML layer in store if it has lines, polygons, or points
    if (lines.length > 0 || polygons.length > 0 || newPoints.length > 0) {
      layerStore.addCustomLayer({
        id: 'custom-kml',
        label: file.name,
        type: 'kml',
        featuresCount: lines.length + polygons.length + newPoints.length
      })
    }

    // Zoom view to imported bounds
    if (newPoints.length > 0) {
      const pts = newPoints.map(p => turf.point([p.lng, p.lat]))
      const fc = turf.featureCollection(pts)
      const bbox = turf.bbox(fc)
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
    } else if (lines.length > 0) {
      const pts = lines[0].coordinates.map(pt => turf.point(pt))
      const fc = turf.featureCollection(pts)
      const bbox = turf.bbox(fc)
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
    }
  }

  async function loadProject(file) {
    if (file.name.endsWith('.kml') || file.name.endsWith('.kmz')) {
      await loadKmlKmz(file)
      return
    }

    const text = await file.text()
    const data = JSON.parse(text)
    const map = mapStore.instance
    if (!map) return

    const { setBaseMap } = useMap()
    const { syncLayer, showKmlOverlay, showGeoJsonOverlay } = useCoords()
    const { initQueryLayers, clearResults } = useQuery()
    const queryStore = useQueryStore()

    // Check if it is a raw GeoJSON (does not contain projectMetadata)
    const isRawGeoJson = !data.projectMetadata;
    if (isRawGeoJson) {
      // Wrap single Feature or Geometry in a FeatureCollection
      let geojsonData = data
      if (data.type === 'Feature') {
        geojsonData = {
          type: 'FeatureCollection',
          features: [data]
        }
      } else if (data.type && ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(data.type)) {
        geojsonData = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: data,
            properties: {}
          }]
        }
      }

      // Verify the FeatureCollection has at least one feature with geometry
      const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : []
      if (!Array.isArray(features) || features.length === 0) {
        throw new Error('El archivo no contiene ningún elemento para mostrar.')
      }
      const hasGeometry = features.some(f => f.geometry != null)
      if (!hasGeometry) {
        throw new Error('El archivo no contiene geometrías para mostrar en el mapa.')
      }

      const layerId = 'custom-geojson-' + Date.now()

      // Set cache first so overlay creation reads correct visibility
      layerStore._cache[layerId] = geojsonData

      // Register custom layer in store (sets visibility to true)
      layerStore.addCustomLayer({
        id: layerId,
        label: file.name,
        type: 'geojson',
        featuresCount: geojsonData.features.length
      })

      // Add to map
      showGeoJsonOverlay(layerId, geojsonData)

      // Zoom view to imported bounds
      const bbox = turf.bbox(geojsonData)
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })

      return
    }

    if (data.type === 'FeatureCollection') {

      // 1. New GeoJSON Format
      const meta = data.projectMetadata
      if (meta) {
        // Clear any existing custom layers before loading a project
        layerStore.clearCustomLayers()

        if (meta.center) {
          map.flyTo({
            center: meta.center,
            zoom: meta.zoom ?? 12,
            bearing: meta.bearing ?? 0,
            pitch: meta.pitch ?? 0
          })
        }
        if (meta.baseMap) {
          setBaseMap(meta.baseMap)
        }
        if (meta.layers) {
          Object.entries(meta.layers).forEach(([id, visible]) => {
            if (id in layerStore.visibility) layerStore.visibility[id] = visible
          })
        }
        // Restore KML Geometries if present in project metadata
        if (meta.kmlLines || meta.kmlPolygons) {
          coordStore.setKmlData(meta.kmlLines || [], meta.kmlPolygons || [])
          showKmlOverlay(coordStore.kmlLines, coordStore.kmlPolygons)
        }
        // Restore custom layers list and visibility
        if (Array.isArray(meta.customLayers)) {
          meta.customLayers.forEach(l => {
            layerStore.addCustomLayer(l)
            if (meta.layers && l.id in meta.layers) {
              layerStore.visibility[l.id] = meta.layers[l.id]
            }
          })
        }
        // Restore custom GeoJSON data cache and overlays
        if (meta.customGeoJsonData) {
          Object.entries(meta.customGeoJsonData).forEach(([id, geojson]) => {
            layerStore._cache[id] = geojson
            showGeoJsonOverlay(id, geojson)
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
            pointsList.push({
              id: props.id,
              idx: props.idx,
              name: props.name,
              lng: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
              nearestRoad: props.nearestRoad,
              layerId: props.layerId || null
            })
          } else if (props.type === 'query-point') {
            queryResult = queryResult || {}
            queryResult.type = 'point'
            queryResult.pk = props.pk
            queryResult.formatted = props.formatted
            queryResult.snappedCoords = f.geometry.coordinates
            queryResult.nombre = props.nombre
            queryResult.codigo = props.codigo
            queryResult.competente = props.competente
            queryResult.orden = props.orden
            queryResult.layerId = props.layerId
            queryResult.distFromLine = props.distFromLine
          } else if (props.type === 'query-road') {
            queryResult = queryResult || {}
            if (queryResult.type !== 'point') {
              queryResult.type = 'road'
            }
            queryResult.nombre = props.nombre
            queryResult.codigo = props.codigo
            queryResult.competente = props.competente
            queryResult.orden = props.orden
            queryResult.layerId = props.layerId
            queryResult.totalKm = props.totalKm
            queryResult.chainedCoords = f.geometry.coordinates
          }
        }
      }

      coordStore.setPoints(pointsList)
      syncLayer()

      if (queryResult) {
        queryStore.setResult(queryResult)
        initQueryLayers()
      } else {
        clearResults()
      }

    } else {
      // Clear custom layers
      layerStore.clearCustomLayers()

      // Check if legacy project has valid coordinates
      let hasCoordinates = false
      if (Array.isArray(data.points) && data.points.length > 0) {
        hasCoordinates = true
      } else if (Array.isArray(data.center) && data.center.length === 2 && !isNaN(data.center[0]) && !isNaN(data.center[1])) {
        hasCoordinates = true
      }
      if (!hasCoordinates) {
        throw new Error('El archivo de proyecto JSON no contiene coordenadas válidas (puntos o centro de mapa).')
      }

      // 2. Old JSON Format (backward compatibility)
      if (data.center) {
        map.flyTo({
          center: data.center,
          zoom: data.zoom ?? 5.5,
          bearing: data.bearing ?? 0,
          pitch: data.pitch ?? 0
        })
      }
      if (data.baseMap) {
        setBaseMap(data.baseMap)
      }
      if (data.layers) {
        Object.entries(data.layers).forEach(([id, visible]) => {
          if (id in layerStore.visibility) layerStore.visibility[id] = visible
        })
      }
      if (data.points) {
        coordStore.setPoints(data.points)
        syncLayer()
      }
      clearResults()
    }
  }

  return { saveProject, loadProject }
}
