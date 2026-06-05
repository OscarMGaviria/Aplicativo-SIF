import maplibregl from 'maplibre-gl'
import { useMapStore } from '../stores/mapStore'

const ANTIOQUIA_HOME = { center: [-75.367, 7.27], zoom: 7.63 }

export function flyToAntioquia(map) {
  map.flyTo({
    ...ANTIOQUIA_HOME,
    pitch: 0,
    bearing: 0,
    duration: 1200
  })
}

export const BASE_MAPS = [
  {
    id: 'liberty',
    label: 'Liberty',
    style: 'https://tiles.openfreemap.org/styles/liberty'
  },
  {
    id: 'bright',
    label: 'Bright',
    style: 'https://tiles.openfreemap.org/styles/bright'
  },
  {
    id: 'positron',
    label: 'Positron',
    style: 'https://tiles.openfreemap.org/styles/positron'
  },
  {
    id: 'terrain3d',
    label: 'Terreno 3D',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
          maxzoom: 19
        },
        terrainSource: {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15
        },
        hillshadeSource: {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm'
        },
        {
          id: 'hills',
          type: 'hillshade',
          source: 'hillshadeSource',
          layout: { visibility: 'visible' },
          paint: { 'hillshade-shadow-color': '#473B24' }
        }
      ],
      glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'
    }
  },
  {
    id: 'none',
    label: 'Sin mapa base',
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#e8e8e8' }
        }
      ],
      glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'
    }
  }
]

export function useMap() {
  const store = useMapStore()

  function initMap(container, onStyleReady) {
    const bm = BASE_MAPS.find(m => m.id === store.currentBaseMap) ?? BASE_MAPS[0]
    const isTerrain = store.currentBaseMap === 'terrain3d'

    const map = new maplibregl.Map({
      container,
      style: bm.style,
      center: ANTIOQUIA_HOME.center,
      zoom: ANTIOQUIA_HOME.zoom,
      pitch: 0,
      maxPitch: 85,
      attributionControl: false,
      transformRequest: (url, resourceType) => {
        // Redirect OpenFreeMap font requests to fonts.openmaptiles.org which correctly
        // serves combined fontstacks (e.g. "Open Sans Regular,Arial Unicode MS Regular").
        // OpenFreeMap's CDN returns 404 for combined stacks causing infinite retry cascades.
        if (resourceType === 'Glyphs' && url.includes('tiles.openfreemap.org/fonts/')) {
          const path = url.replace(/^.*tiles\.openfreemap\.org\/fonts\//, '')
          return { url: `https://fonts.openmaptiles.org/${path}` }
        }
        return { url }
      }
    })

    // Dynamically inject terrainSource to any style so TerrainControl is always functional.
    // Also override glyphs to fonts.openmaptiles.org which correctly serves combined font
    // stacks (e.g. "Open Sans Regular,Arial Unicode MS Regular") — OpenFreeMap's own CDN
    // returns 404 for combined stacks, causing infinite retry cascades that freeze the UI.
    map.on('style.load', () => {
      if (!map.getSource('terrainSource')) {
        map.addSource('terrainSource', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15
        })
      }
      if (typeof map.setGlyphs === 'function') {
        map.setGlyphs('https://fonts.openmaptiles.org/{fontstack}/{range}.pbf')
      }
    })

    let isReloading = false
    map.on('idle', async () => {
      if (isReloading) return

      if (!map.getSource('municipios') && onStyleReady) {
        isReloading = true
        try {
          await onStyleReady()
        } catch (err) {
          console.error('Error in onStyleReady callback:', err)
        } finally {
          isReloading = false
        }
      }
    })

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true
      }),
      'top-right'
    )
    map.addControl(
      new maplibregl.TerrainControl({
        source: 'terrainSource',
        exaggeration: 1
      }),
      'top-right'
    )
    map.addControl(
      new maplibregl.ScaleControl({ unit: 'metric' }),
      'bottom-left'
    )
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    )

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') flyToAntioquia(map)
    })

    store.setInstance(map)
    window.map = map
    return map
  }

  function setBaseMap(id) {
    const bm = BASE_MAPS.find(m => m.id === id)
    if (!bm) {
      console.error(`[useMap] No basemap found for id: ${id}`)
      return
    }
    if (!store.instance) {
      console.error('[useMap] store.instance is null or undefined!')
      return
    }

    // Disable terrain before style change to prevent worker thread conflicts
    store.instance.setTerrain(null)

    store.currentBaseMap = id
    store.instance.setStyle(bm.style)

    if (id === 'terrain3d') {
      store.instance.once('style.load', () => {
        if (store.instance && store.currentBaseMap === 'terrain3d') {
          store.instance.setTerrain({ source: 'terrainSource', exaggeration: 1 })
        }
      })
      store.instance.easeTo({
        pitch: 70,
        duration: 1000
      })
    } else {
      store.instance.easeTo({
        pitch: 0,
        duration: 800
      })
    }
  }

  return { initMap, setBaseMap }
}
