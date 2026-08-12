import proj4 from 'proj4'

// EPSG:9377 - MAGNA-SIRGAS / Origen-Nacional (IGAC)
const MAGNA_SIRGAS_ORIGEN_NACIONAL =
  '+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

export function toMagnaSirgasOrigenNacional(lng, lat) {
  const [x, y] = proj4('WGS84', MAGNA_SIRGAS_ORIGEN_NACIONAL, [lng, lat])
  return { x, y }
}

export function formatDualCoords(lng, lat) {
  const { x, y } = toMagnaSirgasOrigenNacional(lng, lat)
  return `WGS84: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
    `MAGNA-SIRGAS Origen Nacional: N ${y.toFixed(2)}, E ${x.toFixed(2)}`
}

export async function copyCoordsToClipboard(lng, lat) {
  await navigator.clipboard.writeText(formatDualCoords(lng, lat))
}
