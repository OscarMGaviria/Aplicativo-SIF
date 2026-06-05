<template>
  <div class="layer-panel">
    <div class="panel-header">
      <span class="panel-title">Capas</span>
      <button class="close-btn" @click="emit('close')" title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <ul class="layer-list">
      <!-- Standard layers -->
      <li v-for="layer in LAYERS" :key="layer.id" class="layer-item">
        <label class="layer-row">
          <span class="layer-swatch" :style="swatchStyle(layer)" />
          <span class="layer-name">{{ layer.label }}</span>
          <span class="layer-count">{{ featureCount(layer.id) }}</span>
          <span class="toggle" :class="{ on: visibility[layer.id] }" @click="toggle(layer.id)" />
        </label>
      </li>

      <!-- Custom / Imported layers -->
      <template v-if="customLayers.length > 0">
        <li class="section-divider"><span>Importaciones</span></li>
        <li v-for="layer in customLayers" :key="layer.id" class="layer-item">
          <div class="layer-row custom-layer-row">
            <span class="layer-swatch" :style="customSwatchStyle(layer)" />
            <span class="layer-name" :title="layer.label">{{ layer.label }}</span>
            <span class="layer-count">{{ layer.featuresCount }}</span>
            <div class="action-buttons">
              <button class="action-btn zoom-btn" @click.stop="zoomToCustomLayer(layer)" title="Centrar mapa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              <button v-if="layer.geomType" class="action-btn style-btn" @click.stop="toggleStyleEditor(layer.id)" title="Editar estilo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/>
                  <circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                </svg>
              </button>
              <button class="action-btn delete-btn" @click.stop="removeCustomLayer(layer.id)" title="Eliminar capa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
            <span class="toggle" :class="{ on: visibility[layer.id] }" @click.stop="toggle(layer.id)" />
          </div>

          <!-- Inline style editor -->
          <div v-if="editingId === layer.id && layer.geomType" class="style-editor">
            <!-- POINT -->
            <template v-if="layer.geomType === 'point'">
              <div class="se-row">
                <label>Color</label>
                <input type="color" :value="layer.style?.color ?? '#3d5af1'"
                  @input="e => applyStyle(layer.id, { color: e.target.value })" />
              </div>
              <div class="se-row">
                <label>Radio <span class="se-val">{{ layer.style?.radius ?? 6 }}px</span></label>
                <input type="range" min="3" max="16" step="1"
                  :value="layer.style?.radius ?? 6"
                  @input="e => applyStyle(layer.id, { radius: +e.target.value })" />
              </div>
              <div class="se-row">
                <label>Borde</label>
                <input type="color" :value="layer.style?.strokeColor ?? '#ffffff'"
                  @input="e => applyStyle(layer.id, { strokeColor: e.target.value })" />
              </div>
            </template>

            <!-- LINE -->
            <template v-if="layer.geomType === 'line'">
              <div class="se-row">
                <label>Color</label>
                <input type="color" :value="layer.style?.color ?? '#06b6d4'"
                  @input="e => applyStyle(layer.id, { color: e.target.value })" />
              </div>
              <div class="se-row">
                <label>Grosor <span class="se-val">{{ layer.style?.width ?? 3.5 }}px</span></label>
                <input type="range" min="0.5" max="12" step="0.5"
                  :value="layer.style?.width ?? 3.5"
                  @input="e => applyStyle(layer.id, { width: +e.target.value })" />
              </div>
              <div class="se-row">
                <label>Opacidad <span class="se-val">{{ Math.round((layer.style?.opacity ?? 0.85) * 100) }}%</span></label>
                <input type="range" min="0.05" max="1" step="0.05"
                  :value="layer.style?.opacity ?? 0.85"
                  @input="e => applyStyle(layer.id, { opacity: +e.target.value })" />
              </div>
            </template>

            <!-- POLYGON -->
            <template v-if="layer.geomType === 'polygon'">
              <div class="se-row">
                <label>Relleno</label>
                <input type="color" :value="layer.style?.fillColor ?? '#06b6d4'"
                  @input="e => applyStyle(layer.id, { fillColor: e.target.value })" />
              </div>
              <div class="se-row">
                <label>Transparencia relleno <span class="se-val">{{ Math.round((layer.style?.fillOpacity ?? 0.15) * 100) }}%</span></label>
                <input type="range" min="0" max="1" step="0.05"
                  :value="layer.style?.fillOpacity ?? 0.15"
                  @input="e => applyStyle(layer.id, { fillOpacity: +e.target.value })" />
              </div>
              <div class="se-row">
                <label>Color borde</label>
                <input type="color" :value="layer.style?.borderColor ?? '#0891b2'"
                  @input="e => applyStyle(layer.id, { borderColor: e.target.value })" />
              </div>
              <div class="se-row">
                <label>Grosor borde <span class="se-val">{{ layer.style?.borderWidth ?? 1.5 }}px</span></label>
                <input type="range" min="0.5" max="8" step="0.5"
                  :value="layer.style?.borderWidth ?? 1.5"
                  @input="e => applyStyle(layer.id, { borderWidth: +e.target.value })" />
              </div>
            </template>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLayerStore, LAYERS } from '../stores/layerStore'
import { useLayers } from '../composables/useLayers'
import { useMapStore } from '../stores/mapStore'
import { useCoordStore } from '../stores/coordStore'
import * as turf from '@turf/turf'

