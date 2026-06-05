<template>
  <transition name="wm-fade">
    <div v-if="visible" class="wm-overlay" @click.self="dismiss">
      <div class="wm-card">
        <div class="wm-header">
          <span class="wm-badge">En Desarrollo</span>
          <h1 class="wm-title">Red Vial del Departamento de Antioquia</h1>
          <p class="wm-sub">Sistema de Información de Abscisas</p>
        </div>

        <p class="wm-desc">
          Este aplicativo se encuentra actualmente en <strong>desarrollo activo</strong>.
          Permite realizar consultas sobre la red vial de Antioquia y será actualizado
          constantemente con nuevas funcionalidades y datos.
        </p>

        <div class="wm-features">
          <div class="wm-feat">
            <span class="wm-feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </span>
            <div>
              <strong>Búsqueda por vía</strong>
              <span>Encuentra vías por nombre o código oficial</span>
            </div>
          </div>
          <div class="wm-feat">
            <span class="wm-feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
                <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
              </svg>
            </span>
            <div>
              <strong>Búsqueda por código de vía</strong>
              <span>Consulta directa usando el código oficial de la red vial</span>
            </div>
          </div>
          <div class="wm-feat">
            <span class="wm-feat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              </svg>
            </span>
            <div>
              <strong>Búsqueda por coordenadas</strong>
              <span>Grados decimales o grados, minutos y segundos (GMS)</span>
            </div>
          </div>
        </div>

        <button class="wm-btn" @click="dismiss">Comenzar</button>

        <p class="wm-dev">Desarrollado por Oscar Marquez</p>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue'

const visible = ref(true)

function dismiss() {
  visible.value = false
}
</script>

<style scoped>
.wm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(60, 60, 100, 0.35);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.wm-card {
  background: #ffffff;
  border: 1px solid #d8d8e8;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.wm-header {
  background: #eeeef8;
  border-bottom: 1px solid #d8d8e8;
  padding: 24px 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wm-badge {
  display: inline-flex;
  align-self: flex-start;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.wm-title {
  font-size: 18px;
  font-weight: 800;
  color: #2a2a4c;
  line-height: 1.25;
  margin: 0;
}

.wm-sub {
  font-size: 12.5px;
  color: #3d5af1;
  font-weight: 600;
  margin: 0;
}

.wm-desc {
  font-size: 13px;
  color: #5050a0;
  line-height: 1.6;
  padding: 20px 28px 0;
}
.wm-desc strong { color: #2a2a4c; }

.wm-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 28px;
}

.wm-feat {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f8f8fd;
  border: 1px solid #eeeef8;
  border-radius: 10px;
  padding: 11px 14px;
}

.wm-feat-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  background: rgba(61, 90, 241, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3d5af1;
}
.wm-feat-icon svg { width: 15px; height: 15px; }

.wm-feat div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wm-feat strong {
  font-size: 12.5px;
  font-weight: 700;
  color: #2a2a4c;
}
.wm-feat span {
  font-size: 12px;
  color: #7070a0;
}

.wm-btn {
  margin: 4px 28px 20px;
  padding: 12px;
  background: linear-gradient(135deg, #3d5af1, #2541d4);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 150ms, transform 150ms;
  box-shadow: 0 4px 12px rgba(61, 90, 241, 0.3);
}
.wm-btn:hover { opacity: 0.92; transform: translateY(-1px); }
.wm-btn:active { transform: scale(0.98); }

.wm-dev {
  text-align: center;
  font-size: 11px;
  color: #b0b0c8;
  padding: 0 28px 20px;
  margin: 0;
  border-top: 1px solid #eeeef8;
  padding-top: 14px;
}

.wm-fade-enter-active,
.wm-fade-leave-active {
  transition: opacity 250ms ease, transform 250ms ease;
}
.wm-fade-enter-from,
.wm-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
