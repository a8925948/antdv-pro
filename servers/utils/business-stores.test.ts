import { beforeEach, describe, expect, it, vi } from 'vitest'

import { billReconciliationStore } from './bill-reconciliation-store'
import { hotelDailyStore } from './hotel-daily-store'
import { hotelRevenueStore } from './hotel-revenue-store'
import { tradeOrderStore } from './trade-order-store'

const mocks = vi.hoisted(() => ({
  pool: undefined as any,
  required: false,
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}))
vi.mock('./mysql', () => ({
  getMysqlPool: () => mocks.pool,
  isDatabaseRequired: () => mocks.required,
  withMysqlTransaction: (_db: any, handler: any) => handler(mocks.pool),
}))
vi.mock('./json-store', () => ({ readJsonFile: mocks.readJsonFile, writeJsonFile: mocks.writeJsonFile }))

describe('small business stores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pool = undefined
    mocks.required = false
  })

  it('normalizes and filters local hotel revenue records by date', async () => {
    mocks.readJsonFile.mockReturnValue([{ id: '1', date: '2026-01-01' }, { id: '2', date: '2026-01-02' }, { id: '', date: '2026-01-01' }, null])
    await expect(hotelRevenueStore.list('2026-01-01')).resolves.toEqual([{ id: '1', date: '2026-01-01' }])
  })

  it('replaces one local hotel date while preserving other dates', async () => {
    mocks.readJsonFile.mockReturnValue([{ id: 'old', date: '2026-01-01' }, { id: 'keep', date: '2026-01-02' }])
    await expect(hotelRevenueStore.replaceByDate('2026-01-01', [{ id: 'new', date: 'wrong' }, { id: '' }])).resolves.toEqual([{ id: 'new', date: '2026-01-01' }])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('hotel-revenue-records.json'), [
      { id: 'new', date: '2026-01-01' },
      { id: 'keep', date: '2026-01-02' },
    ])
  })

  it('normalizes and saves fixed-capacity hotel daily occupancy', async () => {
    mocks.readJsonFile.mockReturnValue([{ date: '2026-01-02', totalRooms: 88, occupiedRooms: 120, remark: '  夜审  ' }])
    await expect(hotelDailyStore.list()).resolves.toEqual([expect.objectContaining({
      date: '2026-01-02',
      totalRooms: 100,
      occupiedRooms: 100,
      remark: '夜审',
    })])

    mocks.readJsonFile.mockReturnValue([])
    await expect(hotelDailyStore.save({ date: '2026-01-03', occupiedRooms: 63, remark: '正常营业' })).resolves.toEqual(expect.objectContaining({
      date: '2026-01-03',
      totalRooms: 100,
      occupiedRooms: 63,
    }))
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('hotel-daily-records.json'), [expect.objectContaining({ date: '2026-01-03' })])
  })

  it('normalizes local trade orders and replaces the stored set', async () => {
    mocks.readJsonFile.mockReturnValue([{ code: 'A' }, {}, null])
    await expect(tradeOrderStore.list()).resolves.toEqual([{ code: 'A' }])
    await expect(tradeOrderStore.replace([{ code: 'B' }, { code: '' }])).resolves.toEqual([{ code: 'B' }])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('trade-orders.json'), [{ code: 'B' }])
  })

  it('applies local hotel and trade changes without replacing unrelated rows', async () => {
    mocks.readJsonFile
      .mockReturnValueOnce([{ id: 'keep', date: '2026-01-01' }, { id: 'drop', date: '2026-01-01' }, { id: 'other', date: '2026-01-02' }])
      .mockReturnValueOnce([{ id: 'keep', date: '2026-01-01' }, { id: 'new', date: '2026-01-01' }, { id: 'other', date: '2026-01-02' }])
      .mockReturnValueOnce([{ code: 'keep' }, { code: 'drop' }])
    await expect(hotelRevenueStore.applyChanges('2026-01-01', { upsert: [{ id: 'new', date: 'wrong' }], deleteIds: ['drop'] })).resolves.toEqual([
      { id: 'keep', date: '2026-01-01' },
      { id: 'new', date: '2026-01-01' },
    ])
    await expect(tradeOrderStore.applyChanges({ upsert: [{ code: 'new' }], deleteCodes: ['drop'] })).resolves.toEqual([{ code: 'keep' }, { code: 'new' }])
  })

  it('upserts a local reconciliation archive at the front', async () => {
    mocks.readJsonFile.mockReturnValue([{ id: 'A', value: 1 }, { id: 'B' }])
    await expect(billReconciliationStore.save({ id: 'A', value: 2 })).resolves.toEqual([{ id: 'A', value: 2 }, { id: 'B' }])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('bill-reconciliation-archives.json'), [{ id: 'A', value: 2 }, { id: 'B' }])
  })

  it('rejects every local fallback when the database is mandatory', async () => {
    mocks.required = true
    await expect(hotelRevenueStore.list()).rejects.toThrow('酒店营收禁止读取本地 JSON')
    await expect(hotelRevenueStore.replaceByDate('2026-01-01', [])).rejects.toThrow('酒店营收禁止写入本地 JSON')
    await expect(hotelDailyStore.list()).rejects.toThrow('酒店房态禁止读取本地 JSON')
    await expect(hotelDailyStore.save({ date: '2026-01-01', occupiedRooms: 1 })).rejects.toThrow('酒店房态禁止写入本地 JSON')
    await expect(tradeOrderStore.list()).rejects.toThrow('贸易订单禁止读取本地 JSON')
    await expect(tradeOrderStore.replace([])).rejects.toThrow('贸易订单禁止写入本地 JSON')
    await expect(billReconciliationStore.list()).rejects.toThrow('对账归档禁止读取本地 JSON')
    await expect(billReconciliationStore.save({ id: 'A' })).rejects.toThrow('对账归档禁止写入本地 JSON')
  })

  it('reads JSON payloads from MySQL and binds hotel date filters', async () => {
    const query = vi.fn(async (sql: string) => String(sql).includes('SELECT revenue_json')
      ? [[{ revenue_json: '{"id":"1","date":"2026-01-01"}' }, { revenue_json: { id: '2', date: '2026-01-01' } }]]
      : [[]])
    mocks.pool = { query, execute: vi.fn() }
    await expect(hotelRevenueStore.list('2026-01-01')).resolves.toHaveLength(2)
    const listCall = query.mock.calls.find(([sql]) => String(sql).includes('SELECT revenue_json'))
    expect(listCall?.[1]).toEqual(['2026-01-01'])
  })

  it('soft-deletes and upserts normalized trade rows in MySQL', async () => {
    const execute = vi.fn().mockResolvedValue([{}])
    mocks.pool = { query: vi.fn().mockResolvedValue([[]]), execute }
    await expect(tradeOrderStore.replace([{ code: 'A', amount: 10 }, {}])).resolves.toEqual([{ code: 'A', amount: 10 }])
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0][0]).toContain('UPDATE trade_order SET deleted_at')
    expect(execute.mock.calls[1][1]).toEqual(['A', JSON.stringify({ code: 'A', amount: 10 })])
  })

  it('upserts a reconciliation archive in MySQL and returns the refreshed list', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ archive_json: '{"id":"A","done":true}' }]])
    const execute = vi.fn().mockResolvedValue([{}])
    mocks.pool = { query, execute }
    await expect(billReconciliationStore.save({ id: 'A', done: true })).resolves.toEqual([{ id: 'A', done: true }])
    expect(execute.mock.calls[0][1]).toEqual(['A', JSON.stringify({ id: 'A', done: true })])
  })
})
