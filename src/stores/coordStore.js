import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCoordStore = defineStore('coords', () => {
  const addModeActive = ref(false)
  const points = ref([])

  function addPoint(p) { points.value.push(p) }

  function removePoint(id) {
    points.value = points.value.filter(p => p.id !== id)
  }

  function updateName(id, name) {
    const p = points.value.find(p => p.id === id)
    if (p) p.name = name
  }

  function setPoints(pts) { points.value = pts }

  function clear() { points.value = [] }

  return { addModeActive, points, addPoint, removePoint, updateName, setPoints, clear }
})
