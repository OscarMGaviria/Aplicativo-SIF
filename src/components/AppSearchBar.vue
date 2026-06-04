<template>
  <div ref="containerRef" class="search-bar">
    <!-- Input container -->
    <div class="sb-row" :class="{ focused: focused }">
      <svg class="sb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>

      <input
        ref="inputEl"
        v-model="term"
        class="sb-input"
        placeholder="Buscar vía o código..."
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @keydown.enter.prevent="onEnter"
        @keydown.escape="clearAll"
        @keydown.down.prevent="moveDown"
        @keydown.up.prevent="moveUp"
        @focus="onFocus"
      />

      <button v-if="term" class="sb-clear" @mousedown.prevent="clear" title="Limpiar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Suggestion dropdown list (Floating independently) -->
    <transition name="fade-scale">
      <ul v-if="showList" class="sug-list">
        <!-- Road suggestions -->
        <li
          v-for="(s, i) in suggestions"
          :key="i"
          class="sug-item"
          :class="{ active: curIdx === i }"
          @mousedown.prevent="selectRoad(s)"
        >
          <span class="sug-badge" :class="s.layerId">{{ layerShort(s.layerId) }}</span>
          <div class="sug-texts">
            <span class="sug-codigo">{{ s.codigo || '—' }}</span>
            <span class="sug-nombre">{{ s.nombre }}</span>
          </div>
          <!-- Selection indicator (↵ Enter) shown on hover or when keyboard-selected -->
          <span class="sug-enter-indicator">
            <svg class="enter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 10 4 15 9 20" />
              <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </svg>
          </span>
        </li>

        <!-- Coordinate option when input looks like lat,lon -->
        <li
          v-if="coordMatch && !suggestions.length"
          class="sug-item coord-item"
          :class="{ active: curIdx === 0 }"
          @mousedown.prevent="execCoords"
        >
          <span class="sug-badge coord-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
            </svg>
          </span>
          <div class="sug-texts">
            <span class="sug-codigo">Ir a coordenadas</span>
            <span class="sug-nombre">{{ term }}</span>
          </div>
          <span class="sug-enter-indicator">
            <svg class="enter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 10 4 15 9 20" />
              <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </svg>
          </span>
        </li>

        <!-- No results -->
        <li v-if="noResults" class="sug-empty">Sin resultados para "{{ term }}"</li>
      </ul>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuery } from '../composables/useQuery'
import { useMapStore } from '../stores/mapStore'

const { searchRoads, queryByRoad, queryByCoords, clearResults } = useQuery()
const mapStore = useMapStore()

const inputEl = ref(null)
const term      = ref('')
const suggestions = ref([])
const curIdx    = ref(-1)
const focused   = ref(false)
const searched  = ref(false)   // true after a search was submitted (no suggestions yet)

const COORD_RE = /^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/

const coordMatch = computed(() => COORD_RE.test(term.value.trim()))

const showList = computed(() =>
  focused.value &&
  term.value.trim().length >= 2 &&
  (suggestions.value.length > 0 || coordMatch.value || noResults.value)
)

const noResults = computed(() =>
  searched.value &&
  !coordMatch.value &&
  suggestions.value.length === 0 &&
  term.value.trim().length >= 2
)

let timer = null

function onInput() {
  curIdx.value = -1
  searched.value = false
  clearTimeout(timer)
  const t = term.value.trim()
  if (t.length < 2 || coordMatch.value) { suggestions.value = []; return }
  timer = setTimeout(() => {
    suggestions.value = searchRoads(t)
    searched.value = true
  }, 250)
}

function onEnter() {
  // If suggestion highlighted, select it
  if (curIdx.value >= 0 && suggestions.value[curIdx.value]) {
    selectRoad(suggestions.value[curIdx.value])
    return
  }

  const t = term.value.trim()
  if (!t) return

  // Coordinates
  if (coordMatch.value) { execCoords(); return }

  // Road: try exact or first suggestion
  if (suggestions.value.length > 0) {
    selectRoad(suggestions.value[0])
  } else {
    queryByRoad(t)
    close()
  }
}

function selectRoad(s) {
  term.value = s.codigo ? `${s.codigo} — ${s.nombre}` : s.nombre
  close()
  queryByRoad(s.codigo, s.nombre)
}

