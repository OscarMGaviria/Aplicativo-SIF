import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const LAYERS = [
  {
    id: 'municipios',
    label: 'Municipios',
    file: '/Municipios.geojson',
    type: 'fill',
    fillColor: '#6366f1',
    lineColor: '#4f46e5',
    order: 0
  },
  {
    id: 'terciaria',
    label: 'Red Terciaria',
    file: '/Terciaria.geojson',
    type: 'line',
    color: '#16a34a',
    lineWidth: 1,
    order: 1
  },
  {
    id: 'secundaria',
    label: 'Red Secundaria',
    file: '/Secundaria.geojson',
    type: 'line',
    color: '#2563eb',
    lineWidth: 2,
    order: 2
  },
  {
    id: 'primaria',
    label: 'Red Primaria',
    file: '/Primaria.geojson',
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

export const useLayerStore = defineStore('layers', () => {
  const OFF_BY_DEFAULT = new Set(['terciaria', 'canteras'])
  const visibility = reactive(Object.fromEntries(LAYERS.map(l => [l.id, !OFF_BY_DEFAULT.has(l.id)])))
  const loaded = reactive(Object.fromEntries(LAYERS.map(l => [l.id, false])))
  // Cache GeoJSON data to avoid re-fetching on base map style changes
  const _cache = {}

  function resetLoaded() {
    LAYERS.forEach(l => { loaded[l.id] = false })
  }

  return { visibility, loaded, _cache, resetLoaded }
})