const emit = defineEmits(['close'])

const layerStore = useLayerStore()
const mapStore = useMapStore()
const coordStore = useCoordStore()

const { visibility, customLayers } = storeToRefs(layerStore)
const { setLayerVisibility, deleteCustomLayer, applyLayerStyle } = useLayers()

const editingId = ref(null)

function toggle(id) {
  setLayerVisibility(id, !visibility.value[id])
}

function toggleStyleEditor(id) {
  editingId.value = editingId.value === id ? null : id
}

function applyStyle(id, style) {
  applyLayerStyle(id, style)
}

function featureCount(id) {
  const data = layerStore._cache[id]
  if (!data) return ''
  return data.features.length.toLocaleString()
}

function swatchStyle(layer) {
  if (layer.type === 'fill') {
    return { background: layer.fillColor, border: `2px solid ${layer.lineColor}`, borderRadius: '3px', opacity: 0.85 }
  }
  if (layer.type === 'circle') {
    return { background: layer.color, border: '2px solid #ffffff', boxShadow: '0 0 0 1px #c8c8e0', borderRadius: '50%', width: '12px', height: '12px', margin: '1px 4px' }
  }
  return { background: layer.color, borderRadius: '2px', height: '4px', marginTop: '8px', marginBottom: '8px' }
}

function customSwatchStyle(layer) {
  const color = layer.style?.color ?? layer.style?.fillColor ?? '#06b6d4'
  return {
    background: color,
    border: '2px solid #ffffff',
    boxShadow: `0 0 0 1px ${color}`,
    borderRadius: layer.geomType === 'point' ? '50%' : '3px',
    width: layer.geomType === 'point' ? '12px' : '20px',
    height: layer.geomType === 'point' ? '12px' : '14px',
    margin: layer.geomType === 'point' ? '1px 4px' : undefined
  }
}

function zoomToCustomLayer(layer) {
  const map = mapStore.instance
  if (!map) return
  const data = layerStore._cache[layer.id]
  if (!data?.features?.length) return
  try {
    const bbox = turf.bbox(data)
    map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
  } catch {}
}

function removeCustomLayer(id) {
  if (editingId.value === id) editingId.value = null
  deleteCustomLayer(id)
}
</script>

<style scoped>
.layer-panel {
  width: 240px;
  background: #fff;
  border: 1px solid #d8d8e8;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #eeeef8;
  border-bottom: 1px solid #d8d8e8;
}

.panel-title { font-size: 13px; font-weight: 600; color: #2a2a4c; }

.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; background: none; border: none;
  cursor: pointer; border-radius: 4px; color: #6060a0; padding: 0;
}
.close-btn:hover { background: #ddddf0; }
.close-btn svg { width: 13px; height: 13px; }

.layer-list { list-style: none; padding: 6px 0; }

.layer-item { padding: 0 12px; }

.layer-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; cursor: pointer; border-bottom: 1px solid #f0f0f8;
}
.layer-item:last-child .layer-row { border-bottom: none; }

.layer-swatch { flex-shrink: 0; width: 20px; height: 14px; border-radius: 2px; }

.layer-name {
  flex: 1; font-size: 13px; color: #2a2a4c;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.layer-count { font-size: 11px; color: #9090b0; margin-right: 4px; }

.toggle {
  flex-shrink: 0; position: relative; width: 30px; height: 16px;
  border-radius: 8px; background: #ccc; transition: background 0.2s; cursor: pointer;
}
.toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform 0.2s;
}
.toggle.on { background: #3d5af1; }
.toggle.on::after { transform: translateX(14px); }

.section-divider {
  display: flex; align-items: center;
  padding: 8px 12px 4px 12px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: #8080a0;
  border-top: 1px dashed #d8d8e8; margin-top: 6px;
}

.custom-layer-row { cursor: default; }

.action-buttons {
  display: flex; align-items: center; gap: 2px;
  opacity: 0.2; transition: opacity 0.15s;
}
.layer-item:hover .action-buttons { opacity: 1; }

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px; border: none;
  background: transparent; color: #555577; cursor: pointer; padding: 0;
  transition: background 0.15s, color 0.15s;
}
.action-btn svg { width: 12px; height: 12px; }

.zoom-btn:hover  { background: #eef2ff; color: #3d5af1; }
.style-btn:hover { background: #f0fdf4; color: #16a34a; }
.delete-btn:hover{ background: #fef2f2; color: #ef4444; }

/* ── Style editor ─────────────────────────────────────────────── */
.style-editor {
  padding: 8px 0 6px 4px;
  display: flex; flex-direction: column; gap: 6px;
  border-bottom: 1px dashed #e0e0f0;
}

.se-row {
  display: flex; align-items: center; gap: 8px;
}

.se-row label {
  font-size: 11px; color: #6060a0; flex: 1;
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
}

.se-val {
  font-family: 'Courier New', monospace;
  font-size: 10px; color: #3d5af1; font-weight: 700;
}

.se-row input[type="color"] {
  width: 30px; height: 22px; border: 1px solid #d8d8e8;
  border-radius: 4px; cursor: pointer; padding: 1px; background: none;
}

.se-row input[type="range"] {
  flex: 1; accent-color: #3d5af1; cursor: pointer; height: 4px;
}
</style>
