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
      <li v-for="layer in LAYERS" :key="layer.id" class="layer-item">
        <label class="layer-row">
          <span class="layer-swatch" :style="swatchStyle(layer)" />
          <span class="layer-name">{{ layer.label }}</span>
          <span class="layer-count">{{ featureCount(layer.id) }}</span>
          <span class="toggle" :class="{ on: visibility[layer.id] }" @click="toggle(layer.id)" />
        </label>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLayerStore, LAYERS } from '../stores/layerStore'
import { useLayers } from '../composables/useLayers'

const emit = defineEmits(['close'])

const layerStore = useLayerStore()
const { visibility } = storeToRefs(layerStore)
const { setLayerVisibility } = useLayers()

function toggle(id) {
  setLayerVisibility(id, !visibility.value[id])
}

function featureCount(id) {
  const data = layerStore._cache[id]
  if (!data) return ''
  return data.features.length.toLocaleString()
}

function swatchStyle(layer) {
  if (layer.type === 'fill') {
    return {
      background: layer.fillColor,
      border: `2px solid ${layer.lineColor}`,
      borderRadius: '3px',
      opacity: 0.85
    }
  }
  if (layer.type === 'circle') {
    return {
      background: layer.color,
      border: `2px solid #ffffff`,
      boxShadow: '0 0 0 1px #c8c8e0',
      borderRadius: '50%',
      width: '12px',
      height: '12px',
      margin: '1px 4px'
    }
  }
  return {
    background: layer.color,
    borderRadius: '2px',
    height: '4px',
    marginTop: '8px',
    marginBottom: '8px'
  }
}
</script>

<style scoped>
.layer-panel {
  width: 220px;
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

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #2a2a4c;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  color: #6060a0;
  padding: 0;
}

.close-btn:hover { background: #ddddf0; }
.close-btn svg { width: 13px; height: 13px; }

.layer-list {
  list-style: none;
  padding: 6px 0;
}

.layer-item {
  padding: 0 12px;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f8;
}

.layer-item:last-child .layer-row {
  border-bottom: none;
}

.layer-swatch {
  flex-shrink: 0;
  width: 20px;
  height: 14px;
  border-radius: 2px;
}

.layer-name {
  flex: 1;
  font-size: 13px;
  color: #2a2a4c;
}

.layer-count {
  font-size: 11px;
  color: #9090b0;
}

/* Toggle switch */
.toggle {
  flex-shrink: 0;
  position: relative;
  width: 30px;
  height: 16px;
  border-radius: 8px;
  background: #ccc;
  transition: background 0.2s;
  cursor: pointer;
}

.toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle.on {
  background: #3d5af1;
}

.toggle.on::after {
  transform: translateX(14px);
}
</style>
