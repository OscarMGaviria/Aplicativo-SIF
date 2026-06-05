<template>
  <aside class="results-panel" :class="{ collapsed: collapsed }">
    <!-- Collapse handle (floats on the left border) -->
    <div class="rp-toggle-handle" @click="toggleCollapse" :title="collapsed ? 'Mostrar resultados' : 'Colapsar resultados'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toggle-icon">
        <!-- Chevron pointing left if collapsed (to expand) or right if expanded (to collapse) -->
        <polyline v-if="collapsed" points="15 18 9 12 15 6"></polyline>
        <polyline v-else points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>

    <!-- Header -->
    <div class="rp-header">
      <span class="rp-title">Resultados</span>
      <button class="rp-close" @click="close" title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div class="rp-body">
      <!-- Empty state -->
      <div v-if="!result && !error" class="rp-empty">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p class="empty-text">Realiza una consulta para ver los resultados aquí.</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="rp-error">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ error }}</span>
      </div>

      <!-- Cantera: muestra todos sus atributos dinámicamente -->
      <template v-else-if="result?.type === 'cantera'">
        <div class="rp-badge-row">
          <span class="rp-badge cantera">Cantera</span>
        </div>
        <table class="rp-table">
          <tbody>
            <tr v-for="(val, key) in canteraProps" :key="key">
              <td class="rt-k">{{ formatKey(key) }}</td>
              <td class="rt-v mono">{{ val }}</td>
            </tr>
            <tr>
              <td class="rt-k">Latitud</td>
              <td class="rt-v mono text-subtle">{{ result.coords?.[1].toFixed(6) }}</td>
            </tr>
            <tr>
              <td class="rt-k">Longitud</td>
              <td class="rt-v mono text-subtle">{{ result.coords?.[0].toFixed(6) }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-else-if="result">
        <!-- Layer badge -->
        <div class="rp-badge-row">
          <span v-if="result.layerId" class="rp-badge" :class="result.layerId">
            {{ layerLabel(result.layerId) }}
          </span>
        </div>

        <!-- Info table -->
        <table class="rp-table">
          <tbody>
            <tr v-if="result.nombre">
              <td class="rt-k">Vía</td>
              <td class="rt-v name">{{ result.nombre }}</td>
            </tr>
            <tr v-if="result.codigo">
              <td class="rt-k">Código</td>
              <td class="rt-v mono">{{ result.codigo }}</td>
            </tr>
            <tr v-if="result.orden !== undefined && result.orden !== ''">
              <td class="rt-k">Orden</td>
              <td class="rt-v mono">{{ result.orden }}</td>
            </tr>
            <tr v-if="result.competente">
              <td class="rt-k">Competente</td>
              <td class="rt-v">{{ result.competente }}</td>
            </tr>
            <tr>
              <td class="rt-k">Longitud</td>
              <td class="rt-v mono">{{ result.totalKm?.toFixed(3) }} km</td>
            </tr>
            <tr v-if="result.type === 'road'">
              <td class="rt-k">Tramos</td>
              <td class="rt-v mono">{{ result.segmentCount }}</td>
            </tr>

            <!-- Point-specific rows -->
            <template v-if="result.type === 'point'">
              <tr>
                <td class="rt-k">Abscisa</td>
                <td class="rt-v pk">{{ result.formatted }}</td>
              </tr>
              <tr>
                <td class="rt-k">Latitud</td>
                <td class="rt-v mono text-subtle">{{ result.snappedCoords?.[1].toFixed(6) }}</td>
              </tr>
              <tr>
                <td class="rt-k">Longitud</td>
                <td class="rt-v mono text-subtle">{{ result.snappedCoords?.[0].toFixed(6) }}</td>
              </tr>
              <tr v-if="result.distFromLine != null">
                <td class="rt-k">Distancia</td>
                <td class="rt-v mono text-subtle">{{ (result.distFromLine * 1000).toFixed(1) }} m</td>
              </tr>
            </template>
          </tbody>
        </table>

        <!-- Go-to-PK input: solo para vías, no para canteras -->
        <div v-if="result.type !== 'cantera'" class="pk-nav">
          <span class="pk-nav-label">Ir a abscisa</span>
          <div class="pk-nav-row">
            <input
              v-model="pkInput"
              class="pk-nav-input"
              type="text"
              placeholder="k0+000"
              @keyup.enter="goPK"
            />
            <button class="pk-nav-btn" @click="goPK" title="Ir a abscisa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
          <transition name="fade-slide-up">
            <p v-if="pkError" class="pk-error">{{ pkError }}</p>
          </transition>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQueryStore } from '../stores/queryStore'
import { useQuery } from '../composables/useQuery'
import { parsePK } from '../composables/useStationing'

const queryStore = useQueryStore()
const { result, error } = storeToRefs(queryStore)
const { clearResults, queryByPK } = useQuery()

const pkInput = ref('')
const pkError = ref('')
const collapsed = ref(false)

// Campos técnicos de ArcGIS que no aportan valor al usuario
const SKIP_FIELDS = new Set(['OBJECTID', 'FID', 'GlobalID', 'Shape__Area',
  'Shape__Length', 'Shape__Len', 'Shape_Area', 'Shape_Length', 'SHAPE_Area', 'SHAPE_Length'])

const canteraProps = computed(() => {
  const props = result.value?.properties
  if (!props) return {}
  return Object.fromEntries(
    Object.entries(props)
      .filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== '' && v !== undefined)
  )
})

