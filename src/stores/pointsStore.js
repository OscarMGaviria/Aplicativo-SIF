import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePointsStore = defineStore('points', () => {
  const items = ref([])

  function add(point) {
    items.value.push({ ...point, id: Date.now() })
  }

  function remove(id) {
    items.value = items.value.filter(p => p.id !== id)
  }

  function clear() { items.value = [] }

  function setItems(pts) { items.value = pts }

  return { items, add, remove, clear, setItems }
})
