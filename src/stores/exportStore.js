import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useExportStore = defineStore('export', () => {
  const selectedRoads = ref([])

  function getRoadId(road) {
    if (!road) return ''
    return road.codigo ? `code-${road.codigo}` : `name-${road.nombre}`
  }

  function addRoad(road) {
    if (!road || !road.chainedCoords) return
    const id = getRoadId(road)
    if (!selectedRoads.value.some(r => r.id === id)) {
      selectedRoads.value.push({
        id,
        codigo: road.codigo || '',
        nombre: road.nombre || '',
        layerId: road.layerId || 'terciaria',
        chainedCoords: road.chainedCoords,
        totalKm: road.totalKm || 0
      })
    }
  }

  function removeRoad(id) {
    selectedRoads.value = selectedRoads.value.filter(r => r.id !== id)
  }

  function toggleRoad(road) {
    if (!road) return
    const id = getRoadId(road)
    if (selectedRoads.value.some(r => r.id === id)) {
      removeRoad(id)
    } else {
      addRoad(road)
    }
  }

  function isRoadSelected(road) {
    if (!road) return false
    const id = getRoadId(road)
    return selectedRoads.value.some(r => r.id === id)
  }

  function clear() {
    selectedRoads.value = []
  }

  return {
    selectedRoads,
    addRoad,
    removeRoad,
    toggleRoad,
    isRoadSelected,
    clear
  }
})
