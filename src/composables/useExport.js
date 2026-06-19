import { useMapStore } from '../stores/mapStore'
import { useLayerStore } from '../stores/layerStore'
import { useExportStore } from '../stores/exportStore'
import { useCoordStore } from '../stores/coordStore'
import JSZip from 'jszip'
import * as turf from '@turf/turf'

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export function useExport() {
  const mapStore = useMapStore()
  const layerStore = useLayerStore()
  const exportStore = useExportStore()
  const coordStore = useCoordStore()

  function escapeXml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  }


  function initExportLayers() {
    const map = mapStore.instance
    if (!map) return

    if (!map.getSource('export-vias')) {
      map.addSource('export-vias', { type: 'geojson', data: EMPTY_FC })
    }

    const beforeId = map.getLayer('query-hover') ? 'query-hover' : undefined

    if (!map.getLayer('export-vias-glow')) {
      map.addLayer({
        id: 'export-vias-glow',
        type: 'line',
        source: 'export-vias',
        paint: {
          'line-color': '#a855f7',
          'line-width': 9,
          'line-opacity': 0.35,
          'line-blur': 2
        }
      }, beforeId)
    }

    if (!map.getLayer('export-vias-line')) {
      map.addLayer({
        id: 'export-vias-line',
        type: 'line',
        source: 'export-vias',
        paint: {
          'line-color': '#a855f7',
          'line-width': 3.5,
          'line-opacity': 0.9
        }
      }, beforeId)
    }
  }

  function updateExportMapSource() {
    const map = mapStore.instance
    if (!map) return
    const src = map.getSource('export-vias')
    if (!src) return

    const roads = exportStore.selectedRoads
    if (!roads.length) {
      src.setData(EMPTY_FC)
      return
    }

    const features = roads.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: r.chainedCoords
      },
      properties: {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre
      }
    }))

    src.setData({
      type: 'FeatureCollection',
      features
    })
  }

  function getLayerLabel(layerId) {
    if (layerId === 'primaria') return 'Red Primaria'
    if (layerId === 'secundaria') return 'Red Secundaria'
    if (layerId === 'terciaria') return 'Red Terciaria'
    const custom = layerStore.customLayers.find(l => l.id === layerId)
    return custom ? custom.label : (layerId || 'Red Vial')
  }

  function getLayerStyle(layerId) {
    if (layerId === 'primaria') return { color: '#dc2626', width: 3.5 }
    if (layerId === 'secundaria') return { color: '#2563eb', width: 2.0 }
    if (layerId === 'terciaria') return { color: '#16a34a', width: 1.5 }
    const custom = layerStore.customLayers.find(l => l.id === layerId)
    if (custom && custom.style && custom.style.color) {
      return { color: custom.style.color, width: custom.style.width || 3.5 }
    }
    return { color: '#06b6d4', width: 3.5 }
  }

  function exportToIllustrator() {
    const roads = exportStore.selectedRoads
    if (!roads.length) return

    // 1. Gather all points from municipalities to scale the canvas to the entire department of Antioquia.
    // This keeps the map scale and alignment uniform across different downloads.
    const allPoints = []
    const muniData = layerStore._cache['municipios']
    if (muniData && muniData.features) {
      for (const muni of muniData.features) {
        const geom = muni.geometry
        if (geom.type === 'Polygon') {
          for (const ring of geom.coordinates) {
            for (const coord of ring) {
              const x = (coord[0] * Math.PI) / 180
              const latRad = (coord[1] * Math.PI) / 180
              const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
              allPoints.push({ x, y })
            }
          }
        } else if (geom.type === 'MultiPolygon') {
          for (const poly of geom.coordinates) {
            for (const ring of poly) {
              for (const coord of ring) {
                const x = (coord[0] * Math.PI) / 180
                const latRad = (coord[1] * Math.PI) / 180
                const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
                allPoints.push({ x, y })
              }
            }
          }
        }
      }
    }

    // Fallback to roads if municipalities are not loaded yet
    if (allPoints.length === 0) {
      for (const r of roads) {
        for (const coord of r.chainedCoords) {
          const x = (coord[0] * Math.PI) / 180
          const latRad = (coord[1] * Math.PI) / 180
          const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
          allPoints.push({ x, y })
        }
      }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const p of allPoints) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }

    const dx = maxX - minX
    const dy = maxY - minY

    // 2. Define standard SVG dimensions (conformal and centered)
    const width = 1200
    const height = 800
    const canvasAspect = width / height

    // Apply a 10% margin padding to the Mercator bounds to keep roads away from edges
    const marginX = dx * 0.1 || 0.0001
    const marginY = dy * 0.1 || 0.0001
    let padMinX = minX - marginX
    let padMaxX = maxX + marginX
    let padMinY = minY - marginY
    let padMaxY = maxY + marginY

    const paddedDx = padMaxX - padMinX
    const paddedDy = padMaxY - padMinY
    const paddedAspect = paddedDx / (paddedDy || 0.0001)

    // Expand bounding box dimensions to match canvas aspect ratio without stretching the map coordinates
    if (paddedAspect > canvasAspect) {
      // Road bounding box is wider than canvas ratio -> fit width, expand height
      const targetDy = paddedDx / canvasAspect
      const yCenter = (padMinY + padMaxY) / 2
      padMinY = yCenter - targetDy / 2
      padMaxY = yCenter + targetDy / 2
    } else {
      // Road bounding box is taller than canvas ratio -> fit height, expand width
      const targetDx = paddedDy * canvasAspect
      const xCenter = (padMinX + padMaxX) / 2
      padMinX = xCenter - targetDx / 2
      padMaxX = xCenter + targetDx / 2
    }

    const finalDx = padMaxX - padMinX
    const finalDy = padMaxY - padMinY

    // 3. Projection function using adjusted padded coordinates (both X and Y in radians)
    function project(lon, lat) {
      const x = (lon * Math.PI) / 180
      const latRad = (lat * Math.PI) / 180
      const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2))

      const svgX = finalDx > 0 ? ((x - padMinX) / finalDx) * width : width / 2
      const svgY = finalDy > 0 ? (1 - (y - padMinY) / finalDy) * height : height / 2

      return [svgX, svgY]
    }

    // 4. Group roads by layer label for Illustrator layers
    const groups = {}
    for (const r of roads) {
      const label = getLayerLabel(r.layerId)
      if (!groups[label]) groups[label] = []
      groups[label].push(r)
    }

    // 5. Generate SVG content with standard 1200x800 dimensions
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`
    svg += `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n`
    svg += `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" version="1.1">\n`
    svg += `  <rect width="100%" height="100%" fill="none" />\n`

    // 5a. Add All Municipalities of Antioquia background layer
    const munis = layerStore._cache['municipios']?.features || []
    if (munis.length > 0) {
      svg += `  <!-- Illustrator Layer: Municipios de Antioquia -->\n`
      svg += `  <g id="Municipios_Antioquia" fill="none" stroke="#cbd5e1" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round">\n`
      for (const m of munis) {
        let pathD = ''
        const geom = m.geometry
        if (geom.type === 'Polygon') {
          for (const ring of geom.coordinates) {
            let ringD = ''
            for (const coord of ring) {
              const [sx, sy] = project(coord[0], coord[1])
              ringD += `${ringD === '' ? 'M' : 'L'}${sx.toFixed(2)},${sy.toFixed(2)} `
            }
            pathD += ringD.trim() + ' Z '
          }
        } else if (geom.type === 'MultiPolygon') {
          for (const poly of geom.coordinates) {
            for (const ring of poly) {
              let ringD = ''
              for (const coord of ring) {
                const [sx, sy] = project(coord[0], coord[1])
                ringD += `${ringD === '' ? 'M' : 'L'}${sx.toFixed(2)},${sy.toFixed(2)} `
              }
              pathD += ringD.trim() + ' Z '
            }
          }
        }

        if (pathD) {
          const muniId = `muni_${m.properties.COD_MPIO}`
          const muniName = ` name="${escapeXml(m.properties.MPIO_NOMBR)}"`
          svg += `    <path d="${pathD.trim()}" id="${muniId}"${muniName} />\n`
        }
      }
      svg += `  </g>\n`
    }

    for (const [label, roadsInGroup] of Object.entries(groups)) {
      const layerName = label.replace(/[^\w\s-]/g, '').trim()
      const style = getLayerStyle(roadsInGroup[0].layerId)
      
      svg += `  <!-- Illustrator Layer: ${label} -->\n`
      svg += `  <g id="${layerName}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round">\n`

      for (const r of roadsInGroup) {
        let pathD = ''
        for (const coord of r.chainedCoords) {
          const [sx, sy] = project(coord[0], coord[1])
          pathD += `${pathD === '' ? 'M' : 'L'}${sx.toFixed(2)},${sy.toFixed(2)} `
        }

        const roadId = `via_${r.codigo || r.id}`.replace(/[^\w-]/g, '_')
        const roadName = r.nombre ? ` name="${r.nombre}"` : ''
        const roadCode = r.codigo ? ` code="${r.codigo}"` : ''

        svg += `    <path d="${pathD.trim()}" id="${roadId}"${roadName}${roadCode} />\n`
      }

      svg += `  </g>\n`
    }

    svg += `</svg>\n`

    // 6. Trigger download
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vias_exportadas_${Date.now()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportToGeoJSON() {
    const roads = exportStore.selectedRoads
    const points = coordStore.points
    if (!roads.length && !points.length) return

    const roadFeatures = roads.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: r.chainedCoords
      },
      properties: {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        tipo_via: getLayerLabel(r.layerId),
        longitud_km: r.totalKm,
        tipo_exportacion: 'via',
        ...(r.properties || {})
      }
    }))

    const pointFeatures = points.map(p => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat]
      },
      properties: {
        id: p.id,
        nombre: p.name || `Punto ${p.idx || ''}`,
        tipo_exportacion: 'punto_creado',
        via_cercana: p.nearestRoad || '',
        id_capa_via: p.layerId || '',
        indice: p.idx
      }
    }))

    const geojson = {
      type: 'FeatureCollection',
      features: [...roadFeatures, ...pointFeatures]
    }

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vias_seleccionadas_${Date.now()}.geojson`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function exportToKMZ() {
    const roads = exportStore.selectedRoads
    if (!roads.length) return

    const groups = {}
    for (const r of roads) {
      const label = getLayerLabel(r.layerId)
      if (!groups[label]) groups[label] = []
      groups[label].push(r)
    }

    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    kml += `<kml xmlns="http://www.opengis.net/kml/2.2">\n`
    kml += `<Document>\n`
    kml += `  <name>Vías Seleccionadas</name>\n`

    // Vías Folders
    for (const [label, roadsInGroup] of Object.entries(groups)) {
      kml += `  <Folder>\n`
      kml += `    <name>${escapeXml(label)}</name>\n`
      for (const r of roadsInGroup) {
        const name = escapeXml(r.nombre || r.codigo || 'Vía')
        
        let descParts = []
        descParts.push(`Código: ${r.codigo || 'N/A'}`)
        descParts.push(`Nombre: ${r.nombre || 'N/A'}`)
        descParts.push(`Longitud: ${r.totalKm ? r.totalKm.toFixed(2) + ' km' : 'N/A'}`)
        
        if (r.properties) {
          Object.entries(r.properties).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') {
              descParts.push(`${k}: ${v}`)
            }
          })
        }
        const desc = escapeXml(descParts.join('\n'))
        const coords = r.chainedCoords.map(c => `${c[0]},${c[1]},0`).join(' ')
        
        kml += `    <Placemark>\n`
        kml += `      <name>${name}</name>\n`
        kml += `      <description>${desc}</description>\n`
        
        if (r.properties) {
          kml += `      <ExtendedData>\n`
          Object.entries(r.properties).forEach(([k, v]) => {
            kml += `        <Data name="${escapeXml(k)}">\n`
            kml += `          <value>${escapeXml(v)}</value>\n`
            kml += `        </Data>\n`
          })
          kml += `      </ExtendedData>\n`
        }
        
        kml += `      <LineString>\n`
        kml += `        <coordinates>${coords}</coordinates>\n`
        kml += `      </LineString>\n`
        kml += `    </Placemark>\n`
      }
      kml += `  </Folder>\n`
    }

    // No municipalities folder! Only roads!

    kml += `</Document>\n`
    kml += `</kml>`

    const zip = new JSZip()
    zip.file('doc.kml', kml)
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vias_seleccionadas_${Date.now()}.kmz`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return {
    initExportLayers,
    updateExportMapSource,
    exportToIllustrator,
    exportToGeoJSON,
    exportToKMZ
  }
}
