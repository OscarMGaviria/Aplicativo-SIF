<template>
  <div class="app">
    <!-- Fullscreen Loading Overlay -->
    <transition name="fade-overlay">
      <div v-if="!isReady" class="loading-overlay">
        <div class="loading-container">
          <div class="loader-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pulse-icon">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 class="loading-title">Abscisas Red Vial</h1>
          <p class="loading-subtitle">Cargando capas y cartografía de Antioquia...</p>
          
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          
          <div class="progress-info">
            <span class="progress-percentage">{{ progressPercent }}%</span>
            <span class="loading-status">{{ currentLoadingLabel }}</span>
          </div>
        </div>
      </div>
    </transition>

    <WelcomeModal v-if="isReady" />
    <AppToolbar />

    <div class="workspace">
      <div class="map-wrapper">
        <MapCanvas />

        <div class="map-search">
          <AppSearchBar />
        </div>

        <div class="panels-area">
          <LayerPanel  v-if="layerPanelOpen"  @close="layerPanelOpen = false" />
          <CoordsPanel v-if="coordsPanelOpen" @close="coordsPanelOpen = false" />
        </div>

        <div class="map-basemap">
          <BaseMapSelector />
        </div>
      </div>

      <ResultsPanel />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import WelcomeModal  from './components/WelcomeModal.vue'
import AppToolbar    from './components/AppToolbar.vue'
import AppSearchBar  from './components/AppSearchBar.vue'
import MapCanvas     from './components/MapCanvas.vue'
import LayerPanel    from './components/LayerPanel.vue'
import CoordsPanel   from './components/CoordsPanel.vue'
import ResultsPanel  from './components/ResultsPanel.vue'
import BaseMapSelector from './components/BaseMapSelector.vue'
import { useUiStore } from './stores/uiStore'
import { useLayerStore, LAYERS } from './stores/layerStore'

const { layerPanelOpen, coordsPanelOpen } = storeToRefs(useUiStore())
const layerStore = useLayerStore()

const progressPercent = computed(() => {
  const loadedCount = LAYERS.filter(l => layerStore.loaded[l.id]).length
  return Math.round((loadedCount / LAYERS.length) * 100)
})

const currentLoadingLabel = computed(() => {
  const nextLoading = LAYERS.find(l => !layerStore.loaded[l.id])
  return nextLoading ? `Cargando ${nextLoading.label}...` : '¡Listo!'
})

const isReady = computed(() => {
  return progressPercent.value === 100
})
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.map-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.map-search {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  width: 320px;
  pointer-events: all;
}

.panels-area {
  position: absolute;
  top: 66px;
  left: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-height: calc(100% - 78px);
  overflow-y: auto;
}
.panels-area > * { pointer-events: all; }

.map-basemap {
  position: absolute;
  bottom: 32px;
  right: 12px;
  z-index: 10;
  pointer-events: all;
}

/* Loading Overlay styles */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, #0e0e1a 0%, #05050a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 380px;
  max-width: 90%;
  text-align: center;
  padding: 40px;
  border-radius: 16px;
  background: rgba(22, 22, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.loader-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.0) 70%);
  margin-bottom: 24px;
}

.pulse-icon {
  width: 42px;
  height: 42px;
  color: #a855f7;
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0% {
    transform: scale(0.95);
    filter: drop-shadow(0 0 2px rgba(168, 85, 247, 0.4));
  }
  50% {
    transform: scale(1.05);
    filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.8));
  }
  100% {
    transform: scale(0.95);
    filter: drop-shadow(0 0 2px rgba(168, 85, 247, 0.4));
  }
}

.loading-title {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #ffffff 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.loading-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 30px;
}

.progress-bar-wrap {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%);
  border-radius: 10px;
  transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 12px;
  font-weight: 500;
}

.progress-percentage {
  color: #e2e8f0;
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

.loading-status {
  color: #a855f7;
  font-weight: 600;
}

/* Fade overlay transition */
.fade-overlay-enter-active, .fade-overlay-leave-active {
  transition: opacity 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.fade-overlay-enter-from, .fade-overlay-leave-to {
  opacity: 0;
}
</style>
