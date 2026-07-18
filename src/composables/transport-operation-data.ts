import { nextTick, ref, watch } from 'vue'

export interface FuelRecord extends Record<string, string> {
  code: string
  month: string
  date: string
  plateNo: string
  location: string
  product: string
  quantity: string
  amount: string
  driver: string
}

export interface EtcRecord extends Record<string, string> {
  code: string
  name: string
  owner: string
  status: string
  amount: string
  updatedAt: string
  month: string
  plateNo: string
  invoiceNo: string
  cardNo: string
}

export interface OrderRecord extends Record<string, string> {
  code: string
  shipDate: string
  financeMonth: string
  plateNo: string
  trailerNo: string
  driver: string
  escort: string
  customer: string
  routeLine: string
  loadingAddress: string
  unloadingAddress: string
  orderType: string
  cargoName: string
  sentWeight: string
  receivedWeight: string
  freightPrice: string
  freightTotal: string
  taxRate: string
  taxedFreight: string
  receiptStatus: string
  settlementStatus: string
  status: string
  remark: string
}

export interface DriverPayrollRecord extends Record<string, string | undefined> {
  code: string
  name: string
  crewRole?: '司机' | '押运员'
  plateNo?: string
  plateNos?: string
  financeMonth?: string
  owner: string
  status: string
  salaryMode?: string
  modeStartDate?: string
  entryDate?: string
  attendanceDays?: string
  attendanceDates?: string
  lastAttendanceDate?: string
  todayAttendance?: string
  tripCount?: string
  baseSalary?: string
  tripCommission?: string
  allowance?: string
  deduction?: string
  grossSalary?: string
  netSalary?: string
  amount: string
  updatedAt: string
  approvalStatus?: string
  approvalInstanceId?: string
}

export interface MaintenanceRecord {
  id: number
  repairDate: string
  financialMonth: string
  plateNo: string
  trailerNo: string
  project: string
  shop: string
  mileage: number
  items: string
  payType: string
  driver: string
  amount: number
  status: '待审核' | '已审核' | '推修中' | '已驳回' | '已作废'
  remark: string
  approvalStatus?: string
  approvalInstanceId?: string
  createdBy?: string | number
  permissions?: import('~@/types/record-permission').PermissionAwareRecord['permissions']
}

export interface InventoryMovementRecord {
  id: number
  code: string
  movementDate: string
  type: '入库' | '出库'
  partName: string
  specification: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
  supplier: string
  plateNo: string
  operator: string
  remark: string
  maintenanceId?: number
}

export type LoanStatus = '未开始' | '还款中' | '临近到期' | '已逾期' | '已结清'
export type PaymentMethod = '银行转账' | '现金' | '承兑' | '其他'

export interface RepaymentRecord {
  id: number
  periodNo: number
  paymentDate: string
  amount: number
  principal: number
  interest: number
  method: PaymentMethod
  voucherNo?: string
  remark?: string
}

export interface VehicleLoanRecord {
  id: number
  contractNo: string
  plateNo: string
  trailerNo?: string
  lender: string
  loanAmount: number
  principalAmount: number
  annualRate: number
  totalPeriods: number
  startDate: string
  firstDueDate: string
  monthlyPayment: number
  owner?: string
  remark?: string
  payments: RepaymentRecord[]
  approvalStatus?: string
  approvalInstanceId?: string
}

export interface TransportOperationDataset {
  orders: OrderRecord[]
  fuels: FuelRecord[]
  etc: EtcRecord[]
  driverPayrolls: DriverPayrollRecord[]
  maintenance: MaintenanceRecord[]
  inventoryMovements: InventoryMovementRecord[]
  vehicleLoans: VehicleLoanRecord[]
  baseCustomers: Array<Record<string, string>>
  baseVehicles: Array<Record<string, string>>
  baseCrews: Array<Record<string, string>>
  baseRoutes: Array<Record<string, string>>
}

