import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCoordStore = defineStore('coords', () => {
  const addModeActive = ref(false)
  const points = ref([])
  const kmlLines = ref([])
  const kmlPolygons = ref([])

  function addPoint(p) { points.value.push(p) }

  function removePoint(id) {
    points.value = points.value.filter(p => p.id !== id)
  }

  function updateName(id, name) {
    const p = points.value.find(p => p.id === id)
    if (p) p.name = name
  }

  function setPoints(pts) { points.value = pts }

  function setKmlData(lines, polygons) {
    kmlLines.value = lines
    kmlPolygons.value = polygons
  }

  function clear() {
    points.value = []
    kmlLines.value = []
    kmlPolygons.value = []
  }

  return {
    addModeActive, points, kmlLines, kmlPolygons,
    addPoint, removePoint, updateName, setPoints, setKmlData, clear
  }
})
