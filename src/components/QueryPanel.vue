<template>
  <div class="query-panel">
    <div class="panel-header">
      <span class="panel-title">Consultas</span>
      <button class="close-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="mode-tabs">
      <button v-for="tab in TABS" :key="tab.id" class="tab-btn"
        :class="{ active: activeTab === tab.id }" @click="switchTab(tab.id)">
        {{ tab.label }}
      </button>
    </div>

    <div class="panel-body">

      <!-- Coordenadas -->
      <template v-if="activeTab === 'coords'">
        <label class="field-label">Latitud</label>
        <input v-model.number="coords.lat" class="field-input" type="number"
          step="0.000001" placeholder="ej. 6.2530" @keyup.enter="runCoords" />
        <label class="field-label">Longitud</label>
        <input v-model.number="coords.lng" class="field-input" type="number"
          step="0.000001" placeholder="ej. -75.5610" @keyup.enter="runCoords" />
        <button class="run-btn" :disabled="!coordsValid" @click="runCoords">Consultar</button>
      </template>

      <!-- Por vía -->
      <template v-if="activeTab === 'road'">
        <label class="field-label">Código o nombre de la vía</label>
        <div class="autocomplete">
          <input v-model="roadTerm" class="field-input" type="text"
            placeholder="ej. 25ANF o Paso por Caldas"
            @input="onRoadInput" @keyup.enter="runRoad" @keydown.down.prevent="acDown"
            @keydown.up.prevent="acUp" @keydown.escape="acSuggestions = []" />
          <ul v-if="acSuggestions.length" class="ac-list">
            <li v-for="(s, i) in acSuggestions" :key="i"
              :class="{ highlighted: acIndex === i }"
              @mousedown.prevent="selectSuggestion(s)">
              <span class="ac-codigo">{{ s.codigo || '—' }}</span>
              <span class="ac-nombre">{{ s.nombre }}</span>
              <span class="ac-layer">{{ layerLabel(s.layerId) }}</span>
            </li>
          </ul>
        </div>
        <button class="run-btn" :disabled="!roadTerm.trim()" @click="runRoad">Consultar</button>
      </template>

      <!-- Por abscisa -->
      <template v-if="activeTab === 'pk'">
        <label class="field-label">Código o nombre de la vía</label>
        <div class="autocomplete">
          <input v-model="pkRoad" class="field-input" type="text"
            placeholder="ej. 25ANF"
            @input="onPKRoadInput" @keydown.down.prevent="acDown"
            @keydown.up.prevent="acUp" @keydown.escape="acSuggestions = []" />
          <ul v-if="acSuggestions.length" class="ac-list">
            <li v-for="(s, i) in acSuggestions" :key="i"
              :class="{ highlighted: acIndex === i }"
              @mousedown.prevent="selectSuggestionPK(s)">
              <span class="ac-codigo">{{ s.codigo || '—' }}</span>
              <span class="ac-nombre">{{ s.nombre }}</span>
              <span class="ac-layer">{{ layerLabel(s.layerId) }}</span>
            </li>
          </ul>
        </div>
        <label class="field-label">Abscisa (k0+000)</label>
        <input v-model="pkValue" class="field-input" type="text"
          placeholder="ej. k5+350" @keyup.enter="runPK" />
        <p v-if="pkParseError" class="field-error">{{ pkParseError }}</p>
        <button class="run-btn" :disabled="!pkRoad.trim() || !pkValue.trim()" @click="runPK">
          Consultar
        </button>
      </template>

      <!-- Click en mapa -->
      <template v-if="activeTab === 'click'">
        <p class="click-hint">
          Activa el modo click y luego haz click sobre cualquier vía en el mapa.
        </p>
        <button class="run-btn click-toggle"
          :class="{ active: clickModeActive }"
          @click="toggleClickMode">
          {{ clickModeActive ? 'Desactivar click' : 'Activar click en mapa' }}
        </button>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuery } from '../composables/useQuery'
import { useQueryStore } from '../stores/queryStore'
import { parsePK } from '../composables/useStationing'

const emit = defineEmits(['close'])

const TABS = [
  { id: 'coords', label: 'Coordenadas' },
  { id: 'road',   label: 'Por vía' },
  { id: 'pk',     label: 'Por abscisa' },
  { id: 'click',  label: 'Click en mapa' }
]

const { searchRoads, queryByCoords, queryByRoad, queryByPK } = useQuery()
const queryStore = useQueryStore()
const { clickModeActive } = storeToRefs(queryStore)

const activeTab = ref('coords')

