<template>
  <div class="project-controls">
    <button class="ctrl-btn" @click="saveProject" title="Guardar proyecto">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      Guardar
    </button>

    <label class="ctrl-btn" title="Cargar proyecto o importar datos (.json, .geojson, .kml, .kmz)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      Cargar
      <input
        type="file"
        accept=".json,application/json,.geojson,application/geo+json,.kml,application/vnd.google-earth.kml+xml,.kmz,application/vnd.google-earth.kmz,*/*"
        @change="onFileChange"
      />
    </label>

    <!-- Custom Error Modal -->
    <transition name="fade-scale">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-card">
          <div class="modal-header">
            <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span class="modal-title">{{ modalTitle }}</span>
          </div>
          <div class="modal-body">
            <p>{{ modalMsg }}</p>
          </div>
          <div class="modal-footer">
            <button class="close-modal-btn" @click="showModal = false">Aceptar</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useProject } from '../composables/useProject'

const { saveProject, loadProject } = useProject()

const showModal = ref(false)
const modalTitle = ref('')
const modalMsg = ref('')

async function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return

  const ext = '.' + file.name.split('.').pop().toLowerCase()
  const allowed = ['.json', '.geojson', '.kml', '.kmz']

  if (!allowed.includes(ext)) {
    modalTitle.value = 'Formato no permitido'
    modalMsg.value = `El archivo "${file.name}" no es válido. Los formatos permitidos son únicamente: .json, .geojson, .kml y .kmz.`
    showModal.value = true
    e.target.value = ''
    return
  }

  try {
    await loadProject(file)
  } catch (err) {
    console.error(err)
    modalTitle.value = 'Error al cargar'
    modalMsg.value = `No se pudo procesar el archivo: ${err.message}`
    showModal.value = true
  }
  e.target.value = ''
}
</script>

<style scoped>
.project-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #3a3a5c;
  background: transparent;
  color: #c0c0d8;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.ctrl-btn:hover {
  background: #2a2a4c;
  border-color: #5a5aaa;
  color: #fff;
}

.ctrl-btn svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.ctrl-btn input[type="file"] {
  display: none;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(8, 8, 16, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-card {
  background: rgba(22, 22, 42, 0.95);
  border: 1px solid rgba(239, 68, 68, 0.35);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.15);
  border-radius: 12px;
  width: 380px;
  max-width: 90%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: scale-up 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

@keyframes scale-up {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #f87171;
}

.warning-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.modal-body {
  font-size: 13px;
  line-height: 1.5;
  color: #c0c0d8;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.close-modal-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  transition: transform 0.15s, opacity 0.15s;
}

.close-modal-btn:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

.close-modal-btn:active {
  transform: translateY(1px);
}

/* Fade Scale Transition */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
}
</style>