function cloneRows<T>(rows: T[] = []): T[] {
  return JSON.parse(JSON.stringify(rows))
}

const gasFuelPlanFields = [
  'plannedFuelConsumption',
  'newVehiclePlannedFuelConsumption',
  'oldVehiclePlannedFuelConsumption',
  'newGasVehiclePlannedFuelConsumption',
  'oldGasVehiclePlannedFuelConsumption',
  'roundTripNewGasVehiclePlannedFuelConsumption',
  'roundTripOldGasVehiclePlannedFuelConsumption',
]

const dieselFuelPlanFields = [
  'newDieselVehiclePlannedFuelConsumption',
  'oldDieselVehiclePlannedFuelConsumption',
  'roundTripNewDieselVehiclePlannedFuelConsumption',
  'roundTripOldDieselVehiclePlannedFuelConsumption',
]

function normalizeFuelPlanUnit(value: unknown, unit: 'kg' | 'L') {
  const text = String(value ?? '').trim()
  if (!text)
    return ''
  const amount = text.replace(/\s*(?:kg|l|升)\xA0*$/i, '').trim()
  return amount ? `${amount}${unit}` : ''
}

export function normalizeTransportBaseRouteFuelUnits(row: Record<string, string>) {
  const normalized = { ...row }
  gasFuelPlanFields.forEach((field) => {
    if (normalized[field])
      normalized[field] = normalizeFuelPlanUnit(normalized[field], 'kg')
  })
  dieselFuelPlanFields.forEach((field) => {
    if (normalized[field])
      normalized[field] = normalizeFuelPlanUnit(normalized[field], 'L')
  })
  return normalized
}

export const transportOperationLoading = ref(false)
export const transportOperationError = ref('')
export const transportOperationHydrated = ref(false)
export const transportOperationSaving = ref(false)
export const transportOperationDirty = ref(false)

export const transportOrderRows = ref<OrderRecord[]>([])
export const transportFuelRows = ref<FuelRecord[]>([])
export const transportEtcRows = ref<EtcRecord[]>([])
export const transportDriverPayrollRows = ref<DriverPayrollRecord[]>([])
export const transportMaintenanceRows = ref<MaintenanceRecord[]>([])
export const transportInventoryMovementRows = ref<InventoryMovementRecord[]>([])
export const transportVehicleLoanRows = ref<VehicleLoanRecord[]>([])
export const transportBaseCustomerRows = ref<Array<Record<string, string>>>([])
export const transportBaseVehicleRows = ref<Array<Record<string, string>>>([])
export const transportBaseCrewRows = ref<Array<Record<string, string>>>([])
export const transportBaseRouteRows = ref<Array<Record<string, string>>>([])

let persistTimer: ReturnType<typeof setTimeout> | undefined
let applyingRemoteData = false
let loadPromise: Promise<void> | undefined
let saveQueue: Promise<void> = Promise.resolve()
let changeVersion = 0
let datasetRevision = ''

function normalizeCustomerName(value: unknown) {
  return String(value ?? '').trim()
}

