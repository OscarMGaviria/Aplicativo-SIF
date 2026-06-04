<template>
  <div ref="containerRef" class="basemap-wrapper">
    <!-- Trigger Button -->
    <button 
      class="basemap-trigger" 
      :class="{ open: isOpen }"
      @click="isOpen = !isOpen"
      title="Cambiar mapa base"
    >
      <svg class="map-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <transition name="fade-scale">
      <div v-if="isOpen" class="basemap-menu">
        <div class="menu-title">MAPA BASE</div>
        <div class="menu-options">
          <button
            v-for="bm in BASE_MAPS"
            :key="bm.id"
            class="menu-item"
            :class="{ active: currentBaseMap === bm.id }"
            @click="selectBaseMap(bm.id)"
          >
            <span class="indicator" />
            <span class="label">{{ bm.label }}</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '../stores/mapStore'
import { useMap, BASE_MAPS } from '../composables/useMap'

const { currentBaseMap } = storeToRefs(useMapStore())
const { setBaseMap } = useMap()

const isOpen = ref(false)
const containerRef = ref(null)

function selectBaseMap(id) {
  setBaseMap(id)
  isOpen.value = false
}

// Click outside handler
const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.basemap-wrapper {
  position: relative;
  display: inline-block;
}

/* Trigger Button */
.basemap-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 29px;
  height: 29px;
  border-radius: 4px;
  background: #ffffff;
  border: none;
  color: #555555;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.basemap-trigger:hover {
  background: #f4f4f4;
  color: #222;
}

.basemap-trigger:active {
  transform: scale(0.95);
}

.basemap-trigger.open {
  background: #eef1ff;
  color: #3d5af1;
}

.map-icon {
  width: 17px;
  height: 17px;
  display: block;
}

/* Dropdown Menu */
.basemap-menu {
  position: absolute;
  bottom: 36px;
  right: 0;
  width: 160px;
  background: rgba(22, 22, 42, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  padding: 8px;
  z-index: 100;
  transform-origin: bottom right;
}

.menu-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6a8fff;
  padding: 4px 8px 8px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 6px;
}

.menu-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #c0c0d8;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
              color 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-item.active {
  background: rgba(61, 90, 241, 0.15);
  color: #8fa3ff;
  font-weight: 500;
}

.indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
              box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.menu-item.active .indicator {
  background: #3d5af1;
  box-shadow: 0 0 8px #3d5af1;
}

.label {
  flex: 1;
}

/* Animations */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 180ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.92) translate(4px, 4px);
}
</style>
