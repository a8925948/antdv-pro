import type { GpsGeofence, GpsLocationLatest } from '~@/api/gps'
import { describe, expect, it } from 'vitest'
import { findNearbyGpsFence } from './gps-location-address'

const location = { longitude: 108.5, latitude: 34.2 } as GpsLocationLatest

describe('findNearbyGpsFence', () => {
  it('returns the nearest fence containing the vehicle', () => {
    const fences: GpsGeofence[] = [
      { id: 'loading', name: '装车围栏', shape: 'circle', center: [108.5, 34.2], radius: 1000, routeStage: 'loading', enabled: true },
      { id: 'unloading', name: '卸车围栏', shape: 'circle', center: [108.5001, 34.2], radius: 1000, routeStage: 'unloading', enabled: true },
    ]

    expect(findNearbyGpsFence(location, fences)?.id).toBe('loading')
  })

  it('ignores disabled and out-of-range fences', () => {
    const fences: GpsGeofence[] = [
      { id: 'disabled', name: '卸车围栏', shape: 'circle', center: [108.5, 34.2], radius: 1000, enabled: false },
      { id: 'far', name: '装车围栏', shape: 'circle', center: [109.5, 35.2], radius: 1000, enabled: true },
    ]

    expect(findNearbyGpsFence(location, fences)).toBeUndefined()
  })
})
