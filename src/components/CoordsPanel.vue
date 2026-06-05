<template>
  <div class="coords-panel">
    <div class="panel-header">
      <span class="panel-title">Puntos</span>
      <button class="close-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="add-bar">
      <button class="add-btn" :class="{ active: addModeActive }" @click="addModeActive = !addModeActive">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        {{ addModeActive ? 'Click en el mapa...' : 'Agregar punto' }}
      </button>
    </div>

    <div class="points-list">
      <p v-if="points.length === 0" class="empty-msg">
        Activa "Agregar punto" y haz click sobre el mapa.
      </p>

      <div v-for="p in points" :key="p.id" class="point-card" :class="{ 'layer-hidden': isPointHidden(p) }">
        <div class="point-top">
          <input
            class="point-name"
            :value="p.name"
            @blur="e => onNameBlur(p.id, e.target.value)"
            @keyup.enter="e => e.target.blur()"
            title="Editar nombre"
          />
          <button class="icon-btn fly" @click="flyToPoint(p)" title="Ir a este punto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </button>
          <button class="icon-btn del" @click="removePoint(p.id)" title="Eliminar punto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>

        <div class="point-coords">
          {{ p.lat.toFixed(6) }}, {{ p.lng.toFixed(6) }}
        </div>

        <div v-if="p.nearestRoad" class="point-road">
          <span class="road-dot" :class="p.nearestRoad.layerId" />
          <span class="road-pk">{{ p.nearestRoad.abscisa }}</span>
          <span class="road-sep">·</span>
          <span class="road-id">{{ p.nearestRoad.codigo || p.nearestRoad.nombre }}</span>
          <span class="road-dist">{{ (p.nearestRoad.distFromLine * 1000).toFixed(0) }}m</span>
        </div>
        <div v-else class="point-road no-road">Sin vía cercana</div>
      </div>
    </div>

    <div v-if="points.length > 0" class="panel-footer">
      <span class="point-count">{{ points.length }} punto{{ points.length !== 1 ? 's' : '' }}</span>
      <button class="clear-btn" @click="clearAll">Limpiar todo</button>
    </div>
  </div>
</template>

<script setup>
import { onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCoordStore } from '../stores/coordStore'
import { useCoords } from '../composables/useCoords'
import { useLayerStore } from '../stores/layerStore'

const layerStore = useLayerStore()

function isPointHidden(p) {
  return p.layerId && layerStore.visibility[p.layerId] === false
}

const emit = defineEmits(['close'])

const coordStore = useCoordStore()
const { addModeActive, points } = storeToRefs(coordStore)
const { flyToPoint, removePoint, updatePointName, syncLayer } = useCoords()

function onNameBlur(id, value) {
  const name = value.trim()
  if (!name) return
  updatePointName(id, name)
}

function clearAll() {
  coordStore.clear()
  syncLayer()
}

onUnmounted(() => {
  coordStore.addModeActive = false
})
</script>

<style scoped>
.coords-panel {
  width: 260px;
  background: #fff;
  border: 1px solid #d8d8e8;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  display: flex;
  flex-direction: column;
  max-height: 480px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #eeeef8;
  border-bottom: 1px solid #d8d8e8;
  border-radius: 8px 8px 0 0;
  flex-shrink: 0;
}

.panel-title { font-size: 13px; font-weight: 600; color: #2a2a4c; }

.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  background: none; border: none; cursor: pointer;
  border-radius: 4px; color: #6060a0; padding: 0;
}
.close-btn:hover { background: #ddddf0; }
.close-btn svg { width: 13px; height: 13px; }

.add-bar {
  padding: 8px 10px;
  border-bottom: 1px solid #eeeef8;
  flex-shrink: 0;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1.5px dashed #a0a0c8;
  background: transparent;
  color: #6060a0;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.add-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.add-btn:hover { border-color: #7c3aed; color: #7c3aed; background: #f5f3ff; }
.add-btn.active {
  border-style: solid;
  border-color: #7c3aed;
  background: #f5f3ff;
  color: #5b21b6;
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.3); }
  50% { box-shadow: 0 0 0 4px rgba(124,58,237,0.1); }
}

.points-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-msg {
  font-size: 12px;
  color: #9090b0;
  text-align: center;
  padding: 20px 10px;
  line-height: 1.5;
}

.point-card {
  border: 1px solid #e8e8f4;
  border-radius: 6px;
  padding: 8px;
  background: #fafaff;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: opacity 0.2s, border-style 0.2s;
}

.point-card.layer-hidden {
  opacity: 0.5;
  border-style: dashed;
  background: #fafafa;
}

.point-top {
  display: flex;
  align-items: center;
  gap: 4px;
}

.point-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #2a2a4c;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 4px;
  background: transparent;
  min-width: 0;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.point-name:focus { border-color: #7c3aed; background: #fff; }

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 4px; border: none; cursor: pointer;
  padding: 0; flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.icon-btn svg { width: 13px; height: 13px; }

.icon-btn.fly { background: none; color: #6060a0; }
.icon-btn.fly:hover { background: #ededf8; color: #7c3aed; }

.icon-btn.del { background: none; color: #9090b0; }
.icon-btn.del:hover { background: #fff0f0; color: #dc2626; }

.point-coords {
  font-size: 11px;
  color: #7070a0;
  font-family: 'Courier New', monospace;
}

.point-road {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.road-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.road-dot.primaria   { background: #dc2626; }
.road-dot.secundaria { background: #2563eb; }
.road-dot.terciaria  { background: #16a34a; }

.road-pk {
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #ff5f1f;
}

.road-sep { color: #c0c0d0; }

.road-id {
  flex: 1;
  color: #4040a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.road-dist {
  flex-shrink: 0;
  color: #9090b0;
  font-size: 10px;
}

.no-road { color: #b0b0c8; font-style: italic; }

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-top: 1px solid #eeeef8;
  flex-shrink: 0;
}

.point-count { font-size: 11px; color: #9090b0; }

.clear-btn {
  font-size: 11px;
  color: #dc2626;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
}
.clear-btn:hover { background: #fff0f0; }
</style>