// --- Coordenadas ---
const coords = ref({ lat: null, lng: null })
const coordsValid = computed(() =>
  coords.value.lat !== null && coords.value.lng !== null &&
  Math.abs(coords.value.lat) <= 90 && Math.abs(coords.value.lng) <= 180
)
function runCoords() {
  if (!coordsValid.value) return
  queryByCoords(coords.value.lng, coords.value.lat)
}

// --- Por vía ---
const roadTerm = ref('')
function runRoad() {
  acSuggestions.value = []
  queryByRoad(roadTerm.value)
}

// --- Por abscisa ---
const pkRoad = ref('')
const pkValue = ref('')
const pkParseError = ref('')
function runPK() {
  pkParseError.value = ''
  const meters = parsePK(pkValue.value)
  if (meters === null) {
    pkParseError.value = 'Formato inválido. Use k0+000'
    return
  }
  acSuggestions.value = []
  queryByPK(pkRoad.value, meters)
}

// --- Click mode ---
function toggleClickMode() {
  queryStore.clickModeActive = !queryStore.clickModeActive
}

// --- Autocomplete shared ---
const acSuggestions = ref([])
const acIndex = ref(-1)

function onRoadInput() {
  acIndex.value = -1
  acSuggestions.value = searchRoads(roadTerm.value)
}
function onPKRoadInput() {
  acIndex.value = -1
  acSuggestions.value = searchRoads(pkRoad.value)
}
function acDown() {
  if (acIndex.value < acSuggestions.value.length - 1) acIndex.value++
}
function acUp() {
  if (acIndex.value > 0) acIndex.value--
}
function selectSuggestion(s) {
  roadTerm.value = s.codigo || s.nombre
  acSuggestions.value = []
}
function selectSuggestionPK(s) {
  pkRoad.value = s.codigo || s.nombre
  acSuggestions.value = []
}

function switchTab(id) {
  activeTab.value = id
  acSuggestions.value = []
  if (id !== 'click') queryStore.clickModeActive = false
}

function layerLabel(id) {
  return id === 'primaria' ? 'P' : id === 'secundaria' ? 'S' : 'T'
}
</script>

<style scoped>
.query-panel {
  width: 260px;
  background: #fff;
  border: 1px solid #d8d8e8;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  overflow: visible;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #eeeef8;
  border-bottom: 1px solid #d8d8e8;
  border-radius: 8px 8px 0 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #2a2a4c;
}

.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  background: none; border: none; cursor: pointer;
  border-radius: 4px; color: #6060a0; padding: 0;
}
.close-btn:hover { background: #ddddf0; }
.close-btn svg { width: 13px; height: 13px; }

.mode-tabs {
  display: flex;
  border-bottom: 1px solid #d8d8e8;
}

.tab-btn {
  flex: 1;
  padding: 6px 4px;
  border: none;
  background: none;
  font-size: 11px;
  color: #7070a0;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab-btn:hover { color: #3d5af1; }
.tab-btn.active { color: #3d5af1; border-bottom-color: #3d5af1; font-weight: 600; }

.panel-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  color: #7070a0;
  font-weight: 500;
}

.field-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #c8c8e0;
  border-radius: 4px;
  font-size: 13px;
  color: #1a1a3a;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus { border-color: #3d5af1; }

.field-error {
  font-size: 11px;
  color: #dc2626;
}

.run-btn {
  margin-top: 4px;
  padding: 7px 12px;
  border-radius: 4px;
  border: none;
  background: #3d5af1;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-end;
}
.run-btn:hover { background: #2a45d4; }
.run-btn:disabled { background: #a0a8d8; cursor: not-allowed; }

.click-toggle { align-self: stretch; text-align: center; }
.click-toggle.active { background: #dc2626; }
.click-toggle.active:hover { background: #b91c1c; }

.click-hint {
  font-size: 12px;
  color: #6070a0;
  line-height: 1.5;
}

/* Autocomplete */
.autocomplete { position: relative; }

.ac-list {
  position: absolute;
  top: 100%;
  left: 0; right: 0;
  z-index: 100;
  background: #fff;
  border: 1px solid #c8c8e0;
  border-top: none;
  border-radius: 0 0 4px 4px;
  list-style: none;
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.ac-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 12px;
}
.ac-list li:hover, .ac-list li.highlighted { background: #eeeef8; }

.ac-codigo {
  font-weight: 600;
  color: #3d5af1;
  flex-shrink: 0;
  min-width: 40px;
}
.ac-nombre { flex: 1; color: #1a1a3a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ac-layer {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #e8e8f8;
  color: #5060a0;
  font-weight: 600;
}
</style>
