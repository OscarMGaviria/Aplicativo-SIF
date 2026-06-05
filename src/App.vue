<template>
  <div class="app">
    <WelcomeModal />
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

const { layerPanelOpen, coordsPanelOpen } = storeToRefs(useUiStore())
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

</style>
