<template>
  <div ref="mapEl" class="map-canvas" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { useLayers } from '../composables/useLayers'
import { useQuery } from '../composables/useQuery'
import { useCoords } from '../composables/useCoords'
import { useCoordStore } from '../stores/coordStore'
import { useMapControls } from '../composables/useMapControls'

const ROAD_LAYER_IDS = ['primaria', 'secundaria', 'terciaria']

const mapEl = ref(null)
const { initMap } = useMap()
const { loadAllLayers } = useLayers()
const { initQueryLayers, handleMapClick: handleRoadClick, updateHover } = useQuery()
const { initCoordsLayer, handleMapClick: handleCoordClick } = useCoords()
const coordStore = useCoordStore()
const { addPanelControls } = useMapControls()

let map = null
let hoverPopup = null

onMounted(() => {
  map = initMap(mapEl.value, async () => {
    if (!map.getSource('municipios')) {
      await loadAllLayers()
      initQueryLayers()
      initCoordsLayer()
    }
  })

  addPanelControls()

  // Click: routes to coord-add or road-query depending on active mode
  map.on('click', (event) => {
    if (coordStore.addModeActive) {
      handleCoordClick(event)
    } else {
      handleRoadClick(event)
    }
  })

  // Hover: crosshair in add mode, road tooltip + pointer otherwise
  map.on('mousemove', (e) => {
    if (coordStore.addModeActive) {
      map.getCanvas().style.cursor = 'crosshair'
      updateHover(null)
      hoverPopup?.remove()
      return
    }
    const layers = ROAD_LAYER_IDS.filter(id => map.getLayer(id))
    if (!layers.length) return
    const features = map.queryRenderedFeatures(e.point, { layers })
    map.getCanvas().style.cursor = features.length ? 'pointer' : ''
    updateHover(features[0] ?? null)

    if (features.length) {
      const props = features[0].properties
      const nombre = props.NOMBRE_VIA || ''
      const codigo = props.CODIGO_VIA || ''
      if (!hoverPopup) {
        hoverPopup = new maplibregl.Popup({
          closeButton: false, closeOnClick: false,
          anchor: 'bottom', offset: [0, -6],
          className: 'road-hover-tooltip'
        })
      }
      hoverPopup.setLngLat(e.lngLat)
        .setHTML(`${codigo ? `<span class="rht-code">${codigo}</span>` : ''}<span class="rht-name">${nombre}</span>`)
        .addTo(map)
    } else {
      hoverPopup?.remove()
      hoverPopup = null
    }
  })

  map.on('mouseleave', () => {
    hoverPopup?.remove()
    hoverPopup = null
  })
})

onUnmounted(() => {
  map?.remove()
})
</script>

<style scoped>
.map-canvas {
  flex: 1;
  height: 100%;
  min-width: 0;
}
</style>
