import { describe, expect, it } from 'vitest'
import { menuData, systemMenuData } from './index'

describe('menu route data', () => {
  it('uses unique IDs so items are not attached to multiple menu branches', () => {
    const items = [...menuData, ...systemMenuData]
    const ids = items.map(item => item.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
