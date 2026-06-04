import * as turf from '@turf/turf'

const CONNECT_TOLERANCE_KM = 0.1

export function formatPK(meters) {
  const totalM = Math.round(meters)
  const km = Math.floor(totalM / 1000)
  const m = totalM % 1000
  return `k${km}+${String(m).padStart(3, '0')}`
}

export function parsePK(str) {
  const s = String(str).trim()
  // Formato k5+350 o 5+350
  const fmtMatch = s.match(/^k?(\d+)\+(\d+)$/i)
  if (fmtMatch) return parseInt(fmtMatch[1]) * 1000 + parseInt(fmtMatch[2])
  // k5350 sin + (prefijo visual sin separador): tratar dígitos como metros
  const kDigitsMatch = s.match(/^k(\d+)$/i)
  if (kDigitsMatch) return parseInt(kDigitsMatch[1])
  // Entero simple: se interpreta directamente como metros (ej. 3745 → k3+745)
  const num = parseFloat(s)
  if (!isNaN(num) && num >= 0) return Math.round(num)
  return null
}

// Strip Z / null values — turf.js requires [lng, lat] only
function c2(coords) {
  return coords.map(c => [c[0], c[1]])
}

function ptDist(a, b) {
  return turf.distance(turf.point(a), turf.point(b), { units: 'kilometers' })
}

// Orders and chains multiple LineString/MultiLineString features into a single coordinate array
// following geographic continuity (no ORDEN field dependency)
export function chainSegments(features) {
  if (features.length === 0) return null

  // Flatten any MultiLineStrings or LineStrings into individual LineString coordinate arrays
  const segs = []
  for (const f of features) {
    if (!f.geometry) continue
    if (f.geometry.type === 'MultiLineString') {
      for (const line of f.geometry.coordinates) {
        if (line && line.length > 0) {
          segs.push({
            coords: c2(line),
            used: false
          })
        }
      }
    } else if (f.geometry.type === 'LineString') {
      if (f.geometry.coordinates && f.geometry.coordinates.length > 0) {
        segs.push({
          coords: c2(f.geometry.coordinates),
          used: false
        })
      }
    }
  }

  if (segs.length === 0) return null
  if (segs.length === 1) return segs[0].coords

  // Find starting segment: its start point is not the end of any other segment
  function findStart() {
    for (let i = 0; i < segs.length; i++) {
      const startPt = segs[i].coords[0]
      const isEndOfOther = segs.some((s, j) => j !== i &&
        ptDist(startPt, s.coords[s.coords.length - 1]) < CONNECT_TOLERANCE_KM)
      if (!isEndOfOther) return { idx: i, reverse: false }
    }
    // Try reversed: find segment whose end is not the end of any other
    for (let i = 0; i < segs.length; i++) {
      const endPt = segs[i].coords[segs[i].coords.length - 1]
      const isEndOfOther = segs.some((s, j) => j !== i &&
        ptDist(endPt, s.coords[s.coords.length - 1]) < CONNECT_TOLERANCE_KM)
      if (!isEndOfOther) return { idx: i, reverse: true }
    }
    return { idx: 0, reverse: false }
  }

  const { idx: startIdx, reverse: startReverse } = findStart()
  segs[startIdx].used = true
  let chain = startReverse
    ? [...segs[startIdx].coords].reverse()
    : [...segs[startIdx].coords]

  while (segs.some(s => !s.used)) {
    const lastPt = chain[chain.length - 1]
    let bestSeg = null, bestDist = Infinity, bestReverse = false

    for (const seg of segs) {
      if (seg.used) continue
      const dStart = ptDist(lastPt, seg.coords[0])
      const dEnd = ptDist(lastPt, seg.coords[seg.coords.length - 1])
      if (dStart < bestDist) { bestDist = dStart; bestSeg = seg; bestReverse = false }
      if (dEnd < bestDist) { bestDist = dEnd; bestSeg = seg; bestReverse = true }
    }

    if (!bestSeg) break
    bestSeg.used = true
    const coords = bestReverse ? [...bestSeg.coords].reverse() : bestSeg.coords
    chain = [...chain, ...coords.slice(1)]
  }

  return chain
}

export function getAbscissaAtPoint(lng, lat, chainedCoords) {
  const line = turf.lineString(chainedCoords)
  const snapped = turf.nearestPointOnLine(line, turf.point([lng, lat]), { units: 'kilometers' })
  const pkMeters = snapped.properties.location * 1000

  return {
    pk: pkMeters,
    formatted: formatPK(pkMeters),
    snappedCoords: snapped.geometry.coordinates,
    distFromLine: snapped.properties.dist
  }
}

export function getPointAtPK(pkMeters, chainedCoords) {
  const line = turf.lineString(chainedCoords)
  const totalKm = turf.length(line, { units: 'kilometers' })
  if (pkMeters / 1000 > totalKm) return null
  return turf.along(line, pkMeters / 1000, { units: 'kilometers' }).geometry.coordinates
}

export function getTotalLengthKm(chainedCoords) {
  return turf.length(turf.lineString(chainedCoords), { units: 'kilometers' })
}
