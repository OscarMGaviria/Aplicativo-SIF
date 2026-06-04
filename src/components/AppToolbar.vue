<template>
  <header class="toolbar">
    <div class="toolbar-brand">
      <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span class="brand-title">Red Vial del Departamento de Antioquia</span>
    </div>

    <div class="toolbar-actions">
      <ProjectControls />
    </div>
  </header>
</template>

<script setup>
import ProjectControls from './ProjectControls.vue'
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  background: #16162a;
  border-bottom: 1px solid #2a2a4c;
  flex-shrink: 0;
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon { width: 20px; height: 20px; color: #6a8fff; flex-shrink: 0; }

.brand-title {
  font-size: 15px;
  font-weight: 600;
  color: #e0e0f0;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