function execCoords() {
  const m = term.value.trim().match(COORD_RE)
  if (!m) return
  const a = parseFloat(m[1]), b = parseFloat(m[2])
  const [lat, lng] = Math.abs(a) <= 90 ? [a, b] : [b, a]
  queryByCoords(lng, lat)
  close()
}

import { onMounted, onUnmounted } from 'vue'

const containerRef = ref(null)

function clear() { term.value = ''; suggestions.value = []; searched.value = false }
function close() { suggestions.value = []; searched.value = false; focused.value = false }
function clearAll() {
  clearResults()
  clear()
  close()
  inputEl.value?.blur()
  if (mapStore.instance) {
    const isTerrain = mapStore.currentBaseMap === 'terrain3d'
    mapStore.instance.flyTo({
      center: isTerrain ? [-75.4, 6.5] : [-74.0, 4.5],
      zoom: isTerrain ? 12 : 5.5,
      pitch: 0
    })
  }
}

function onFocus() {
  focused.value = true
  const t = term.value.trim()
  if (t.length >= 2 && !coordMatch.value) suggestions.value = searchRoads(t)
}

const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    focused.value = false
  }
}

const handleGlobalKeydown = (event) => {
  if (event.key === 'Escape') {
    clearAll()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleGlobalKeydown)
})

function moveDown() {
  if (curIdx.value < suggestions.value.length - 1) curIdx.value++
}
function moveUp() {
  if (curIdx.value > -1) curIdx.value--
}

function layerShort(id) {
  return id === 'primaria' ? 'P' : id === 'secundaria' ? 'S' : 'T'
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<style scoped>
.search-bar {
  width: 100%;
  position: relative;
}

.sb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(22, 22, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0 14px;
  height: 44px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  transition: border-color 200ms cubic-bezier(0.23, 1, 0.32, 1),
              box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.sb-row.focused {
  border-color: #3d5af1;
  box-shadow: 0 6px 24px rgba(61, 90, 241, 0.25);
  transform: translateY(-1px);
}

.sb-icon {
  width: 16px;
  height: 16px;
  color: #8c8ca0;
  flex-shrink: 0;
  transition: color 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.sb-row.focused .sb-icon {
  color: #3d5af1;
}

.sb-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 13.5px;
  min-width: 0;
  font-family: system-ui, -apple-system, sans-serif;
}
.sb-input::placeholder { color: #8c8ca0; }

.sb-clear {
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  color: #8c8ca0; padding: 2px; border-radius: 6px; flex-shrink: 0;
  transition: background-color 160ms, color 160ms;
}
.sb-clear:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
.sb-clear:active { transform: scale(0.92); }
.sb-clear svg { width: 14px; height: 14px; }

/* Dropdown (floating independently) */
.sug-list {
  list-style: none;
  background: rgba(22, 22, 42, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-top: 8px; /* 8px separation vertical */
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: absolute;
  width: 100%;
  z-index: 1000;
  transform-origin: top center;
}

.sug-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
              color 160ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
}
.sug-item:hover, .sug-item.active {
  background: rgba(255, 255, 255, 0.05);
}
.sug-item.active {
  background: rgba(61, 90, 241, 0.15);
}
.sug-item:active {
  transform: scale(0.98);
}

.sug-badge {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
.sug-badge.primaria   { background: linear-gradient(135deg, #ef4444, #dc2626); }
.sug-badge.secundaria { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.sug-badge.terciaria  { background: linear-gradient(135deg, #22c55e, #16a34a); }

.coord-badge {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}
.coord-badge svg { width: 13px; height: 13px; }

.sug-texts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.sug-codigo {
  font-size: 10px;
  font-weight: 800;
  color: #6a8fff;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.02em;
}

.sug-nombre {
  font-size: 12.5px;
  color: #c0c0d8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 160ms;
}

.sug-item:hover .sug-nombre,
.sug-item.active .sug-nombre {
  color: #ffffff;
}

.sug-enter-indicator {
  opacity: 0;
  transform: translateX(4px);
  transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
  color: #3d5af1;
  display: flex;
  align-items: center;
}

.sug-item:hover .sug-enter-indicator,
.sug-item.active .sug-enter-indicator {
  opacity: 1;
  transform: translateX(0);
}

.enter-icon {
  width: 14px;
  height: 14px;
}

.coord-item .sug-nombre { color: #a78bfa; }

.sug-empty {
  padding: 10px 12px;
  font-size: 12.5px;
  color: #8c8ca0;
  font-style: italic;
}

/* Transitions */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 180ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
