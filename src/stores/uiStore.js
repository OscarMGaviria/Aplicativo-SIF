import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const layerPanelOpen  = ref(false)
  const coordsPanelOpen = ref(false)
  return { layerPanelOpen, coordsPanelOpen }
})