function toAmount(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

export function calculateCustomerBidBalance(customer: Record<string, string>, orders: OrderRecord[]) {
  const bidAmount = toAmount(customer.bidAmount)
  const customerName = normalizeCustomerName(customer.name)
  const startDate = String(customer.bidStartDate ?? '').trim().slice(0, 10)
  if (bidAmount <= 0 || !customerName || !startDate)
    return undefined

  const recordedFreight = orders.reduce((total, order) => {
    const orderCustomer = normalizeCustomerName(order.customer)
    const shipDate = String(order.shipDate ?? '').trim().slice(0, 10)
    if (orderCustomer !== customerName || !shipDate || shipDate < startDate)
      return total
    return total + toAmount(order.freightTotal)
  }, 0)

  return {
    bidAmount,
    recordedFreight,
    remainingAmount: Math.max(0, bidAmount - recordedFreight),
    progress: Math.min(100, (recordedFreight / bidAmount) * 100),
  }
}

function createCustomerCode(rows: Array<Record<string, string>>) {
  const maxNo = rows.reduce((max, row) => {
    const match = String(row.code ?? '').match(/^KH(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `KH${String(maxNo + 1).padStart(3, '0')}`
}

export function syncTransportCustomersFromOrders() {
  const customers = transportBaseCustomerRows.value
  const customerNames = new Set(customers.map(row => normalizeCustomerName(row.name)).filter(Boolean))
  const orderCustomers = [...new Set(transportOrderRows.value.map(row => normalizeCustomerName(row.customer)).filter(Boolean))]
  let changed = false

  orderCustomers.forEach((name) => {
    if (customerNames.has(name))
      return
    customers.push({
      code: createCustomerCode(customers),
      name,
      area: '',
      contact: '',
      bidAmount: '',
      bidStartDate: '',
      progress: '0',
      status: '合作中',
      updatedAt: new Date().toISOString().slice(0, 10),
      source: '运输订单',
    })
    customerNames.add(name)
    changed = true
  })
  return changed
}

function normalizeRouteIdentity(value: unknown) {
  return String(value ?? '').trim().replace(/[\s·・,，/至到—–-]+/g, '').toLowerCase()
}

function createRouteCode(rows: Array<Record<string, string>>) {
  const maxNo = rows.reduce((max, row) => {
    const match = String(row.code ?? '').match(/^LX(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `LX${String(maxNo + 1).padStart(3, '0')}`
}

export function syncTransportRoutesFromOrders() {
  const routes = transportBaseRouteRows.value
  const routeKeys = new Set(routes.map(row => normalizeRouteIdentity(row.name)).filter(Boolean))
  let changed = false

  transportOrderRows.value.forEach((order) => {
    const name = String(order.routeLine ?? '').trim()
    const routeKey = normalizeRouteIdentity(name)
    if (!name || !routeKey || routeKeys.has(routeKey))
      return

    const loadingAddress = String(order.loadingAddress ?? '').trim()
    const unloadingAddress = String(order.unloadingAddress ?? '').trim()
    routes.push({
      code: createRouteCode(routes),
      customer: String(order.customer ?? '').trim(),
      name,
      loadingAddress,
      unloadingAddress,
      destinationName: unloadingAddress,
      destinationArea: '',
      distance: String(order.mileage ?? order.distance ?? '').trim(),
      freightPrice: String(order.freightPrice ?? '').trim(),
      loadingFenceName: loadingAddress ? `${loadingAddress}装车围栏` : '',
      loadingFenceRadius: '1.5km',
      transitFenceName: loadingAddress && unloadingAddress ? `${loadingAddress}至${unloadingAddress}运输围栏` : '',
      unloadingFenceName: unloadingAddress ? `${unloadingAddress}卸车围栏` : '',
      unloadingFenceRadius: '1.5km',
      returnFenceName: loadingAddress && unloadingAddress ? `${unloadingAddress}至${loadingAddress}运输围栏` : '',
      status: '启用',
      routeValidityType: '长期',
      routeValidityRange: '',
      updatedAt: new Date().toISOString().slice(0, 10),
      source: '运输订单',
    })
    routeKeys.add(routeKey)
    changed = true
  })
  return changed
}

function normalizeCrewPlateNo(value: unknown) {
  return String(value ?? '').trim().replace(/[\s·•\-]/g, '').toUpperCase()
}

function payrollMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Keep payroll identities and vehicle bindings aligned with the base crew archive. */
export function syncDriverPayrollFromBaseData() {
  const bindings = new Map<string, { name: string, role: '司机' | '押运员', plates: Set<string> }>()
  const addBinding = (nameValue: unknown, role: '司机' | '押运员', plateValue: unknown) => {
    const name = String(nameValue ?? '').trim()
    const plate = normalizeCrewPlateNo(plateValue)
    if (!name || !plate)
      return
    const key = `${role}:${name}`
    const binding = bindings.get(key) ?? { name, role, plates: new Set<string>() }
    binding.plates.add(plate)
    bindings.set(key, binding)
  }

  transportBaseCrewRows.value.forEach((row) => {
    const plate = row.plateNo || row.vehicleInfo || row.vehicle || row.code
    addBinding(row.driverName || row.driver, '司机', plate)
    addBinding(row.escortName || row.escort, '押运员', plate)
  })
  transportBaseVehicleRows.value.forEach((row) => {
    const plate = row.plateNo || row.code
    addBinding(row.driverName || row.driver, '司机', plate)
    addBinding(row.escortName || row.escort, '押运员', plate)
  })

  let changed = false
  bindings.forEach((binding, key) => {
    const existing = transportDriverPayrollRows.value.find((row) => {
      const rowRole = row.crewRole || '司机'
      return `${rowRole}:${String(row.name ?? '').trim()}` === key
    })
    const plates = [...binding.plates].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    const plateNos = plates.join('、')
    if (existing) {
      if (existing.manualPlateNos === 'true')
        return
      if (existing.crewRole !== binding.role || existing.plateNos !== plateNos || existing.plateNo !== plates[0]) {
        existing.crewRole = binding.role
        existing.plateNos = plateNos
        existing.plateNo = plates[0]
        existing.owner = `${plateNos} / ${existing.financeMonth || payrollMonthKey()}`
        changed = true
      }
      return
    }

    const month = payrollMonthKey()
    const sequence = transportDriverPayrollRows.value.length + 1
    transportDriverPayrollRows.value.push({
      code: `XC${month.replace('-', '')}${String(sequence).padStart(4, '0')}`,
      name: binding.name,
      crewRole: binding.role,
      plateNo: plates[0],
      plateNos,
      financeMonth: month,
      owner: `${plateNos} / ${month}`,
      status: '核算中',
      salaryMode: '固定月薪',
      modeStartDate: `${month}-01`,
      attendanceDays: '0',
      attendanceDates: '',
      tripCount: '0',
      baseSalary: '0.00',
      tripCommission: '0.00',
      allowance: '0.00',
      deduction: '0.00',
      grossSalary: '0.00',
      netSalary: '0.00',
      amount: '0.00',
      updatedAt: new Date().toISOString().slice(0, 10),
    })
    changed = true
  })
  return changed
}

function authHeaders() {
  return {
    Authorization: localStorage.getItem('Authorization') || '',
    'Content-Type': 'application/json',
  }
}

async function fetchTransportOperation(input: RequestInfo | URL, init?: RequestInit) {
  const retryDelays = [750, 1500]
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init)
    }
    catch (error) {
      if (attempt >= retryDelays.length)
        throw new Error('运输服务暂时无法连接，请稍后重试')
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]))
    }
  }
}

function currentDataset(): TransportOperationDataset {
  return {
    orders: cloneRows(transportOrderRows.value),
    fuels: cloneRows(transportFuelRows.value),
    etc: cloneRows(transportEtcRows.value),
    driverPayrolls: cloneRows(transportDriverPayrollRows.value),
    maintenance: cloneRows(transportMaintenanceRows.value),
    inventoryMovements: cloneRows(transportInventoryMovementRows.value),
    vehicleLoans: cloneRows(transportVehicleLoanRows.value),
    baseCustomers: cloneRows(transportBaseCustomerRows.value),
    baseVehicles: cloneRows(transportBaseVehicleRows.value),
    baseCrews: cloneRows(transportBaseCrewRows.value),
    baseRoutes: cloneRows(transportBaseRouteRows.value),
  }
}

function applyDataset(data: Partial<TransportOperationDataset>) {
  applyingRemoteData = true
  transportOrderRows.value = cloneRows(data.orders)
  transportFuelRows.value = cloneRows(data.fuels)
  transportEtcRows.value = cloneRows(data.etc)
  transportDriverPayrollRows.value = cloneRows(data.driverPayrolls)
  transportMaintenanceRows.value = cloneRows(data.maintenance)
  transportInventoryMovementRows.value = cloneRows(data.inventoryMovements)
  transportVehicleLoanRows.value = cloneRows(data.vehicleLoans)
  transportBaseCustomerRows.value.splice(0, transportBaseCustomerRows.value.length, ...cloneRows(data.baseCustomers))
  transportBaseVehicleRows.value.splice(0, transportBaseVehicleRows.value.length, ...cloneRows(data.baseVehicles))
  transportBaseCrewRows.value.splice(0, transportBaseCrewRows.value.length, ...cloneRows(data.baseCrews))
  const baseRoutes = cloneRows(data.baseRoutes).map(normalizeTransportBaseRouteFuelUnits)
  transportBaseRouteRows.value.splice(0, transportBaseRouteRows.value.length, ...baseRoutes)
  const customersChanged = syncTransportCustomersFromOrders()
  const routesChanged = syncTransportRoutesFromOrders()
  nextTick(() => {
    applyingRemoteData = false
    syncDriverPayrollFromBaseData()
    if (customersChanged || routesChanged)
      schedulePersist()
  })
}

export async function loadTransportOperationData(options: { force?: boolean } = {}) {
  if (transportOperationHydrated.value && !options.force)
    return

  if (loadPromise)
    return loadPromise

  loadPromise = (async () => {
    transportOperationLoading.value = true
    transportOperationError.value = ''
    try {
      const response = await fetchTransportOperation('/api/transport/operations/data', {
        headers: authHeaders(),
      })
      const result = await response.json()
      if (result.code !== 200)
        throw new Error(result.msg || '运输运营数据加载失败')
      applyDataset(result.data || {})
      datasetRevision = String(result.revision || '')
      transportOperationHydrated.value = true
    }
    catch (error: any) {
      transportOperationError.value = error?.message || '运输运营数据加载失败'
    }
    finally {
      transportOperationLoading.value = false
    }
  })()

  try {
    await loadPromise
  }
  finally {
    loadPromise = undefined
  }
}

async function persistCurrentDataset() {
  if (!transportOperationHydrated.value || applyingRemoteData)
    return
  transportOperationSaving.value = true
  const savingVersion = changeVersion
  try {
    const response = await fetchTransportOperation('/api/transport/operations/data', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ ...currentDataset(), expectedRevision: datasetRevision }),
    })
    const result = await response.json()
    if (result.code !== 200)
      throw new Error(result.msg || '运输运营数据保存失败')
    datasetRevision = String(result.revision || datasetRevision)
    transportOperationError.value = ''
    if (savingVersion === changeVersion)
      transportOperationDirty.value = false
  }
  catch (error: any) {
    transportOperationError.value = error?.message || '运输运营数据保存失败'
    throw error
  }
  finally {
    transportOperationSaving.value = false
  }
}

export function saveTransportOperationData() {
  const queued = saveQueue.catch(() => undefined).then(persistCurrentDataset)
  saveQueue = queued
  return queued
}

export async function flushTransportOperationData() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = undefined
  }
  await saveTransportOperationData()
}

function schedulePersist() {
  if (!transportOperationHydrated.value || applyingRemoteData)
    return
  changeVersion += 1
  transportOperationDirty.value = true
  if (persistTimer)
    clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    saveTransportOperationData().catch((error: any) => {
      transportOperationError.value = error?.message || '运输运营数据保存失败'
    })
  }, 500)
}

watch([
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
], schedulePersist, { deep: true })

watch(transportOrderRows, () => {
  syncTransportCustomersFromOrders()
  syncTransportRoutesFromOrders()
}, { deep: true })
watch([transportBaseVehicleRows, transportBaseCrewRows], syncDriverPayrollFromBaseData, { deep: true })

if (typeof window !== 'undefined')
  void loadTransportOperationData()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!transportOperationDirty.value && !transportOperationSaving.value)
      return
    event.preventDefault()
    event.returnValue = ''
  })
}
