<template>
  <Teleport to="body">
    <Transition name="pm-fade">
      <div v-if="visible" class="pm-overlay" @click.self="close">
        <div class="pm-card" @keydown.escape="close">
          <!-- Header -->
          <div class="pm-header">
            <div class="pm-header-left">
              <svg class="pm-cam-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <div>
                <div class="pm-road-code">{{ props.Codigovia || '—' }}</div>
                <div class="pm-road-name">{{ props.Municipio || 'Foto de vía' }}</div>
              </div>
            </div>
            <button class="pm-close-btn" @click="close" title="Cerrar (Esc)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Photo area -->
          <div class="pm-photo-wrap">
            <!-- Loading -->
            <div v-if="loading" class="pm-state">
              <div class="pm-spinner" />
              <span>Cargando foto...</span>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="pm-state pm-error-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ error }}</span>
            </div>

            <!-- Image -->
            <template v-else-if="photos.length">
              <img
                :key="photos[photoIdx].url"
                :src="photos[photoIdx].url"
                :alt="photos[photoIdx].name"
                class="pm-img"
                @error="imgError = true"
              />
              <div v-if="imgError" class="pm-state pm-error-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>No se pudo cargar la imagen</span>
              </div>

              <!-- Navigation -->
              <div v-if="photos.length > 1" class="pm-nav">
                <button class="pm-nav-btn" :disabled="photoIdx === 0" @click="prevPhoto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span class="pm-nav-count">{{ photoIdx + 1 }} / {{ photos.length }}</span>
                <button class="pm-nav-btn" :disabled="photoIdx === photos.length - 1" @click="nextPhoto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
              <div class="pm-photo-name">{{ photos[photoIdx].name }}</div>
            </template>

            <!-- No photos -->
            <div v-else class="pm-state pm-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Sin fotos adjuntas</span>
            </div>
          </div>

          <!-- Properties -->
          <div class="pm-props">
            <table class="pm-table">
              <tbody>
                <tr v-if="props.Fecha">
                  <td class="pk">Fecha</td>
                  <td class="pv">{{ formatDate(props.Fecha) }}</td>
                </tr>
                <tr v-if="props.Numpr">
                  <td class="pk">Abscisa</td>
                  <td class="pv mono">{{ props.Numpr }}</td>
                </tr>
                <tr v-if="props.Calzada">
                  <td class="pk">Calzada</td>
                  <td class="pv">{{ props.Calzada }}</td>
                </tr>
                <tr v-if="props.Municipio">
                  <td class="pk">Municipio</td>
                  <td class="pv">{{ props.Municipio }}</td>
                </tr>
                <tr v-if="props.Departam">
                  <td class="pk">Departamento</td>
                  <td class="pv">{{ props.Departam }}</td>
                </tr>
                <tr v-if="props.Obs">
                  <td class="pk">Observaciones</td>
                  <td class="pv">{{ props.Obs }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePhotoStore } from '../stores/photoStore'

const photoStore = usePhotoStore()
const { visible, loading, feature, photos, photoIdx, error } = storeToRefs(photoStore)
const { close, prevPhoto, nextPhoto } = photoStore

const imgError = ref(false)

// Reset image error when photo changes
watch(photoIdx, () => { imgError.value = false })
watch(visible,  () => { imgError.value = false })

const props = computed(() => feature.value?.properties ?? {})

function formatDate(raw) {
  if (!raw) return ''
  // ArcGIS epoch ms or ISO string
  try {
    const d = typeof raw === 'number' ? new Date(raw) : new Date(raw)
    return isNaN(d) ? raw : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return raw
  }
}
</script>

<style scoped>
.pm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 20, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}

.pm-card {
  background: #1a1a2e;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.04);
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  overflow: hidden;
}

/* Header */
.pm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(139, 92, 246, 0.12);
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  flex-shrink: 0;
}

.pm-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pm-cam-icon {
  width: 22px;
  height: 22px;
  color: #a78bfa;
  flex-shrink: 0;
}

.pm-road-code {
  font-size: 10px;
  font-weight: 800;
  font-family: 'Courier New', monospace;
  color: #a78bfa;
  letter-spacing: 0.06em;
}

.pm-road-name {
  font-size: 14px;
  font-weight: 600;
  color: #e2e2f0;
  margin-top: 1px;
}

.pm-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: rgba(255,255,255,0.06);
  color: #a0a0c0;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.pm-close-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.pm-close-btn svg { width: 15px; height: 15px; }

/* Photo area */
.pm-photo-wrap {
  position: relative;
  background: #0d0d1a;
  min-height: 200px;
  max-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.pm-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  max-height: 420px;
}

/* States */
.pm-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 24px;
  color: #7070a0;
  text-align: center;
  font-size: 13px;
}
.pm-state svg { width: 40px; height: 40px; opacity: 0.5; }
.pm-error-state { color: #f87171; }
.pm-error-state svg { opacity: 0.7; }
.pm-empty-state svg { width: 48px; height: 48px; }

/* Spinner */
.pm-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: pm-spin 0.8s linear infinite;
}
@keyframes pm-spin { to { transform: rotate(360deg); } }

/* Navigation */
.pm-nav {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 4px 12px;
}

.pm-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.1);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}
.pm-nav-btn:hover:not(:disabled) { background: rgba(139,92,246,0.5); }
.pm-nav-btn:disabled { opacity: 0.3; cursor: default; }
.pm-nav-btn svg { width: 14px; height: 14px; }

.pm-nav-count {
  font-size: 12px;
  font-weight: 600;
  color: #e0e0f0;
  min-width: 40px;
  text-align: center;
}

.pm-photo-name {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  background: rgba(0,0,0,0.4);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Properties table */
.pm-props {
  overflow-y: auto;
  padding: 12px 16px;
  flex-shrink: 1;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.pm-table {
  width: 100%;
  border-collapse: collapse;
}

.pm-table tr { border-bottom: 1px solid rgba(255,255,255,0.05); }
.pm-table tr:last-child { border-bottom: none; }

.pk {
  padding: 7px 10px 7px 0;
  color: #7070a0;
  font-size: 11.5px;
  font-weight: 500;
  width: 110px;
  vertical-align: middle;
}

.pv {
  padding: 7px 0;
  color: #c8c8e8;
  font-size: 12.5px;
  vertical-align: middle;
  word-break: break-word;
}

.pv.mono {
  font-family: 'Courier New', monospace;
  color: #a78bfa;
  font-weight: 700;
}

/* Transition */
.pm-fade-enter-active, .pm-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.23, 1, 0.32, 1);
}
.pm-fade-enter-active .pm-card, .pm-fade-leave-active .pm-card {
  transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms;
}
.pm-fade-enter-from, .pm-fade-leave-to { opacity: 0; }
.pm-fade-enter-from .pm-card, .pm-fade-leave-to .pm-card {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
