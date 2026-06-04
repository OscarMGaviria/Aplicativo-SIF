import { watch } from 'vue'
import { useMapStore } from '../stores/mapStore'
import { useUiStore } from '../stores/uiStore'

const SVG = {
  layers: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">
    <polygon points="10 2 2 6 10 10 18 6 10 2"/>
    <polyline points="2 14 10 18 18 14"/>
    <polyline points="2 10 10 14 18 10"/>
  </svg>`,
  points: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2C7.24 2 5 4.24 5 7c0 3.94 5 9 5 9s5-5.06 5-9c0-2.76-2.24-5-5-5z"/>
    <circle cx="10" cy="7" r="2"/>
  </svg>`
}

// Builds a single MapLibre IControl group with multiple toggle buttons
function buildPanelControl(buttons) {
  const unwatchers = []

  return {
    onAdd() {
      const group = document.createElement('div')
      group.className = 'maplibregl-ctrl maplibregl-ctrl-group'

      for (const { icon, title, getOpen, toggle } of buttons) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.title = title
        btn.className = 'map-panel-btn'
        btn.innerHTML = icon
        if (getOpen()) btn.classList.add('active')

        btn.addEventListener('click', toggle)

        // Keep active CSS in sync with Pinia store — watch works outside components
        unwatchers.push(
          watch(getOpen, val => btn.classList.toggle('active', val))
        )

        group.appendChild(btn)
      }

      this._container = group
      return group
    },

    onRemove() {
      unwatchers.forEach(u => u())
      this._container?.parentNode?.removeChild(this._container)
    }
  }
}

export function useMapControls() {
  const mapStore = useMapStore()
  const uiStore  = useUiStore()

  function addPanelControls() {
    const map = mapStore.instance
    if (!map) return

    const ctrl = buildPanelControl([
      {
        icon:    SVG.layers,
        title:   'Capas',
        getOpen: () => uiStore.layerPanelOpen,
        toggle:  () => { uiStore.layerPanelOpen = !uiStore.layerPanelOpen }
      },
      {
        icon:    SVG.points,
        title:   'Puntos',
        getOpen: () => uiStore.coordsPanelOpen,
        toggle:  () => { uiStore.coordsPanelOpen = !uiStore.coordsPanelOpen }
      }
    ])

    map.addControl(ctrl, 'top-right')
  }

  return { addPanelControls }
}
