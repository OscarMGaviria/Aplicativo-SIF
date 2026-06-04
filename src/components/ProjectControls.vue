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

    <label class="ctrl-btn" title="Cargar proyecto">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      Cargar
      <input type="file" accept=".json" @change="onFileChange" />
    </label>
  </div>
</template>

<script setup>
import { useProject } from '../composables/useProject'

const { saveProject, loadProject } = useProject()

async function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  await loadProject(file)
  e.target.value = ''
}
</script>

<style scoped>
.project-controls {
  display: flex;
  align-items: center;
  gap: 4px;
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
</style>
