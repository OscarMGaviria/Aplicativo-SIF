import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'

export const useMapStore = defineStore('map', () => {
  const instance = ref(null)
  const currentBaseMap = ref('terrain3d')

  function setInstance(map) {
    instance.value = markRaw(map)
  }

  return { instance, currentBaseMap, setInstance }
})
