import type { GpsGeofence, GpsLocationLatest } from '~@/api/gps'
import { reactive } from 'vue'
import { formatBigDataCloudAddress, sanitizeGpsDisplayAddress } from '~@/utils/gps-address'

const storageKey = 'gps:chinese-address-cache:v1'
const addressCache = reactive<Record<string, string>>(loadCache())
const pendingKeys = new Set<string>()
const queue: GpsLocationLatest[] = []
let activeWorkers = 0

function loadCache() {
  if (typeof localStorage === 'undefined')
    return {}
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}')
  }
  catch {
    return {}
  }
}

function coordinateKey(location: Pick<GpsLocationLatest, 'longitude' | 'latitude'>) {
  return `${Number(location.latitude).toFixed(3)},${Number(location.longitude).toFixed(3)}`
}

function coordinateText(location: Pick<GpsLocationLatest, 'longitude' | 'latitude'>) {
  return `${Number(location.longitude).toFixed(6)}, ${Number(location.latitude).toFixed(6)}`
}

function distanceMeters(location: Pick<GpsLocationLatest, 'longitude' | 'latitude'>, center: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180
  const deltaLatitude = radians(location.latitude - center[1])
  const deltaLongitude = radians(location.longitude - center[0])
  const latitude1 = radians(center[1])
  const latitude2 = radians(location.latitude)
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function findNearbyGpsFence(location: GpsLocationLatest | undefined, fences: GpsGeofence[]) {
  if (!location)
    return undefined
  return fences
    .filter(fence => fence.enabled && fence.shape === 'circle' && fence.center && fence.radius)
    .map(fence => ({ fence, distance: distanceMeters(location, fence.center!) }))
    .filter(item => item.distance <= Number(item.fence.radius))
    .sort((a, b) => a.distance - b.distance)[0]
    ?.fence
}

function nearbyFenceName(location: GpsLocationLatest, fences: GpsGeofence[]) {
  return findNearbyGpsFence(location, fences)?.name?.replace(/(?:装车|卸车)?围栏$/, '') || ''
}

export function displayGpsLocation(location: GpsLocationLatest | undefined, fences: GpsGeofence[] = []) {
  if (!location)
    return ''
  return nearbyFenceName(location, fences)
    || addressCache[coordinateKey(location)]
    || sanitizeGpsDisplayAddress(location.address)
    || coordinateText(location)
}

async function geocodeWorker() {
  activeWorkers++
  while (queue.length) {
    const location = queue.shift()!
    const key = coordinateKey(location)
    try {
      const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), localityLanguage: 'zh' })
      let address = ''
      try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`)
        address = response.ok ? formatBigDataCloudAddress(await response.json() as Record<string, any>) : ''
      }
      catch {
        address = ''
      }
      if (!address) {
        const osmQuery = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), format: 'jsonv2', 'accept-language': 'zh-CN' })
        const osmResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?${osmQuery}`)
        if (osmResponse.ok) {
          const osmData = await osmResponse.json() as Record<string, any>
          address = sanitizeGpsDisplayAddress(String(osmData.display_name ?? '').replace(/,/g, ' '))
        }
      }
      if (address) {
        addressCache[key] = address
        localStorage.setItem(storageKey, JSON.stringify(addressCache))
      }
    }
    catch {
      // The coordinate remains visible if reverse geocoding is unavailable.
    }
    pendingKeys.delete(key)
  }
  activeWorkers--
}

export function queueGpsChineseAddresses(locations: GpsLocationLatest[]) {
  for (const location of locations) {
    const key = coordinateKey(location)
    if (addressCache[key] || pendingKeys.has(key))
      continue
    pendingKeys.add(key)
    queue.push(location)
  }
  const workersToStart = Math.min(6 - activeWorkers, queue.length)
  for (let index = 0; index < workersToStart; index++)
    void geocodeWorker()
}
