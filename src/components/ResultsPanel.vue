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
    <div class="rp-body" ref="rpBodyRef">
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
            <tr v-if="canteraMagna">
              <td class="rt-k">MAGNA-SIRGAS</td>
              <td class="rt-v mono text-subtle">N {{ canteraMagna.y.toFixed(2) }}, E {{ canteraMagna.x.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <button v-if="result.coords" class="copy-coords-btn" @click="copyCoords(result.coords, 'cantera')">
          <svg v-if="copiedCoords !== 'cantera'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {{ copiedCoords === 'cantera' ? 'Copiado' : 'Copiar coordenadas' }}
        </button>
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
            <tr v-if="result.municipio">
              <td class="rt-k">Municipio</td>
              <td class="rt-v">{{ result.municipio }}</td>
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
              <tr v-if="pointMagna">
                <td class="rt-k">MAGNA-SIRGAS</td>
                <td class="rt-v mono text-subtle">N {{ pointMagna.y.toFixed(2) }}, E {{ pointMagna.x.toFixed(2) }}</td>
              </tr>
              <tr v-if="result.distFromLine != null">
                <td class="rt-k">Distancia</td>
                <td class="rt-v mono text-subtle">{{ (result.distFromLine * 1000).toFixed(1) }} m</td>
              </tr>
            </template>
          </tbody>
        </table>

        <!-- Warnings -->
        <div v-if="result.warnings && result.warnings.length > 0" class="rp-warnings">
          <div v-for="(warn, i) in result.warnings" :key="'warn-'+i" class="rp-warning-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="rp-warning-icon">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>{{ warn }}</span>
          </div>
        </div>
        <button v-if="result.type === 'point' && result.snappedCoords" class="copy-coords-btn" @click="copyCoords(result.snappedCoords, 'point')">
          <svg v-if="copiedCoords !== 'point'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {{ copiedCoords === 'point' ? 'Copiado' : 'Copiar coordenadas' }}
        </button>
 
        <!-- Export selection toggle (feeds both KMZ and Illustrator export) -->
        <div v-if="result.chainedCoords" class="illustrator-toggle-area">
          <button
            class="illustrator-toggle-btn"
            :class="{ active: isRoadInExport }"
            @click="toggleExportRoad"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ai-icon">
              <path v-if="isRoadInExport" d="M5 12h14" />
              <path v-else d="M12 5v14M5 12h14" />
            </svg>
            {{ isRoadInExport ? 'Quitar de exportación' : 'Añadir a exportación (KMZ / Illustrator)' }}
          </button>
        </div>

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

          <!-- Lista local de puntos por abscisa -->
          <div v-if="abscisaPoints.length" class="abscisa-points-list">
            <div v-for="p in abscisaPoints" :key="p.id" class="abs-point-card" @click="selectAbscisaPoint(p)">
              <div class="abs-point-info">
                <span class="abs-point-pk">{{ p.formatted }}</span>
                <span class="abs-point-road" :title="p.roadCode || p.roadName">{{ p.roadCode || p.roadName }}</span>
              </div>
              <div class="abs-point-actions">
                <!-- Lupita (zoom) -->
                <button class="abs-action-btn zoom" @click.stop.prevent="zoomPoint(p)" title="Hacer zoom al punto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
                <!-- Disquete (guardar) -->
                <button class="abs-action-btn save" :class="{ saved: isAlreadySaved(p) }" :disabled="isAlreadySaved(p)" @click.stop.prevent="saveToProject(p)" title="Guardar punto en el proyecto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                </button>
                <!-- Papelera (eliminar) -->
                <button class="abs-action-btn delete" @click.stop.prevent="removeAbscisaPoint(p)" title="Eliminar de la lista">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Export selection list (feeds both KMZ and Illustrator export) -->
      <div v-if="exportStore.selectedRoads.length > 0" class="illustrator-list-section">
        <div class="ils-header">
          <span class="ils-title">Vías para exportar ({{ exportStore.selectedRoads.length }})</span>
          <button class="ils-clear-btn" @click="exportStore.clear" title="Vaciar selección">
            Limpiar
          </button>
        </div>
        <div class="ils-items">
          <div v-for="r in exportStore.selectedRoads" :key="r.id" class="ils-item">
            <div class="ils-info">
              <span class="ils-badge" :class="r.layerId"></span>
              <span class="ils-name" :title="r.codigo ? `${r.codigo} - ${r.nombre}` : r.nombre">
                {{ r.codigo || r.nombre }}
              </span>
            </div>
            <button class="ils-remove-btn" @click="exportStore.removeRoad(r.id)" title="Quitar de la selección">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useQueryStore } from '../stores/queryStore'
import { useQuery } from '../composables/useQuery'
import { parsePK, getPointAtPK } from '../composables/useStationing'
import { useCoordStore } from '../stores/coordStore'
import { useCoords } from '../composables/useCoords'
import { useMapStore } from '../stores/mapStore'
import { useExportStore } from '../stores/exportStore'
import { toMagnaSirgasOrigenNacional, copyCoordsToClipboard } from '../composables/useProjection'

const queryStore = useQueryStore()
const { result, error } = storeToRefs(queryStore)
const { clearResults, queryByPK } = useQuery()
const coordStore = useCoordStore()
const { syncLayer } = useCoords()
const mapStore = useMapStore()
const exportStore = useExportStore()

const isRoadInExport = computed(() => {
  return exportStore.isRoadSelected(result.value)
})

function toggleExportRoad() {
  if (result.value) {
    exportStore.toggleRoad(result.value)
  }
}

const ABSCISA_POINTS_KEY = 'abscisas_puntos_lista'

function loadStoredAbscisaPoints() {
  try {
    const raw = localStorage.getItem(ABSCISA_POINTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.warn('[ResultsPanel] No se pudo leer la lista guardada:', err)
    return []
  }
}

function pointKey(codigo, nombre, meters) {
  return `${codigo || nombre || ''}|${meters}`
}

const pkInput = ref('')
const pkError = ref('')
const collapsed = ref(false)
const abscisaPoints = ref(loadStoredAbscisaPoints())
const deletedKeys = ref(new Set())
const rpBodyRef = ref(null)

watch(abscisaPoints, (val) => {
  try {
    localStorage.setItem(ABSCISA_POINTS_KEY, JSON.stringify(val))
  } catch (err) {
    console.warn('[ResultsPanel] No se pudo guardar la lista localmente:', err)
  }
}, { deep: true })

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

const canteraMagna = computed(() => {
  const c = result.value?.coords
  if (!c) return null
  return toMagnaSirgasOrigenNacional(c[0], c[1])
})

const pointMagna = computed(() => {
  const c = result.value?.snappedCoords
  if (!c) return null
  return toMagnaSirgasOrigenNacional(c[0], c[1])
})

const copiedCoords = ref(null)
let copiedCoordsTimeout = null

async function copyCoords(coords, key) {
  try {
    await copyCoordsToClipboard(coords[0], coords[1])
    copiedCoords.value = key
    clearTimeout(copiedCoordsTimeout)
    copiedCoordsTimeout = setTimeout(() => { copiedCoords.value = null }, 1500)
  } catch (err) {
    console.warn('[ResultsPanel] No se pudo copiar al portapapeles:', err)
  }
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

// Automatically expand the panel when a new result or error is loaded
watch([result, error], () => {
  collapsed.value = false
})

// La lista de abscisas es acumulativa: solo se vacía por acción explícita
// del usuario (botón de papelera por punto, o cerrar el panel con la X).
// No se limpia automáticamente al cambiar de vía, consultar una cantera,
// ni al perder el resultado activo (Esc), para no perder puntos ya agregados.
watch(result, (newRes) => {
  // Registrar automáticamente en la lista de abscisas cuando el resultado sea un punto en la vía
  if (newRes && newRes.type === 'point' && newRes.snappedCoords) {
    const key = pointKey(newRes.codigo, newRes.nombre, newRes.pk)
    if (deletedKeys.value.has(key)) return

    const yaExiste = abscisaPoints.value.some(p => pointKey(p.roadCode, p.roadName, p.meters) === key)
    if (!yaExiste) {
      abscisaPoints.value.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        formatted: newRes.formatted,
        meters: newRes.pk,
        coords: newRes.snappedCoords,
        name: `${newRes.nombre || newRes.codigo || 'Vía'} - ${newRes.formatted}`,
        roadName: newRes.nombre || 'Vía sin nombre',
        roadCode: newRes.codigo || '',
        layerId: newRes.layerId
      })
    }
  }
}, { immediate: true })

function close() {
  clearResults()
  pkInput.value = ''
  pkError.value = ''
  abscisaPoints.value = []
  deletedKeys.value.clear()
}

function selectAbscisaPoint(p) {
  queryByPK(p.roadCode, p.roadName, p.meters)
  nextTick(() => {
    rpBodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

function zoomPoint(p) {
  if (mapStore.instance && p.coords) {
    mapStore.instance.flyTo({ center: p.coords, zoom: 16 })
  }
}

function removeAbscisaPoint(p) {
  abscisaPoints.value = abscisaPoints.value.filter(pt => pt.id !== p.id)
  deletedKeys.value.add(pointKey(p.roadCode, p.roadName, p.meters))
}

function isAlreadySaved(p) {
  return coordStore.points.some(pt => pt.lng === p.coords[0] && pt.lat === p.coords[1])
}

function saveToProject(p) {
  if (isAlreadySaved(p)) return

  const idx = coordStore.points.length + 1
  coordStore.addPoint({
    id: `${Date.now()}`,
    idx,
    name: p.name,
    lng: p.coords[0],
    lat: p.coords[1],
    nearestRoad: {
      nombre: p.roadName,
      codigo: p.roadCode,
      layerId: p.layerId,
      abscisa: p.formatted,
      distFromLine: 0
    }
  })

  syncLayer()
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
  const formatted = `k${km}+${String(m).padStart(3, '0')}`
  pkInput.value = formatted

  const cod = result.value?.codigo
  const nom = result.value?.nombre
  if (!cod && !nom) { pkError.value = 'Sin vía seleccionada'; return }

  const chainedCoords = result.value?.chainedCoords
  if (!chainedCoords) { pkError.value = 'Geometría de vía no disponible'; return }

  const coords = getPointAtPK(meters, chainedCoords)
  if (!coords) { pkError.value = 'La abscisa excede la longitud de la vía'; return }

  const key = pointKey(cod, nom, meters)
  const yaExiste = abscisaPoints.value.some(p => pointKey(p.roadCode, p.roadName, p.meters) === key)
  if (!yaExiste) {
    abscisaPoints.value.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      formatted,
      meters,
      coords,
      name: `${nom || cod || 'Vía'} - ${formatted}`,
      roadName: nom || 'Vía sin nombre',
      roadCode: cod || '',
      layerId: result.value?.layerId
    })
  }

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

/* Copy coordinates button */
.copy-coords-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  margin-top: -6px;
  border-radius: 6px;
  border: 1px solid #d8d8e8;
  background: #fafaff;
  color: #6060a0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.copy-coords-btn svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.copy-coords-btn:hover {
  border-color: #16a34a;
  color: #16a34a;
  background: #f0fdf4;
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

/* Go-to-PK section */
.pk-nav {
  border-top: 1px solid #eeeef8;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
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

.abscisa-points-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.abs-point-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #e8e8f4;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fafaff;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.abs-point-card:hover {
  background: #f5f5fc;
  border-color: #d1d1f0;
}

.abs-point-card:active {
  transform: scale(0.98);
}

.abs-point-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.abs-point-pk {
  font-family: 'Courier New', monospace;
  font-size: 13.5px;
  font-weight: 700;
  color: #3d5af1;
}

.abs-point-road {
  font-size: 11px;
  color: #7070a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.abs-point-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.abs-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #7070a0;
  cursor: pointer;
  padding: 0;
  transition: background 150ms, color 150ms, transform 100ms;
}

.abs-action-btn svg {
  width: 13px;
  height: 13px;
}

.abs-action-btn:active {
  transform: scale(0.92);
}

.abs-action-btn.zoom:hover {
  background: #eef2ff;
  color: #3d5af1;
}

.abs-action-btn.save:hover {
  background: #f0fdf4;
  color: #16a34a;
}

.abs-action-btn.save.saved {
  color: #16a34a;
  background: #e8f5e9;
  cursor: default;
  pointer-events: none;
}

.abs-action-btn.delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

/* Illustrator Toggle Styles */
.illustrator-toggle-area {
  padding: 8px 16px;
  display: flex;
  justify-content: center;
}

.illustrator-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  background: #f3e8ff;
  border: 1px solid #c084fc;
  color: #7e22ce;
  transition: all 0.15s ease;
}

.illustrator-toggle-btn:hover {
  background: #e9d5ff;
  border-color: #a855f7;
  color: #6b21a8;
  box-shadow: 0 2px 8px rgba(168, 85, 247, 0.15);
}

.illustrator-toggle-btn.active {
  background: #a855f7;
  border-color: #9333ea;
  color: #ffffff;
}

.illustrator-toggle-btn.active:hover {
  background: #9333ea;
  border-color: #7e22ce;
  box-shadow: 0 2px 8px rgba(147, 51, 234, 0.3);
}

.ai-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Illustrator List Section */
.illustrator-list-section {
  margin-top: auto;
  border-top: 1px dashed #d8d8e8;
  padding: 16px;
  background: #faf8ff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ils-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ils-title {
  font-size: 12px;
  font-weight: 700;
  color: #6b21a8;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.ils-clear-btn {
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: #a855f7;
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.12s;
}

.ils-clear-btn:hover {
  color: #7e22ce;
  text-decoration: underline;
}

.ils-items {
  max-height: 140px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ils-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: #ffffff;
  border: 1px solid #e9d5ff;
  border-radius: 4px;
  font-size: 12px;
}

.ils-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ils-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ils-badge.primaria { background-color: #dc2626; }
.ils-badge.secundaria { background-color: #2563eb; }
.ils-badge.terciaria { background-color: #16a34a; }

.ils-name {
  color: #374151;
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ils-remove-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.12s;
}

.ils-remove-btn:hover {
  color: #ef4444;
  background: #fee2e2;
}

.ils-remove-btn svg {
  width: 12px;
  height: 12px;
}
.rp-warnings {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rp-warning-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  color: #f59e0b;
  font-size: 0.85rem;
  line-height: 1.4;
}
.rp-warning-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}


</style>
