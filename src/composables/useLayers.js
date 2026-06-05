import { markRaw } from 'vue'
import { useMapStore } from '../stores/mapStore'
import { useLayerStore, LAYERS } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { useCoords } from './useCoords'

// SVG de pico y martillo cruzados — símbolo universal de cantera/minería
const ICON_SVGS = {
  'canteras-icon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <circle cx="16" cy="16" r="15" fill="#d97706" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Martillo (\\): handle de arriba-izquierda a centro, cabeza rect en arriba-izquierda -->
    <line x1="10" y1="10" x2="22" y2="22" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="5.5" y="7.5" width="8" height="4.5" rx="1" fill="#ffffff" transform="rotate(-45 9.5 9.75)"/>
    <!-- Pico (/): handle de abajo-izquierda a centro, cabeza apuntada en arriba-derecha -->
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
            id: layer.id,
            type: 'line',
            source: layer.id,
            layout: { 'line-join': 'round', 'line-cap': 'round', visibility: visible },
            paint: { 'line-color': layer.color, 'line-width': layer.lineWidth }
          })
        }
      } else if (layer.type === 'circle') {
        if (!map.getLayer(layer.id)) {
          map.addLayer({
            id: layer.id,
            type: 'circle',
            source: layer.id,
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
            id: layer.id,
            type: 'symbol',
            source: layer.id,
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
        const fillId = layer.id + '-fill'
        const lineId = layer.id + '-line'
        if (!map.getLayer(fillId)) {
          map.addLayer({
            id: fillId,
            type: 'fill',
            source: layer.id,
            layout: { visibility: visible },
            paint: { 'fill-color': layer.fillColor, 'fill-opacity': 0.07 }
          })
        }
        if (!map.getLayer(lineId)) {
          map.addLayer({
            id: lineId,
            type: 'line',
            source: layer.id,
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
    } else if (id === 'custom-kml') {
      if (map.getLayer('kml-lines-layer')) map.setLayoutProperty('kml-lines-layer', 'visibility', v)
      if (map.getLayer('kml-polygons-fill')) map.setLayoutProperty('kml-polygons-fill', 'visibility', v)
      if (map.getLayer('kml-polygons-outline')) map.setLayoutProperty('kml-polygons-outline', 'visibility', v)
      
      const { syncLayer } = useCoords()
      syncLayer()
    } else if (id.startsWith('custom-geojson-')) {
      if (map.getLayer(id + '-fill')) map.setLayoutProperty(id + '-fill', 'visibility', v)
      if (map.getLayer(id + '-line')) map.setLayoutProperty(id + '-line', 'visibility', v)
      if (map.getLayer(id + '-circle')) map.setLayoutProperty(id + '-circle', 'visibility', v)
    } else {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
    }
  }

  function deleteCustomLayer(id) {
    const map = mapStore.instance
    if (id === 'custom-kml') {
      coordStore.setKmlData([], [])
      coordStore.setPoints(coordStore.points.filter(p => p.layerId !== 'custom-kml'))
      const { syncLayer } = useCoords()
      syncLayer()
    } else if (id.startsWith('custom-geojson-')) {
      if (map) {
        if (map.getLayer(id + '-fill')) map.removeLayer(id + '-fill')
        if (map.getLayer(id + '-line')) map.removeLayer(id + '-line')
        if (map.getLayer(id + '-circle')) map.removeLayer(id + '-circle')
        if (map.getSource(id)) map.removeSource(id)
      }
      layerStore.removeCustomLayer(id)
      delete layerStore._cache[id]
    }
  }

  return { loadAllLayers, setLayerVisibility, deleteCustomLayer }
}
