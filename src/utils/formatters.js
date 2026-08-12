export function escapeXml(unsafe) {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function formatPK(meters) {
  if (meters == null || isNaN(meters)) return 'N/A'
  const absMeters = Math.abs(meters)
  const km = Math.floor(absMeters / 1000)
  const m = (absMeters % 1000).toFixed(2)
  const sign = meters < 0 ? '-' : ''
  return `${sign}k${km}+${m.padStart(6, '0')}`
}
