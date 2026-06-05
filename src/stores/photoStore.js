import { defineStore } from 'pinia'
import { ref } from 'vue'

export const FOTO_SERVICE_URL =
  'https://services5.arcgis.com/K90UQIB09TmTjUL8/arcgis/rest/services/Foto/FeatureServer/0'

export const usePhotoStore = defineStore('photo', () => {
  const visible    = ref(false)
  const loading    = ref(false)
  const feature    = ref(null)   // { properties, coords }
  const photos     = ref([])     // [{ id, url, name }]
  const photoIdx   = ref(0)
  const error      = ref(null)

  async function openFeature(rawFeature) {
    feature.value  = {
      properties: rawFeature.properties ?? {},
      coords: rawFeature.geometry?.coordinates
    }
    visible.value  = true
    loading.value  = true
    photos.value   = []
    photoIdx.value = 0
    error.value    = null

    const objectId = rawFeature.properties?.OBJECTID
                  ?? rawFeature.properties?.objectid
                  ?? rawFeature.properties?.FID

    if (objectId == null) {
      error.value   = 'No se encontró el ID del registro para cargar las fotos.'
      loading.value = false
      return
    }

    try {
      const res = await fetch(`${FOTO_SERVICE_URL}/${objectId}/attachments?f=json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const infos = Array.isArray(data.attachmentInfos) ? data.attachmentInfos : []

      // Prefer image/* content types; fall back to all attachments
      const imgs = infos.filter(a => /image\//i.test(a.contentType || ''))
      const list = imgs.length ? imgs : infos

      photos.value = list.map(a => ({
        id:   a.id,
        name: a.name || `Foto ${a.id}`,
        url:  `${FOTO_SERVICE_URL}/${objectId}/attachments/${a.id}`
      }))

      if (!photos.value.length) {
        error.value = 'Este punto no tiene fotos adjuntas.'
      }
    } catch (err) {
      error.value = err.message || 'No se pudo cargar la foto.'
    } finally {
      loading.value = false
    }
  }

  function close() {
    visible.value  = false
    feature.value  = null
    photos.value   = []
    error.value    = null
    photoIdx.value = 0
  }

  function prevPhoto() { if (photoIdx.value > 0) photoIdx.value-- }
  function nextPhoto() { if (photoIdx.value < photos.value.length - 1) photoIdx.value++ }

  return { visible, loading, feature, photos, photoIdx, error, openFeature, close, prevPhoto, nextPhoto }
})
