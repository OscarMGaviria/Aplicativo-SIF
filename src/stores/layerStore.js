import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

const BASE = import.meta.env.BASE_URL

export const LAYERS = [
  {
    id: 'municipios',
    label: 'Municipios',
    file: `${BASE}Municipios.geojson`,
    type: 'fill',
    fillColor: '#6366f1',
    lineColor: '#4f46e5',
    order: 0
  },
  {
    id: 'terciaria',
    label: 'Red Terciaria',
    file: `${BASE}Terciaria.geojson`,
    type: 'line',
    color: '#16a34a',
    lineWidth: 1,
    order: 1
  },
  {
    id: 'secundaria',
    label: 'Red Secundaria',
    file: `${BASE}Secundaria.geojson`,
    type: 'line',
    color: '#2563eb',
    lineWidth: 2,
    order: 2
  },
  {
    id: 'primaria',
    label: 'Red Primaria',
    file: `${BASE}Primaria.geojson`,
    type: 'line',
    color: '#dc2626',
    lineWidth: 3.5,
    order: 3
  },
  {
    id: 'canteras',
    label: 'Canteras (ArcGIS)',
    file: 'https://services5.arcgis.com/K90UQIB09TmTjUL8/arcgis/rest/services/Cantera/FeatureServer/25/query?where=1%3D1&outFields=*&f=geojson',
    type: 'symbol',
    iconImage: 'canteras-icon',
    iconSize: 0.75,
    order: 4
  }
]

// Default paint styles for each geometry type in custom/imported layers
export const DEFAULT_STYLES = {
  point:   { color: '#3d5af1', radius: 6, strokeColor: '#ffffff', strokeWidth: 1.5 },
  line:    { color: '#06b6d4', width: 3.5, opacity: 0.85 },
  polygon: { fillColor: '#06b6d4', fillOpacity: 0.15, borderColor: '#0891b2', borderWidth: 1.5, borderOpacity: 0.7 }
}

export const useLayerStore = defineStore('layers', () => {
  const OFF_BY_DEFAULT = new Set(['terciaria', 'canteras'])
  const visibility = reactive(Object.fromEntries(LAYERS.map(l => [l.id, !OFF_BY_DEFAULT.has(l.id)])))
  const loaded = reactive(Object.fromEntries(LAYERS.map(l => [l.id, false])))

  // Cache GeoJSON data to avoid re-fetching on base map style changes
  const _cache = {}

  // Custom layers imported at runtime (KML, GeoJSON, etc.)
  // Each entry: { id, label, type, geomType, featuresCount, style }
  const customLayers = ref([])

  function addCustomLayer(layer) {
    customLayers.value = customLayers.value.filter(l => l.id !== layer.id)
    customLayers.value.push(layer)
    visibility[layer.id] = true
  }

  function removeCustomLayer(id) {
    customLayers.value = customLayers.value.filter(l => l.id !== id)
    delete visibility[id]
  }

  function clearCustomLayers() {
    customLayers.value.forEach(l => { delete visibility[l.id] })
    customLayers.value = []
  }

  function resetLoaded() {
    LAYERS.forEach(l => { loaded[l.id] = false })
  }

  function updateCustomLayerStyle(id, style) {
    const layer = customLayers.value.find(l => l.id === id)
    if (layer) layer.style = { ...(layer.style ?? {}), ...style }
  }

  return {
    visibility, loaded, _cache, customLayers,
    addCustomLayer, removeCustomLayer, clearCustomLayers, resetLoaded,
    updateCustomLayerStyle
  }
})
