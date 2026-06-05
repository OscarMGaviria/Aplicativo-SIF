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

      <!-- Custom User Layers Section -->
      <template v-if="customLayers.length > 0">
        <li class="section-divider">
          <span>Importaciones</span>
        </li>
        <li v-for="layer in customLayers" :key="layer.id" class="layer-item">
          <div class="layer-row custom-layer-row" @click="toggle(layer.id)">
            <span class="layer-swatch" :style="customSwatchStyle(layer)" />
            <span class="layer-name" :title="layer.label">{{ layer.label }}</span>
            <span class="layer-count">{{ layer.featuresCount }}</span>
            <div class="action-buttons">
              <!-- Select / Zoom to layer bounds -->
              <button class="action-btn zoom-btn" @click.stop="zoomToCustomLayer(layer)" title="Centrar mapa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <!-- Delete/Remove imported layer -->
              <button class="action-btn delete-btn" @click.stop="removeCustomLayer(layer.id)" title="Eliminar capa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <span class="toggle" :class="{ on: visibility[layer.id] }" @click.stop="toggle(layer.id)" />
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup>
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
const { setLayerVisibility, deleteCustomLayer } = useLayers()

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

function customSwatchStyle(layer) {
  if (layer.type === 'kml') {
    return {
      background: '#06b6d4', // Cyan
      border: '2px solid #ffffff',
      boxShadow: '0 0 0 1px #0891b2',
      borderRadius: '3px',
      width: '20px',
      height: '14px'
    }
  }
  return {
    background: '#e11d48', // Rose/pink
    border: '2px solid #ffffff',
    boxShadow: '0 0 0 1px #be123c',
    borderRadius: '3px',
    width: '20px',
    height: '14px'
  }
}

function zoomToCustomLayer(layer) {
  const map = mapStore.instance
  if (!map) return

  if (layer.type === 'kml') {
    const features = []
    coordStore.kmlLines.forEach(l => {
      features.push(turf.lineString(l.coordinates))
    })
    coordStore.kmlPolygons.forEach(p => {
      features.push(turf.polygon(p.coordinates))
    })
    if (features.length > 0) {
      const fc = turf.featureCollection(features)
      const bbox = turf.bbox(fc)
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
    }
  } else if (layer.type === 'geojson') {
    const data = layerStore._cache[layer.id]
    if (data) {
      const bbox = turf.bbox(data)
      map.fitBounds(bbox, { padding: 80, maxZoom: 14 })
    }
  }
}

function removeCustomLayer(id) {
  deleteCustomLayer(id)
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-count {
  font-size: 11px;
  color: #9090b0;
  margin-right: 4px;
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

/* Custom User Layers Styles */
.section-divider {
  display: flex;
  align-items: center;
  padding: 8px 12px 4px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8080a0;
  border-top: 1px dashed #d8d8e8;
  margin-top: 6px;
}

.custom-layer-row {
  cursor: pointer;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.2;
  transition: opacity 0.15s;
}

.custom-layer-row:hover .action-buttons {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #555577;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.action-btn svg {
  width: 12px;
  height: 12px;
}

.zoom-btn:hover {
  background: #eef2ff;
  color: #3d5af1;
}

.delete-btn:hover {
  background: #fef2f2;
  color: #ef4444;
}
</style>
