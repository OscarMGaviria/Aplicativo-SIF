import { useMapStore } from '../stores/mapStore'
import { useLayerStore } from '../stores/layerStore'
import { useCoordStore } from '../stores/coordStore'
import { useCoords } from './useCoords'

export function useProject() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const coordStore = useCoordStore()

  function saveProject() {
    const map = mapStore.instance
    if (!map) return

    const state = {
      version: 2,
      center: map.getCenter().toArray(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      baseMap: mapStore.currentBaseMap,
      layers: { ...layerStore.visibility },
      points: coordStore.points.map(p => ({ ...p }))
    }

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proyecto-abscisas.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadProject(file) {
    const text = await file.text()
    const state = JSON.parse(text)
    const map = mapStore.instance
    if (!map) return

    if (state.center) {
      map.flyTo({
        center: state.center,
        zoom: state.zoom ?? 5.5,
        bearing: state.bearing ?? 0,
        pitch: state.pitch ?? 0
      })
    }

    if (state.layers) {
      Object.entries(state.layers).forEach(([id, visible]) => {
        if (id in layerStore.visibility) layerStore.visibility[id] = visible
      })
    }

    if (state.points) {
      coordStore.setPoints(state.points)
      const { syncLayer } = useCoords()
      syncLayer()
    }
  }

  return { saveProject, loadProject }
}
