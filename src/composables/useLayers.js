import { markRaw } from 'vue'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore, LAYERS } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { useCoords } from './useCoords'

const ICON_SVGS = {
  'canteras-icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <circle cx="16" cy="16" r="15" fill="#d97706" stroke="#ffffff" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="22" y2="22" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="5.5" y="7.5" width="8" height="4.5" rx="1" fill="#ffffff" transform="rotate(-45 9.5 9.75)"/>
    <line x1="10" y1="22" x2="22" y2="10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M20 8 L25 10 L23 15 L19 13 Z" fill="#ffffff"/>
  </svg>`
}

function _loadSvgImage(map, name) {
  if (map.hasImage(name)) return Promise.resolve()
  const svg = ICON_SVGS[name]
  if (!svg) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image(32, 32)
    img.onload = () => { map.addImage(name, img); resolve() }
    img.onerror = () => resolve()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

export function useLayers() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const coordStore = useCoordStore()

  async function loadAllLayers() {
    const map = mapStore.instance
    if (!map) return
    layerStore.resetLoaded()
    for (const layer of LAYERS) {
      await _loadLayer(map, layer)
    }
  }

  async function _loadLayer(map, layer) {
    try {
      if (!layerStore._cache[layer.id]) {
        const res = await fetch(layer.file)
        layerStore._cache[layer.id] = markRaw(await res.json())
      }

      const data = layerStore._cache[layer.id]
      const visible = layerStore.visibility[layer.id] ? 'visible' : 'none'

      if (!map.getSource(layer.id)) {
        map.addSource(layer.id, { type: 'geojson', data })
      }

      if (layer.type === 'line') {
        if (!map.getLayer(layer.id)) {
          map.addLayer({
            id: layer.id, type: 'line', source: layer.id,
            layout: { 'line-join': 'round', 'line-cap': 'round', visibility: visible },
            paint: { 'line-color': layer.color, 'line-width': layer.lineWidth }
          })
        }
      } else if (layer.type === 'circle') {
        if (!map.getLayer(layer.id)) {
          map.addLayer({
            id: layer.id, type: 'circle', source: layer.id,
            layout: { visibility: visible },
            paint: {
              'circle-radius': layer.circleRadius || 6,
              'circle-color': layer.color || '#d97706',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff'
            }
          })
        }
      } else if (layer.type === 'symbol') {
        if (layer.iconImage) await _loadSvgImage(map, layer.iconImage)
        if (!map.getLayer(layer.id)) {
          map.addLayer({
            id: layer.id, type: 'symbol', source: layer.id,
            layout: {
              'icon-image': layer.iconImage || '',
              'icon-size': layer.iconSize || 1,
              'icon-allow-overlap': true,
              'icon-ignore-placement': false,
              visibility: visible
            }
          })
        }
      } else {
        if (!map.getLayer(layer.id + '-fill')) {
          map.addLayer({
            id: layer.id + '-fill', type: 'fill', source: layer.id,
            layout: { visibility: visible },
            paint: { 'fill-color': layer.fillColor, 'fill-opacity': 0.07 }
          })
        }
        if (!map.getLayer(layer.id + '-line')) {
          map.addLayer({
            id: layer.id + '-line', type: 'line', source: layer.id,
            layout: { visibility: visible },
            paint: { 'line-color': layer.lineColor, 'line-width': 0.8, 'line-opacity': 0.6 }
          })
        }
      }

      layerStore.loaded[layer.id] = true
    } catch (err) {
      console.error(`Error cargando capa ${layer.id}:`, err)
    }
  }

  function setLayerVisibility(id, visible) {
    const map = mapStore.instance
    if (!map) return
    layerStore.visibility[id] = visible
    const v = visible ? 'visible' : 'none'

    if (id === 'municipios') {
      if (map.getLayer(id + '-fill')) map.setLayoutProperty(id + '-fill', 'visibility', v)
      if (map.getLayer(id + '-line')) map.setLayoutProperty(id + '-line', 'visibility', v)
      return
    }

    // Standard named layer (primaria, secundaria, terciaria, canteras)
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', v)
      return
    }

    // Custom layers: try all possible suffixes
    for (const suffix of ['-circle', '-line', '-fill', '-outline']) {
      if (map.getLayer(id + suffix)) map.setLayoutProperty(id + suffix, 'visibility', v)
    }

    // Legacy fixed-ID KML sources
    if (id === 'custom-kml') {
      for (const lid of ['kml-lines-layer', 'kml-polygons-fill', 'kml-polygons-outline']) {
        if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', v)
      }
      const { syncLayer } = useCoords()
      syncLayer()
    }
  }

  function deleteCustomLayer(id) {
    const map = mapStore.instance
    if (map) {
      // Remove all possible sub-layers for this source
      for (const suffix of ['-circle', '-line', '-fill', '-outline']) {
        if (map.getLayer(id + suffix)) map.removeLayer(id + suffix)
      }
      if (map.getSource(id)) map.removeSource(id)

      // Legacy fixed-id KML cleanup
      if (id === 'custom-kml') {
        coordStore.setKmlData([], [])
        coordStore.setPoints(coordStore.points.filter(p => p.layerId !== 'custom-kml'))
        for (const lid of ['kml-lines-layer', 'kml-polygons-fill', 'kml-polygons-outline']) {
          if (map.getLayer(lid)) map.removeLayer(lid)
        }
        for (const sid of ['kml-lines', 'kml-polygons']) {
          if (map.getSource(sid)) map.removeSource(sid)
        }
        const { syncLayer } = useCoords()
        syncLayer()
      }
    }

    layerStore.removeCustomLayer(id)
    delete layerStore._cache[id]
  }

  // Apply style changes to a custom layer already on the map
  function applyLayerStyle(id, style) {
    const map = mapStore.instance
    if (!map) return

    layerStore.updateCustomLayerStyle(id, style)

    const circleId = id + '-circle'
    if (map.getLayer(circleId)) {
      if (style.color !== undefined)       map.setPaintProperty(circleId, 'circle-color', style.color)
      if (style.radius !== undefined)      map.setPaintProperty(circleId, 'circle-radius', style.radius)
      if (style.strokeColor !== undefined) map.setPaintProperty(circleId, 'circle-stroke-color', style.strokeColor)
      if (style.strokeWidth !== undefined) map.setPaintProperty(circleId, 'circle-stroke-width', style.strokeWidth)
    }

    const lineId = id + '-line'
    if (map.getLayer(lineId)) {
      if (style.color !== undefined)   map.setPaintProperty(lineId, 'line-color', style.color)
      if (style.width !== undefined)   map.setPaintProperty(lineId, 'line-width', style.width)
      if (style.opacity !== undefined) map.setPaintProperty(lineId, 'line-opacity', style.opacity)
    }

    const fillId = id + '-fill'
    if (map.getLayer(fillId)) {
      if (style.fillColor !== undefined)   map.setPaintProperty(fillId, 'fill-color', style.fillColor)
      if (style.fillOpacity !== undefined) map.setPaintProperty(fillId, 'fill-opacity', style.fillOpacity)
    }

    const outlineId = id + '-outline'
    if (map.getLayer(outlineId)) {
      if (style.borderColor !== undefined)   map.setPaintProperty(outlineId, 'line-color', style.borderColor)
      if (style.borderWidth !== undefined)   map.setPaintProperty(outlineId, 'line-width', style.borderWidth)
      if (style.borderOpacity !== undefined) map.setPaintProperty(outlineId, 'line-opacity', style.borderOpacity)
    }
  }

  return { loadAllLayers, setLayerVisibility, deleteCustomLayer, applyLayerStyle }
}
