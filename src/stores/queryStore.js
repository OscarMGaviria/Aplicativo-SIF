import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useQueryStore = defineStore('query', () => {
  const result = ref(null)
  const error = ref(null)
  const clickModeActive = ref(false)

  function setResult(r) { result.value = r; error.value = null }
  function setError(msg) { error.value = msg; result.value = null }
  function clear() { result.value = null; error.value = null }
  function toggleClickMode() { clickModeActive.value = !clickModeActive.value }

  return { result, error, clickModeActive, setResult, setError, clear, toggleClickMode }
})
