import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  calculateCustomerBidBalance,
  flushTransportOperationData,
  loadTransportOperationData,
  normalizeTransportBaseRouteFuelUnits,
  saveTransportOperationData,
  syncDriverPayrollFromBaseData,
  syncTransportCustomersFromOrders,
  syncTransportRoutesFromOrders,
  transportBaseCrewRows,
  transportBaseCustomerRows,
  transportBaseRouteRows,
  transportBaseVehicleRows,
  transportDriverPayrollRows,
  transportEtcRows,
  transportFuelRows,
  transportInventoryMovementRows,
  transportMaintenanceRows,
  transportOperationError,
  transportOperationHydrated,
  transportOperationLoading,
  transportOrderRows,
  transportVehicleLoanRows,
} from './transport-operation-data'

const allRows = [
  transportOrderRows,
  transportFuelRows,
  transportEtcRows,
  transportDriverPayrollRows,
  transportMaintenanceRows,
  transportInventoryMovementRows,
  transportVehicleLoanRows,
  transportBaseCustomerRows,
  transportBaseVehicleRows,
  transportBaseCrewRows,
  transportBaseRouteRows,
]

function apiResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response)
}

describe('transport operation shared data', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'session-token') })
    vi.stubGlobal('fetch', vi.fn())
    transportOperationHydrated.value = false
    transportOperationLoading.value = false
    transportOperationError.value = ''
    allRows.forEach(rows => rows.value.splice(0))
    await nextTick()
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('loads and clones every collection while preserving base-array identities', async () => {
    const customerArray = transportBaseCustomerRows.value
    const data = {
      orders: [{ code: 'O-1', customer: '甲公司' }],
      fuels: [{ code: 'F-1' }],
      etc: [{ code: 'E-1' }],
      driverPayrolls: [{ code: 'P-1' }],
      maintenance: [{ id: 1 }],
      inventoryMovements: [{ id: 3, code: 'RK1' }],
      vehicleLoans: [{ id: 2, payments: [] }],
      baseCustomers: [{ code: 'C-1', name: '甲公司' }],
      baseVehicles: [{ code: 'V-1' }],
      baseCrews: [{ code: 'D-1' }],
      baseRoutes: [{ code: 'R-1' }],
    }
    vi.mocked(fetch).mockReturnValueOnce(apiResponse({ code: 200, data }))

    await loadTransportOperationData()
    await nextTick()

    expect(fetch).toHaveBeenCalledWith('/api/transport/operations/data', {
      headers: { Authorization: 'session-token', 'Content-Type': 'application/json' },
    })
    expect(transportOperationHydrated.value).toBe(true)
    expect(transportOrderRows.value).toEqual(data.orders)
    expect(transportBaseCustomerRows.value).toBe(customerArray)
    expect(transportBaseCustomerRows.value).toEqual(data.baseCustomers)
    data.orders[0].customer = '已修改源数据'
    expect(transportOrderRows.value[0].customer).toBe('甲公司')
  })

  it('normalizes legacy LNG and diesel route fuel units', () => {
    expect(normalizeTransportBaseRouteFuelUnits({
      code: 'R-1',
      newGasVehiclePlannedFuelConsumption: '258L',
      oldGasVehiclePlannedFuelConsumption: '283 kg',
      roundTripNewGasVehiclePlannedFuelConsumption: '516升',
      newDieselVehiclePlannedFuelConsumption: '196kg',
      roundTripOldDieselVehiclePlannedFuelConsumption: '432L',
    })).toMatchObject({
      newGasVehiclePlannedFuelConsumption: '258kg',
      oldGasVehiclePlannedFuelConsumption: '283kg',
      roundTripNewGasVehiclePlannedFuelConsumption: '516kg',
      newDieselVehiclePlannedFuelConsumption: '196L',
      roundTripOldDieselVehiclePlannedFuelConsumption: '432L',
    })
  })

  it('deduplicates concurrent loads and restores loading state', async () => {
    let resolveResponse!: (response: Response) => void
    vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => resolveResponse = resolve))

    const first = loadTransportOperationData()
    const second = loadTransportOperationData()
    expect(transportOperationLoading.value).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
    resolveResponse({ json: () => Promise.resolve({ code: 200, data: {} }) } as Response)

    await Promise.all([first, second])
    expect(transportOperationLoading.value).toBe(false)
  })

  it('reuses hydrated data without requesting the full dataset again', async () => {
    transportOperationHydrated.value = true

    await loadTransportOperationData()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes hydrated data when explicitly forced', async () => {
    transportOperationHydrated.value = true
    transportOrderRows.value.push({ code: 'OLD' } as any)
    vi.mocked(fetch).mockReturnValueOnce(apiResponse({
      code: 200,
      data: { orders: [{ code: 'NEW' }] },
    }))

    await loadTransportOperationData({ force: true })

    expect(fetch).toHaveBeenCalledOnce()
    expect(transportOrderRows.value).toEqual([{ code: 'NEW' }])
  })

  it('reports load failures without marking incomplete data as hydrated', async () => {
    vi.mocked(fetch).mockReturnValueOnce(apiResponse({ code: 500, msg: '数据库离线' }))

    await loadTransportOperationData()

    expect(transportOperationError.value).toBe('数据库离线')
    expect(transportOperationHydrated.value).toBe(false)
    expect(transportOperationLoading.value).toBe(false)
  })

  it('does not save before hydration', async () => {
    await saveTransportOperationData()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('saves a detached dataset and clears an earlier error', async () => {
    transportOrderRows.value.push({ code: 'O-2', customer: '乙公司' } as any)
    transportBaseVehicleRows.value.push({ code: 'V-2' })
    transportOperationHydrated.value = true
    transportOperationError.value = '旧错误'
    vi.mocked(fetch).mockReturnValueOnce(apiResponse({ code: 200 }))

    await saveTransportOperationData()

    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    expect(request.method).toBe('PUT')
    expect(JSON.parse(request.body as string)).toMatchObject({
      orders: [{ code: 'O-2', customer: '乙公司' }],
      baseVehicles: [{ code: 'V-2' }],
    })
    expect(transportOperationError.value).toBe('')
  })

  it('extracts unique order customers without overwriting maintained archives', () => {
    transportBaseCustomerRows.value.push({ code: 'KH008', name: '甲公司', contact: '张经理', bidAmount: '500000' })
    transportOrderRows.value.push(
      { code: 'O-1', customer: '甲公司' } as any,
      { code: 'O-2', customer: '乙公司' } as any,
      { code: 'O-3', customer: '乙公司' } as any,
    )

    expect(syncTransportCustomersFromOrders()).toBe(true)
    expect(transportBaseCustomerRows.value).toHaveLength(2)
    expect(transportBaseCustomerRows.value[0]).toMatchObject({ code: 'KH008', contact: '张经理', bidAmount: '500000' })
    expect(transportBaseCustomerRows.value[1]).toMatchObject({ code: 'KH009', name: '乙公司', progress: '0', source: '运输订单' })
    expect(syncTransportCustomersFromOrders()).toBe(false)
  })

  it('calculates bid balance from matching orders on and after the customer start date', () => {
    const result = calculateCustomerBidBalance(
      { name: '甲公司', bidAmount: '100,000', bidStartDate: '2026-07-01' },
      [
        { customer: '甲公司', shipDate: '2026-06-30', freightTotal: '¥10,000.00' } as any,
        { customer: '甲公司', shipDate: '2026-07-01', freightTotal: '¥12,000.50' } as any,
        { customer: '甲公司', shipDate: '2026-07-08', freightTotal: '7,999.50' } as any,
        { customer: '乙公司', shipDate: '2026-07-08', freightTotal: '50,000' } as any,
      ],
    )

    expect(result).toEqual({
      bidAmount: 100000,
      recordedFreight: 20000,
      remainingAmount: 80000,
      progress: 20,
    })
  })

  it('ignores customers without a complete bid setup and caps an overdrawn bid', () => {
    const orders = [{ customer: '甲公司', shipDate: '2026-07-02', freightTotal: '120000' }] as any

    expect(calculateCustomerBidBalance({ name: '甲公司', bidAmount: '', bidStartDate: '2026-07-01' }, orders)).toBeUndefined()
    expect(calculateCustomerBidBalance({ name: '甲公司', bidAmount: '100000', bidStartDate: '' }, orders)).toBeUndefined()
    expect(calculateCustomerBidBalance({ name: '甲公司', bidAmount: '100000', bidStartDate: '2026-07-01' }, orders)).toMatchObject({
      recordedFreight: 120000,
      remainingAmount: 0,
      progress: 100,
    })
  })

  it('updates shared error state when a direct save fails', async () => {
    transportOperationHydrated.value = true
    vi.mocked(fetch).mockReturnValueOnce(apiResponse({ code: 500, msg: '保存冲突' }))

    await expect(saveTransportOperationData()).rejects.toThrow('保存冲突')
    expect(transportOperationError.value).toBe('保存冲突')
  })

  it('creates and updates payroll identities from base crew vehicle bindings', () => {
    transportDriverPayrollRows.value.push({
      code: 'P-1',
      name: '张三',
      owner: '',
      status: '核算中',
      amount: '6800.00',
      netSalary: '6800.00',
      updatedAt: '2026-07-01',
    })
    transportBaseCrewRows.value.push(
      { code: 'C-1', plateNo: '青 H·001', driverName: '张三', escortName: '李四' },
      { code: 'C-2', plateNo: '青H-002', driverName: '张三', escortName: '张三' },
    )

    expect(syncDriverPayrollFromBaseData()).toBe(true)

    expect(transportDriverPayrollRows.value).toHaveLength(3)
    expect(transportDriverPayrollRows.value.find(row => row.name === '张三' && row.crewRole === '司机')).toMatchObject({
      code: 'P-1',
      plateNo: '青H001',
      plateNos: '青H001、青H002',
      netSalary: '6800.00',
    })
    expect(transportDriverPayrollRows.value.find(row => row.name === '李四')).toMatchObject({
      crewRole: '押运员',
      plateNos: '青H001',
      status: '核算中',
    })
    expect(transportDriverPayrollRows.value.find(row => row.name === '张三' && row.crewRole === '押运员')).toMatchObject({
      plateNos: '青H002',
    })
    expect(syncDriverPayrollFromBaseData()).toBe(false)
  })

  it('debounces reactive changes into one persistence request', async () => {
    transportOperationHydrated.value = true
    vi.mocked(fetch).mockReturnValue(apiResponse({ code: 200 }))

    transportBaseCrewRows.value.push({ code: 'D-1' })
    transportBaseCrewRows.value.push({ code: 'D-2' })
    transportBaseRouteRows.value.push({ code: 'R-1' })
    await nextTick()
    await vi.advanceTimersByTimeAsync(499)
    expect(fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(fetch).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toMatchObject({
      baseCrews: [{ code: 'D-1' }, { code: 'D-2' }],
      baseRoutes: [{ code: 'R-1' }],
    })
  })

  it('flushes pending persistence without sending a duplicate request', async () => {
    transportOperationHydrated.value = true
    vi.mocked(fetch).mockReturnValue(apiResponse({ code: 200 }))

    transportOrderRows.value.push({ code: 'O-3' } as any)
    await nextTick()
    await flushTransportOperationData()
    await vi.advanceTimersByTimeAsync(500)

    expect(fetch).toHaveBeenCalledOnce()
  })

  it('serializes explicit saves so an older request cannot finish last', async () => {
    transportOperationHydrated.value = true
    let resolveFirst!: (response: Response) => void
    vi.mocked(fetch)
      .mockReturnValueOnce(new Promise(resolve => resolveFirst = resolve))
      .mockReturnValueOnce(apiResponse({ code: 200, revision: 'r2' }))

    transportOrderRows.value.push({ code: 'O-1' } as any)
    const first = saveTransportOperationData()
    transportOrderRows.value.push({ code: 'O-2' } as any)
    const second = saveTransportOperationData()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledOnce()

    resolveFirst({ json: () => Promise.resolve({ code: 200, revision: 'r1' }) } as Response)
    await Promise.all([first, second])

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string).orders).toHaveLength(2)
  })
})
it('creates one reusable base route with four stage fences from orders', () => {
  transportOrderRows.value.push(
    {
      code: 'O-ROUTE-1',
      customer: '昆仑物流陕西分公司',
      routeLine: '新沃达液厂-宝鸡华明站',
      loadingAddress: '新沃达液厂',
      unloadingAddress: '宝鸡华明站',
    } as any,
    {
      code: 'O-ROUTE-2',
      customer: '昆仑物流陕西分公司',
      routeLine: '新沃达液厂 - 宝鸡华明站',
      loadingAddress: '新沃达液厂',
      unloadingAddress: '宝鸡华明站',
    } as any,
  )

  expect(syncTransportRoutesFromOrders()).toBe(true)
  expect(transportBaseRouteRows.value).toHaveLength(1)
  expect(transportBaseRouteRows.value[0]).toMatchObject({
    loadingFenceName: '新沃达液厂装车围栏',
    transitFenceName: '新沃达液厂至宝鸡华明站运输围栏',
    unloadingFenceName: '宝鸡华明站卸车围栏',
    returnFenceName: '宝鸡华明站至新沃达液厂运输围栏',
  })
  expect(syncTransportRoutesFromOrders()).toBe(false)
})