function formatKey(key) {
  return key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

// Automatically expand the panel when a new result or error is loaded
watch([result, error], () => {
  collapsed.value = false
})

function close() {
  clearResults()
  pkInput.value = ''
  pkError.value = ''
}


function goPK() {
  pkError.value = ''
  const val = String(pkInput.value || '').trim()
  if (!val) return

  const meters = parsePK(val)
  if (meters === null) { pkError.value = 'Formato requerido: k5+350'; return }

  // Formatear automáticamente al presionar enter o el botón
  const km = Math.floor(meters / 1000)
  const m = Math.round(meters % 1000)
  pkInput.value = `k${km}+${String(m).padStart(3, '0')}`

  const cod = result.value?.codigo
  const nom = result.value?.nombre
  if (!cod && !nom) { pkError.value = 'Sin vía seleccionada'; return }
  queryByPK(cod, nom, meters)
}

function layerLabel(id) {
  return id === 'primaria' ? 'Red Primaria'
       : id === 'secundaria' ? 'Red Secundaria'
       : id === 'terciaria' ? 'Red Terciaria'
       : ''
}
</script>

<style scoped>
/* Sidebar Layout (Light theme) */
.results-panel {
  position: relative;
  width: 300px;
  height: 100%;
  background: #ffffff;
  border-left: 1px solid #d8d8e8;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  z-index: 100;
  flex-shrink: 0;
  transition: margin-right 300ms cubic-bezier(0.23, 1, 0.32, 1);
}

.results-panel.collapsed {
  margin-right: -300px;
}

/* Collapse Toggle Handle */
.rp-toggle-handle {
  position: absolute;
  top: 50%;
  left: -24px;
  width: 24px;
  height: 64px;
  background: #ffffff;
  border: 1px solid #d8d8e8;
  border-right: none;
  border-radius: 8px 0 0 8px;
  box-shadow: -4px 0 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform: translateY(-50%);
  z-index: 101;
  color: #6060a0;
  transition: background-color 150ms, color 150ms;
}

.rp-toggle-handle:hover {
  background: #f5f5fc;
  color: #3d5af1;
}

.toggle-icon {
  width: 14px;
  height: 14px;
}

/* Header */
.rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #eeeef8;
  border-bottom: 1px solid #d8d8e8;
  flex-shrink: 0;
}

.rp-title {
  font-size: 13px;
  font-weight: 600;
  color: #2a2a4c;
}

.rp-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6060a0;
  cursor: pointer;
  padding: 0;
  transition: background-color 160ms, color 160ms, transform 160ms;
}

.rp-close:hover {
  background: #ddddf0;
  color: #2a2a4c;
}

.rp-close:active {
  transform: scale(0.92);
}

.rp-close svg {
  width: 14px;
  height: 14px;
}

/* Body */
.rp-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #ffffff;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
}

/* Empty state */
.rp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 16px;
  color: #b0b0c8;
  text-align: center;
}

.empty-icon {
  width: 40px;
  height: 40px;
  opacity: 0.4;
}

.empty-text {
  font-size: 12.5px;
  line-height: 1.5;
  color: #9090b8;
}

/* Error state */
.rp-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  font-size: 12.5px;
  color: #991b1b;
  line-height: 1.4;
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #ef4444;
  margin-top: 1px;
}

/* Badges */
.rp-badge-row {
  display: flex;
}

.rp-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 700;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.rp-badge.primaria   { background: linear-gradient(135deg, #ef4444, #dc2626); }
.rp-badge.secundaria { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.rp-badge.terciaria  { background: linear-gradient(135deg, #22c55e, #16a34a); }
.rp-badge.cantera    { background: linear-gradient(135deg, #f59e0b, #d97706); }

/* Info Table */
.rp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.rp-table tr {
  border-bottom: 1px solid #eeeef8;
}

.rp-table tr:last-child {
  border-bottom: none;
}

.rt-k {
  padding: 8px 8px 8px 0;
  color: #7070a0;
  font-size: 11.5px;
  width: 84px;
  vertical-align: middle;
  font-weight: 500;
}

.rt-v {
  padding: 8px 0;
  color: #2a2a4c;
  word-break: break-word;
  vertical-align: middle;
}

.rt-v.name {
  font-weight: 600;
  color: #1a1a3a;
}

.rt-v.mono {
  font-family: 'Courier New', monospace;
  font-size: 12.5px;
  font-weight: 500;
}

.rt-v.pk {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: 800;
  color: #3d5af1;
  text-shadow: 0 1px 2px rgba(61, 90, 241, 0.1);
}

.text-subtle {
  color: #606080;
}

/* Go-to-PK section */
.pk-nav {
  border-top: 1px solid #eeeef8;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pk-nav-label {
  font-size: 11px;
  color: #7070a0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.pk-nav-row {
  display: flex;
  gap: 8px;
}

.pk-nav-input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid #c8c8e0;
  background: #fafaff;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  color: #1a1a3a;
  outline: none;
  min-width: 0;
  transition: border-color 150ms, box-shadow 150ms, background-color 150ms;
}

.pk-nav-input::placeholder {
  color: #a0a0c0;
}

.pk-nav-input:focus {
  border-color: #3d5af1;
  box-shadow: 0 0 0 3px rgba(61, 90, 241, 0.15);
  background: #ffffff;
}

.pk-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: #3d5af1;
  color: #ffffff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 150ms, transform 150ms;
}

.pk-nav-btn:hover {
  background: #2a45d4;
  transform: translateY(-1px);
}

.pk-nav-btn:active {
  transform: scale(0.94);
}

.pk-nav-btn svg {
  width: 14px;
  height: 14px;
}

.pk-error {
  font-size: 11px;
  color: #dc2626;
  margin-top: 2px;
}

/* Animations */
.fade-slide-up-enter-active,
.fade-slide-up-leave-active {
  transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-slide-up-enter-from,
.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
