<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { Dayjs } from 'dayjs'
import type { MaintenanceSummary } from '~@/api/transport/maintenance'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import type { InventoryMovementRecord } from '~@/composables/transport-operation-data'
import {
  DownloadOutlined,
  ExportOutlined,
  FileExcelOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { Column } from '@antv/g2plot'
import dayjs from 'dayjs'
import { getApprovalInstancesApi, submitApprovalApi } from '~@/api/approval'
import { getMaintenanceSummaryApi } from '~@/api/transport/maintenance'
import RecordActions from '~@/components/record-actions/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { useRecordPermission } from '~@/composables/record-permission'
import { flushTransportOperationData, transportBaseVehicleRows, transportInventoryMovementRows, transportMaintenanceRows, transportOperationError, transportOperationLoading } from '~@/composables/transport-operation-data'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { financialMonthKey } from '~@/utils/financialPeriod'
import { downloadWorkbook } from '~@/utils/xlsx-export'

interface MaintenanceRecord {
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
}

interface QueryModel {
  project?: string
  financialMonth?: string
  dateRange?: [Dayjs, Dayjs]
  plateNo?: string
  remark?: string
  shop?: string
}

type MaintenanceForm = Omit<MaintenanceRecord, 'id' | 'repairDate'> & {
  id?: number
  repairDate?: Dayjs
}

type InventoryMovementForm = Omit<InventoryMovementRecord, 'id' | 'code' | 'movementDate' | 'amount' | 'maintenanceId'> & {
  movementDate: Dayjs
}

const message = useMessage()
const { canEditRecord, canDeleteRecord, canAuditRecord, canRevokeRecord, canVoidRecord } = useRecordPermission()
const chartContainer = ref<HTMLElement>()
const chart = shallowRef<Column>()
const modalOpen = ref(false)
const detailOpen = ref(false)
const detailRecord = ref<MaintenanceRecord>()
const submitting = ref(false)
const activeTab = ref('maintenance')
const inventoryModalOpen = ref(false)
const inventorySubmitting = ref(false)
const inventoryFormRef = ref<FormInstance>()
const inventoryKeyword = ref('')
const inventoryTypeFilter = ref<string>()
const isUpdate = ref(false)
const formRef = ref<FormInstance>()
const summaryLoading = ref(false)
const maintenanceApprovalInstances = ref<any[]>([])
const maintenanceSummary = ref<MaintenanceSummary>({
  totalCount: 0,
  totalAmount: 0,
  pendingCount: 0,
  repairingCount: 0,
  approvedCount: 0,
  averageAmount: 0,
})

const shopOptions = ['格尔木顺达汽修厂', '西宁米其林轮胎店', '陕西宁强修理站', '宝鸡华明维保点']
  .map(value => ({ label: value, value }))

const records = transportMaintenanceRows
const inventoryRecords = transportInventoryMovementRows

const currentFinancialMonth = financialMonthKey(dayjs())
const queryModel = reactive<QueryModel>({
  financialMonth: currentFinancialMonth,
})
const formData = ref<MaintenanceForm>(createEmptyForm())
const inventoryFormData = ref<InventoryMovementForm>(createEmptyInventoryForm('入库'))

const columns = shallowRef([
  { title: '送修日期', dataIndex: 'repairDate', width: 120 },
  { title: '财务月', dataIndex: 'financialMonth', width: 90 },
  { title: '车辆', dataIndex: 'vehicleInfo', width: 130 },
  { title: '维修项目', dataIndex: 'project', width: 220 },
  { title: '送修地点', dataIndex: 'shop', width: 170 },
  { title: '维保公里数', dataIndex: 'mileage', width: 120 },
  { title: '支出方式', dataIndex: 'payType', width: 110 },
  { title: '司机', dataIndex: 'driver', width: 100 },
  { title: '金额(元)', dataIndex: 'amount', width: 110 },
  { title: '审核状态', dataIndex: 'status', width: 110 },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 180 },
])
const tableColumns = computed(() => enhanceBusinessTableColumns(columns.value))
const tableScrollX = computed(() => createBusinessTableScrollX(tableColumns.value, 1450))
const inventoryColumns = [
  { title: '单号', dataIndex: 'code', width: 154 },
  { title: '日期', dataIndex: 'movementDate', width: 110 },
  { title: '类型', dataIndex: 'type', width: 84 },
  { title: '配件名称', dataIndex: 'partName', width: 150 },
  { title: '规格型号', dataIndex: 'specification', width: 130 },
  { title: '数量', dataIndex: 'quantity', width: 90 },
  { title: '单价(元)', dataIndex: 'unitPrice', width: 110 },
  { title: '金额(元)', dataIndex: 'amount', width: 110 },
  { title: '结存', dataIndex: 'balance', width: 90 },
  { title: '对应车号', dataIndex: 'plateNo', width: 120 },
  { title: '供应商/领用人', dataIndex: 'counterparty', width: 150 },
  { title: '关联维保', dataIndex: 'maintenanceId', width: 100 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
]

const formRules: Record<string, Rule[]> = {
  repairDate: [{ required: true, message: '请选择送修日期', trigger: 'change' }],
  financialMonth: [{ required: true, message: '请选择财务月', trigger: 'change' }],
  plateNo: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  project: [{ required: true, message: '请输入维修项目', trigger: 'blur' }],
  shop: [{ required: true, message: '请输入送修地点', trigger: 'blur' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'change' }],
}

const inventoryFormRules: Record<string, Rule[]> = {
  movementDate: [{ required: true, message: '请选择出入库日期', trigger: 'change' }],
  partName: [{ required: true, message: '请输入配件名称', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'change' }],
  unitPrice: [{ required: true, message: '请输入单价', trigger: 'change' }],
  plateNo: [{
    validator: async (_rule, value) => {
      if (inventoryFormData.value.type === '出库' && !value)
        throw new Error('出库必须选择对应车号')
    },
    trigger: 'change',
  }],
}

function inventoryKey(record: Pick<InventoryMovementRecord, 'partName' | 'specification'>) {
  return `${record.partName.trim()}@@${record.specification.trim()}`
}

const inventoryBalances = computed(() => {
  const result = new Map<string, number>()
  inventoryRecords.value.forEach((record) => {
    const change = record.type === '入库' ? Number(record.quantity) : -Number(record.quantity)
    result.set(inventoryKey(record), (result.get(inventoryKey(record)) || 0) + change)
  })
  return result
})

const inventoryRows = computed(() => {
  const balances = new Map<string, number>()
  const rows = [...inventoryRecords.value]
    .sort((a, b) => a.movementDate.localeCompare(b.movementDate) || a.id - b.id)
    .map((record) => {
      const key = inventoryKey(record)
      const balance = (balances.get(key) || 0) + (record.type === '入库' ? record.quantity : -record.quantity)
      balances.set(key, balance)
      return {
        ...record,
        balance,
        counterparty: record.type === '入库' ? record.supplier : record.operator,
      }
    })
    .reverse()
  const keyword = inventoryKeyword.value.trim().toLowerCase()
  return rows.filter((record) => {
    if (inventoryTypeFilter.value && record.type !== inventoryTypeFilter.value)
      return false
    if (!keyword)
      return true
    return [record.code, record.partName, record.specification, record.plateNo, record.supplier, record.operator]
      .some(value => String(value || '').toLowerCase().includes(keyword))
  })
})

const inventoryPartOptions = computed(() => {
  const parts = new Map<string, { value: string, label: string, partName: string, specification: string }>()
  inventoryRecords.value.forEach((record) => {
    if (record.type !== '入库')
      return
    const key = inventoryKey(record)
    if ((inventoryBalances.value.get(key) || 0) <= 0)
      return
    parts.set(key, {
      value: key,
      label: `${record.partName}${record.specification ? ` / ${record.specification}` : ''}（库存 ${inventoryBalances.value.get(key)} ${record.unit}）`,
      partName: record.partName,
      specification: record.specification,
    })
  })
  return [...parts.values()]
})

const inventoryTotalQuantity = computed(() => [...inventoryBalances.value.values()].reduce((sum, value) => sum + value, 0))
const inventoryTotalValue = computed(() => inventoryRecords.value.reduce((sum, record) => sum + (record.type === '入库' ? record.amount : -record.amount), 0))

const filteredRecords = computed(() => {
  return records.value.filter((item) => {
    if (queryModel.project && !item.project.includes(queryModel.project))
      return false
    if (queryModel.financialMonth && item.financialMonth !== queryModel.financialMonth)
      return false
    if (queryModel.plateNo && !item.plateNo.includes(queryModel.plateNo))
      return false
    if (queryModel.remark && !item.remark.includes(queryModel.remark))
      return false
    if (queryModel.shop && item.shop !== queryModel.shop)
      return false
    if (queryModel.dateRange?.length === 2) {
      const current = dayjs(item.repairDate)
      if (current.isBefore(queryModel.dateRange[0], 'day') || current.isAfter(queryModel.dateRange[1], 'day'))
        return false
    }
    return true
  })
})

function normalizePlateNo(value?: string) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase()
}

const baseVehicleMap = computed(() => new Map(
  transportBaseVehicleRows.value.map(vehicle => [normalizePlateNo(vehicle.plateNo || vehicle.code), vehicle]),
))

const baseVehicleOptions = computed(() => transportBaseVehicleRows.value
  .map((vehicle) => {
    const plateNo = String(vehicle.plateNo || vehicle.code || '').trim()
    const trailerNo = String(vehicle.trailerNo || '').trim()
    return {
      value: plateNo,
      label: [plateNo, trailerNo].filter(Boolean).join(' / '),
    }
  })
  .filter(option => option.value)
  .sort((a, b) => a.value.localeCompare(b.value, 'zh-CN')))

function getLinkedVehicle(record: Record<string, any>) {
  return baseVehicleMap.value.get(normalizePlateNo(record.plateNo))
}

function handleVehicleSelect(value: string | number | { value?: string | number }) {
  const plateNo = typeof value === 'object' ? String(value.value ?? '') : String(value)
  const vehicle = baseVehicleMap.value.get(normalizePlateNo(plateNo))
  if (!vehicle)
    return
  formData.value.plateNo = String(vehicle.plateNo || vehicle.code || plateNo)
  formData.value.trailerNo = String(vehicle.trailerNo || '-')
  formData.value.driver = String(vehicle.driver || formData.value.driver || '')
}

function filterVehicleOption(input: string, option: { value?: string | number, label?: string }) {
  const keyword = normalizePlateNo(input)
  const searchableText = normalizePlateNo(`${option.value ?? ''}${option.label ?? ''}`)
  return searchableText.includes(keyword)
}

function getVehicleDisplay(record: Record<string, any>) {
  const vehicle = getLinkedVehicle(record)
  const plateNo = String(vehicle?.plateNo || vehicle?.code || record.plateNo || '-')
  const trailerNo = String(vehicle?.trailerNo || record.trailerNo || '-')
  return {
    plateNo,
    details: trailerNo || '-',
  }
}

const chartData = computed(() => {
  const amountMap = new Map<string, number>()
  filteredRecords.value.forEach((item) => {
    const plateNo = getVehicleDisplay(item).plateNo
    amountMap.set(plateNo, (amountMap.get(plateNo) || 0) + item.amount)
  })
  const rankedRows = [...amountMap.entries()]
    .map(([plateNo, amount]) => ({ plateNo, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

  return rankedRows
})

const maintenanceMonthKeys = computed(() => {
  return [...new Set(records.value.map(item => item.financialMonth).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
})

const maintenanceMonthOptions = computed(() => {
  return maintenanceMonthKeys.value.map(value => ({ label: value, value }))
})

const maintenanceApprovalAmount = computed(() => filteredRecords.value
  .filter(item => ['审批中', '审批通过'].includes(String(item.approvalStatus || '')))
  .reduce((sum, item) => sum + Number(item.amount || 0), 0))

const maintenanceUsedAmount = computed(() => filteredRecords.value
  .filter(item => item.status === '已审核' || item.approvalStatus === '审批通过')
  .reduce((sum, item) => sum + Number(item.amount || 0), 0))

const summaryCards = computed(() => [
  { label: '维保记录数', value: maintenanceSummary.value.totalCount, hint: '当前筛选范围内', tone: 'primary' as const },
  { label: '维保费用总额', value: formatAmount(maintenanceSummary.value.totalAmount), hint: `均次 ${formatAmount(maintenanceSummary.value.averageAmount)}`, tone: 'danger' as const },
  { label: '审批总金额', value: formatAmount(maintenanceApprovalAmount.value), hint: '审批中和审批通过', tone: 'primary' as const },
  { label: '使用金额', value: formatAmount(maintenanceUsedAmount.value), hint: '已审核维保计入运营数据', tone: 'success' as const },
  { label: '待审核记录', value: maintenanceSummary.value.pendingCount, hint: `${maintenanceSummary.value.approvedCount} 条已审核`, tag: maintenanceSummary.value.pendingCount ? '需及时处理' : '状态正常', tone: maintenanceSummary.value.pendingCount ? 'warning' as const : 'success' as const },
  { label: '推修中车辆', value: maintenanceSummary.value.repairingCount, hint: '当前推修中', tone: 'primary' as const },
])

function createEmptyForm(): MaintenanceForm {
  const repairDate = dayjs()
  return {
    repairDate,
    financialMonth: financialMonthKey(repairDate),
    plateNo: '',
    trailerNo: '-',
    project: '',
    shop: '',
    mileage: 0,
    items: '',
    payType: '备用金',
    driver: '',
    amount: 0,
    status: '待审核',
    remark: '',
  }
}

function createEmptyInventoryForm(type: '入库' | '出库'): InventoryMovementForm {
  return {
    movementDate: dayjs(),
    type,
    partName: '',
    specification: '',
    unit: '件',
    quantity: 1,
    unitPrice: 0,
    supplier: '',
    plateNo: '',
    operator: '',
    remark: '',
  }
}

function handleInventoryAdd(type: '入库' | '出库') {
  inventoryFormData.value = createEmptyInventoryForm(type)
  inventoryModalOpen.value = true
}

function handleInventoryPartSelect(value: unknown) {
  const selectedValue = typeof value === 'object' && value !== null && 'value' in value
    ? String((value as { value?: unknown }).value ?? '')
    : String(value ?? '')
  const option = inventoryPartOptions.value.find(item => item.value === selectedValue)
  if (!option)
    return
  const sourceRows = inventoryRecords.value.filter(record => inventoryKey(record) === selectedValue && record.type === '入库')
  const totalQuantity = sourceRows.reduce((sum, record) => sum + record.quantity, 0)
  const totalAmount = sourceRows.reduce((sum, record) => sum + record.amount, 0)
  inventoryFormData.value.partName = option.partName
  inventoryFormData.value.specification = option.specification
  inventoryFormData.value.unit = sourceRows[0]?.unit || '件'
  inventoryFormData.value.unitPrice = totalQuantity ? Number((totalAmount / totalQuantity).toFixed(2)) : 0
}

function inventoryCellValue(record: Record<string, unknown>, dataIndex: unknown) {
  if (typeof dataIndex !== 'string' && typeof dataIndex !== 'number')
    return '-'
  return record[dataIndex] || '-'
}

async function handleInventorySubmit() {
  const movementSnapshot = structuredClone(inventoryRecords.value)
  const maintenanceSnapshot = structuredClone(records.value)
  try {
    await inventoryFormRef.value?.validate()
    const form = inventoryFormData.value
    const key = inventoryKey(form)
    const available = inventoryBalances.value.get(key) || 0
    if (form.type === '出库' && form.quantity > available)
      return message.error(`库存不足，当前可用 ${available} ${form.unit}`)

    inventorySubmitting.value = true
    const id = Math.max(...inventoryRecords.value.map(item => item.id), 0) + 1
    const maintenanceId = form.type === '出库'
      ? Math.max(...records.value.map(item => item.id), 0) + 1
      : undefined
    const movementDate = form.movementDate.format('YYYY-MM-DD')
    const code = `${form.type === '入库' ? 'RK' : 'CK'}${form.movementDate.format('YYYYMMDD')}${String(id).padStart(4, '0')}`
    const amount = Number((form.quantity * form.unitPrice).toFixed(2))

    inventoryRecords.value.unshift({ ...form, id, code, movementDate, amount, maintenanceId })

    if (form.type === '出库') {
      const vehicle = baseVehicleMap.value.get(normalizePlateNo(form.plateNo))
      records.value.unshift({
        id: maintenanceId!,
        repairDate: movementDate,
        financialMonth: financialMonthKey(form.movementDate),
        plateNo: form.plateNo,
        trailerNo: String(vehicle?.trailerNo || '-'),
        project: `配件更换-${form.partName}`,
        shop: '内部库存领用',
        mileage: 0,
        items: '',
        payType: '库存领用',
        driver: String(vehicle?.driver || ''),
        amount,
        status: '待审核',
        remark: [
          `库存出库单 ${code}`,
          `${form.partName}${form.specification ? `（${form.specification}）` : ''} × ${form.quantity}${form.unit}`,
          form.remark,
        ].filter(Boolean).join('；'),
      })
    }

    await nextTick()
    await flushTransportOperationData()
    inventoryModalOpen.value = false
    message.success(form.type === '出库' ? '出库成功，已生成维保记录' : '入库成功')
    refreshMaintenanceView()
  }
  catch (error: any) {
    inventoryRecords.value = movementSnapshot
    records.value = maintenanceSnapshot
    message.error(error?.message || '库存数据保存失败，已恢复修改前数据')
  }
  finally {
    inventorySubmitting.value = false
  }
}

function renderChart() {
  if (!chartContainer.value)
    return

  if (!chart.value) {
    chart.value = new Column(chartContainer.value, {
      data: chartData.value,
      xField: 'plateNo',
      yField: 'amount',
      height: 320,
      seriesField: 'amount',
      legend: false,
      columnWidthRatio: 0.56,
      color: ({ amount }) => amount >= 1500 ? '#e82727' : '#f59f00',
      label: {
        position: 'top',
        formatter: datum => `¥${Number(datum.amount || 0).toLocaleString()}`,
        style: {
          fill: '#334155',
          fontSize: 12,
          fontWeight: 600,
        },
      },
      yAxis: {
        min: 0,
        label: {
          formatter: value => `¥${Number(value).toLocaleString()}`,
        },
        grid: {
          line: {
            style: {
              stroke: '#e5e7eb',
              lineWidth: 1,
            },
          },
        },
      },
      xAxis: {
        label: {
          style: {
            fill: '#5f6b7a',
            fontSize: 12,
          },
          autoRotate: false,
        },
      },
      tooltip: {
        formatter: datum => ({ name: datum.plateNo, value: `金额(元): ${datum.amount.toLocaleString()}` }),
      },
    })
    chart.value.render()
    return
  }

  chart.value.changeData(chartData.value)
}

function handleSearch() {
  loadSummary()
  message.success('查询成功')
}

function handleReset() {
  Object.keys(queryModel).forEach((key) => {
    delete queryModel[key as keyof QueryModel]
  })
  queryModel.financialMonth = currentFinancialMonth
  loadSummary()
}

function handleAdd() {
  isUpdate.value = false
  formData.value = createEmptyForm()
  modalOpen.value = true
}

function refreshMaintenanceView() {
  loadSummary()
  void nextTick(renderChart)
}

function handleView(record: MaintenanceRecord) {
  detailRecord.value = record
  detailOpen.value = true
}

function handleEdit(record: MaintenanceRecord) {
  const permission = canEditRecord(record)
  if (!permission.allowed) {
    message.warning(permission.reason || '无编辑权限')
    return
  }
  isUpdate.value = true
  formData.value = {
    ...record,
    repairDate: dayjs(record.repairDate),
  }
  modalOpen.value = true
}

async function handleSubmit() {
  const snapshot = structuredClone(records.value)
  try {
    await formRef.value?.validate()
    submitting.value = true
    const payload = {
      ...formData.value,
      repairDate: formData.value.repairDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      financialMonth: financialMonthKey(formData.value.repairDate || dayjs()),
    }

    if (isUpdate.value && payload.id) {
      const index = records.value.findIndex(item => item.id === payload.id)
      if (index > -1)
        records.value[index] = payload as MaintenanceRecord
    }
    else {
      records.value.unshift({
        ...payload,
        id: Math.max(...records.value.map(item => item.id), 0) + 1,
      } as MaintenanceRecord)
    }

    await nextTick()
    await flushTransportOperationData()
    modalOpen.value = false
    message.success(isUpdate.value ? '编辑成功' : '新增成功')
    await loadSummary()
    await nextTick()
    renderChart()
  }
  catch (error: any) {
    records.value = snapshot
    message.error(error?.message || '维保记录保存失败，已恢复修改前数据')
  }
  finally {
    submitting.value = false
  }
}

async function handleDelete(record: MaintenanceRecord) {
  const permission = canDeleteRecord(record)
  if (!permission.allowed)
    return message.warning(permission.reason || '无删除权限')
  const snapshot = structuredClone(records.value)
  try {
    records.value = records.value.filter(item => item.id !== record.id)
    await nextTick()
    await flushTransportOperationData()
    message.success('删除成功')
    refreshMaintenanceView()
  }
  catch (error: any) {
    records.value = snapshot
    message.error(error?.message || '删除失败，已恢复原数据')
  }
}

async function updateRecordStatus(record: MaintenanceRecord, status: MaintenanceRecord['status'], successMessage: string) {
  const target = records.value.find(item => item.id === record.id)
  if (!target)
    return
  const previousStatus = target.status
  try {
    target.status = status
    await nextTick()
    await flushTransportOperationData()
    message.success(successMessage)
    refreshMaintenanceView()
  }
  catch (error: any) {
    target.status = previousStatus
    message.error(error?.message || '状态保存失败')
  }
}

function getRecordActions(record: Record<string, any>): RecordActionItem[] {
  const item = record as MaintenanceRecord
  const canEdit = canEditRecord(item)
  const canDelete = canDeleteRecord(item)
  const canAudit = canAuditRecord(item)
  const canRevoke = canRevokeRecord(item)
  const canVoid = canVoidRecord(item)
  return [
    {
      key: 'view',
      label: '查看',
      onClick: () => handleView(item),
    },
    {
      key: 'edit',
      label: '编辑',
      hidden: !canEdit.allowed,
      onClick: () => handleEdit(item),
    },
    {
      key: 'submitApproval',
      label: '提交审批',
      hidden: true,
      onClick: () => submitMaintenanceApproval(item),
    },
    {
      key: 'submit',
      label: '提交审核',
      hidden: !['已驳回'].includes(item.status) || !canEdit.allowed,
      onClick: () => updateRecordStatus(item, '待审核', '已提交审核'),
    },
    {
      key: 'approve',
      label: '审核通过',
      hidden: item.status !== '待审核' || !canAudit.allowed,
      onClick: () => updateRecordStatus(item, '已审核', '审核通过'),
    },
    {
      key: 'reject',
      label: '审核驳回',
      hidden: item.status !== '待审核' || !canAudit.allowed,
      onClick: () => updateRecordStatus(item, '已驳回', '已驳回'),
    },
    {
      key: 'revoke',
      label: '撤回',
      hidden: item.status !== '待审核' || !canRevoke.allowed,
      onClick: () => updateRecordStatus(item, '已驳回', '已撤回'),
    },
    {
      key: 'void',
      label: '作废',
      danger: true,
      confirm: true,
      confirmTitle: '确定作废该维保记录？',
      hidden: item.status === '已作废' || !canVoid.allowed,
      onClick: () => updateRecordStatus(item, '已作废', '已作废'),
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      confirm: true,
      confirmTitle: '确定删除该维保记录？',
      hidden: !canDelete.allowed,
      onClick: () => handleDelete(item),
    },
  ]
}

function buildSummaryFilters() {
  return {
    ...queryModel,
    startDate: queryModel.dateRange?.[0]?.format('YYYY-MM-DD'),
    endDate: queryModel.dateRange?.[1]?.format('YYYY-MM-DD'),
  }
}

async function submitMaintenanceApproval(record: MaintenanceRecord) {
  if (String(record.approvalStatus ?? '') === '审批中')
    return message.warning('该维保记录已提交审批')

  const snapshot = { ...record }
  try {
    const detail = await submitApprovalApi({
      businessType: 'transport_maintenance',
      businessModule: '维保管理',
      businessId: `MT-${record.id}`,
      businessNo: `MT-${record.id}`,
      title: `维保费审批-${record.plateNo}`,
      applicantId: 1,
      applicantName: '超级管理员',
      deptId: 'transport',
      deptName: '运输管理部',
      amount: Number(record.amount || 0),
      formData: {
        moduleName: '维保管理',
        modulePath: '/transport/maintenance',
        plateNo: record.plateNo,
        driver: record.driver,
        occurredDate: record.repairDate,
        feeType: '维保费',
        amount: Number(record.amount || 0),
        project: record.project,
        shop: record.shop,
        businessNo: `MT-${record.id}`,
      },
    })
    record.approvalStatus = formatApprovalStatus(detail.data?.instance?.status) || '审批中'
    record.approvalInstanceId = detail.data?.instance?.id
    await nextTick()
    await flushTransportOperationData()
    message.success('已提交审批')
    refreshMaintenanceView()
  }
  catch (error: any) {
    Object.assign(record, snapshot)
    message.error(error?.message || '提交审批失败')
  }
}

async function loadSummary() {
  summaryLoading.value = true
  try {
    const res = await getMaintenanceSummaryApi({
      records: records.value,
      filters: buildSummaryFilters(),
    })
    if (res.data)
      maintenanceSummary.value = res.data
  }
  finally {
    summaryLoading.value = false
  }
}

function handleExport() {
  const rows = filteredRecords.value.map(item => ({
    送修日期: item.repairDate,
    财务月: item.financialMonth,
    车牌号: item.plateNo,
    挂车号: item.trailerNo,
    维修项目: item.project,
    送修地点: item.shop,
    维保公里数: item.mileage,
    支出方式: item.payType,
    司机: item.driver,
    金额: item.amount,
    审核状态: item.status,
    维保备注: item.remark,
  }))
  const conditions = [{
    维修项目: queryModel.project ?? '',
    财务月: queryModel.financialMonth ?? '',
    送修开始日期: queryModel.dateRange?.[0]?.format('YYYY-MM-DD') ?? '',
    送修结束日期: queryModel.dateRange?.[1]?.format('YYYY-MM-DD') ?? '',
    车号: queryModel.plateNo ?? '',
    维保备注: queryModel.remark ?? '',
    推修点: queryModel.shop ?? '',
  }]
  downloadWorkbook(`维保管理_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`, [
    { name: '筛选条件', rows: conditions },
    { name: '维保管理', rows },
  ])
  message.success('导出成功')
}

function handleTemplate() {
  const rows = [{
    送修日期: '',
    财务月: '',
    车牌号: '',
    挂车号: '',
    维修项目: '',
    送修地点: '',
    维保公里数: '',
    支出方式: '',
    司机: '',
    金额: '',
    审核状态: '',
    维保备注: '',
  }]
  downloadWorkbook('维保导入模板.xlsx', [{ name: '维保导入模板', rows }])
  message.success('模板已下载')
}

function handleImport() {
  message.info('请按模板导入维保记录')
}

function formatAmount(value: number) {
  return `¥${Number(value || 0).toLocaleString()}`
}

function formatMileage(value: number) {
  return Number(value || 0).toLocaleString()
}

function statusColor(status: MaintenanceRecord['status']) {
  const colorMap: Record<MaintenanceRecord['status'], string> = {
    待审核: 'orange',
    已审核: 'green',
    推修中: 'blue',
    已驳回: 'red',
    已作废: 'default',
  }
  return colorMap[status]
}

function approvalStatusColor(status?: string) {
  if (status === '审批中')
    return 'processing'
  if (status === '审批通过')
    return 'success'
  if (status === '审批驳回')
    return 'error'
  if (status === '已撤回')
    return 'default'
  return 'default'
}

async function loadMaintenanceApprovalStatus() {
  const res = await getApprovalInstancesApi({ businessType: 'transport_maintenance' })
  maintenanceApprovalInstances.value = res.data ?? []
  const instanceMap = new Map(maintenanceApprovalInstances.value.map(item => [String(item.businessId), item]))
  records.value.forEach((record) => {
    const instance = instanceMap.get(`MT-${record.id}`)
    if (!instance)
      return
    record.approvalStatus = formatApprovalStatus(instance.status)
    record.approvalInstanceId = instance.id
  })
}

function formatApprovalStatus(status?: string) {
  if (status === 'PENDING' || status === 'APPROVING')
    return '审批中'
  if (status === 'APPROVED')
    return '审批通过'
  if (status === 'REJECTED')
    return '审批驳回'
  if (status === 'REVOKED')
    return '已撤回'
  return status || ''
}

onMounted(() => {
  renderChart()
  loadSummary()
  loadMaintenanceApprovalStatus()
})

onBeforeUnmount(() => {
  chart.value?.destroy()
  chart.value = undefined
})

watch(chartData, () => {
  void nextTick(renderChart)
})
</script>

<template>
  <page-container>
    <a-alert v-if="transportOperationError" class="maintenance-card" type="error" show-icon :message="transportOperationError" />

    <SummaryCards v-if="activeTab === 'maintenance'" :cards="summaryCards" :loading="summaryLoading || transportOperationLoading" />

    <a-card v-if="activeTab === 'maintenance'" class="maintenance-card" title="车辆维修金额排行 (TOP 10)">
      <template #extra>
        <span class="chart-tip">ⓘ 按车辆累计维保金额排名</span>
      </template>
      <div ref="chartContainer" class="maintenance-chart" />
    </a-card>

    <a-card v-if="activeTab === 'maintenance'" class="maintenance-card">
      <a-form :model="queryModel" class="maintenance-query" layout="inline">
        <a-form-item label="维修项目">
          <a-input v-model:value="queryModel.project" allow-clear placeholder="请输入维修项目" />
        </a-form-item>
        <a-form-item label="财务月">
          <a-select v-model:value="queryModel.financialMonth" allow-clear class="filter-month" placeholder="请选择财务月" :options="maintenanceMonthOptions" />
        </a-form-item>
        <a-form-item label="送修时间">
          <a-range-picker v-model:value="queryModel.dateRange" />
        </a-form-item>
        <a-form-item label="车号">
          <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车号" />
        </a-form-item>
        <a-form-item label="维保备注">
          <a-input v-model:value="queryModel.remark" allow-clear placeholder="请输入维保备注" />
        </a-form-item>
        <a-form-item label="推修点">
          <a-select v-model:value="queryModel.shop" allow-clear class="filter-shop" placeholder="全部" :options="shopOptions" />
        </a-form-item>
        <a-form-item class="query-actions">
          <a-space>
            <a-button type="primary" @click="handleSearch">
              <template #icon>
                <SearchOutlined />
              </template>
              搜索
            </a-button>
            <a-button @click="handleReset">
              重置
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-tabs v-model:active-key="activeTab" class="maintenance-tabs">
      <a-tab-pane key="maintenance" tab="维保记录" />
      <a-tab-pane key="inventory" tab="库存管理" />
    </a-tabs>

    <a-card v-if="activeTab === 'maintenance'" class="maintenance-card" title="维保记录">
      <template #extra>
        <a-space wrap>
          <a-button @click="handleTemplate">
            <template #icon>
              <DownloadOutlined />
            </template>
            下载模板
          </a-button>
          <a-button @click="handleTemplate">
            <template #icon>
              <FileExcelOutlined />
            </template>
            模板
          </a-button>
          <a-button @click="handleImport">
            <template #icon>
              <ImportOutlined />
            </template>
            导入
          </a-button>
          <a-button @click="handleExport">
            <template #icon>
              <ExportOutlined />
            </template>
            导出
          </a-button>
          <a-button type="primary" @click="handleAdd">
            <template #icon>
              <PlusOutlined />
            </template>
            新增维保
          </a-button>
        </a-space>
      </template>
      <a-table
        row-key="id"
        :loading="transportOperationLoading"
        :columns="tableColumns"
        :data-source="filteredRecords"
        :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
        :scroll="{ x: tableScrollX }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'vehicleInfo'">
            <div class="vehicle-stack-cell">
              <span class="vehicle-main">{{ getVehicleDisplay(record).plateNo }}</span>
              <span class="vehicle-sub">{{ getVehicleDisplay(record).details }}</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'mileage'">
            {{ formatMileage(record.mileage) }}
          </template>
          <template v-else-if="column.dataIndex === 'amount'">
            <span class="amount-text">{{ formatAmount(record.amount) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">
              {{ record.status }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'approvalStatus'">
            <a-tag :color="approvalStatusColor(record.approvalStatus)">
              {{ record.approvalStatus || '-' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <RecordActions :actions="getRecordActions(record)" />
          </template>
          <template v-else>
            <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
              <span class="cell-ellipsis">
                {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
              </span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card v-else class="maintenance-card" title="库存管理明细">
      <template #extra>
        <a-space wrap>
          <a-input
            v-model:value="inventoryKeyword"
            allow-clear
            class="inventory-search"
            placeholder="搜索配件、单号或车号"
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
          <a-select v-model:value="inventoryTypeFilter" allow-clear class="inventory-type-filter" placeholder="全部类型">
            <a-select-option value="入库">
              入库
            </a-select-option>
            <a-select-option value="出库">
              出库
            </a-select-option>
          </a-select>
          <a-button @click="handleInventoryAdd('入库')">
            <template #icon>
              <ImportOutlined />
            </template>
            入库
          </a-button>
          <a-button type="primary" @click="handleInventoryAdd('出库')">
            <template #icon>
              <ExportOutlined />
            </template>
            出库
          </a-button>
        </a-space>
      </template>

      <div class="inventory-summary">
        <span>当前结存 <strong>{{ inventoryTotalQuantity.toLocaleString() }}</strong></span>
        <a-divider type="vertical" />
        <span>库存金额 <strong>{{ formatAmount(inventoryTotalValue) }}</strong></span>
        <a-divider type="vertical" />
        <span>流水 <strong>{{ inventoryRecords.length }}</strong> 条</span>
      </div>

      <a-table
        row-key="id"
        :loading="transportOperationLoading"
        :columns="inventoryColumns"
        :data-source="inventoryRows"
        :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
        :scroll="{ x: 1500 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'type'">
            <a-tag :color="record.type === '入库' ? 'green' : 'orange'">
              {{ record.type }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'quantity'">
            {{ record.type === '入库' ? '+' : '-' }}{{ record.quantity }} {{ record.unit }}
          </template>
          <template v-else-if="column.dataIndex === 'balance'">
            <strong>{{ record.balance }} {{ record.unit }}</strong>
          </template>
          <template v-else-if="column.dataIndex === 'unitPrice' || column.dataIndex === 'amount'">
            {{ formatAmount(record[column.dataIndex]) }}
          </template>
          <template v-else-if="column.dataIndex === 'plateNo'">
            {{ record.plateNo || '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'maintenanceId'">
            <a-button v-if="record.maintenanceId" type="link" size="small" @click="activeTab = 'maintenance'">
              MT-{{ record.maintenanceId }}
            </a-button>
            <span v-else>-</span>
          </template>
          <template v-else>
            {{ inventoryCellValue(record, column.dataIndex) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="isUpdate ? '编辑维保' : '新增维保'"
      :confirm-loading="submitting"
      width="820px"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="8">
            <a-form-item name="repairDate" label="送修日期">
              <a-date-picker v-model:value="formData.repairDate" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="financialMonth" label="财务月">
              <a-select v-model:value="formData.financialMonth" :options="maintenanceMonthOptions" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="plateNo" label="车牌号">
              <a-auto-complete
                v-model:value="formData.plateNo"
                :options="baseVehicleOptions"
                :filter-option="filterVehicleOption"
                placeholder="请输入或选择车牌号"
                @select="handleVehicleSelect"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="挂车号">
              <a-input v-model:value="formData.trailerNo" placeholder="请输入挂车号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="project" label="维修项目">
              <a-input v-model:value="formData.project" placeholder="请输入维修项目" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="shop" label="送修地点">
              <a-input v-model:value="formData.shop" placeholder="请输入送修地点" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="维保公里数">
              <a-input-number v-model:value="formData.mileage" class="w-full" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="支出方式">
              <a-select v-model:value="formData.payType">
                <a-select-option value="备用金">
                  备用金
                </a-select-option>
                <a-select-option value="公司转账">
                  公司转账
                </a-select-option>
                <a-select-option value="油卡抵扣">
                  油卡抵扣
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="司机">
              <a-input v-model:value="formData.driver" placeholder="请输入司机" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="amount" label="金额(元)">
              <a-input-number v-model:value="formData.amount" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="审核状态">
              <a-select v-model:value="formData.status">
                <a-select-option value="待审核">
                  待审核
                </a-select-option>
                <a-select-option value="已审核">
                  已审核
                </a-select-option>
                <a-select-option value="推修中">
                  推修中
                </a-select-option>
                <a-select-option value="已驳回">
                  已驳回
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24">
            <a-form-item label="维保备注">
              <a-textarea v-model:value="formData.remark" :rows="2" placeholder="请输入维保备注" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
    <a-modal v-model:open="detailOpen" title="维保详情" :footer="null" width="760px">
      <a-descriptions v-if="detailRecord" bordered :column="2" size="small">
        <a-descriptions-item label="送修日期">
          {{ detailRecord.repairDate }}
        </a-descriptions-item>
        <a-descriptions-item label="财务月">
          {{ detailRecord.financialMonth }}
        </a-descriptions-item>
        <a-descriptions-item label="车牌号">
          {{ detailRecord.plateNo }}
        </a-descriptions-item>
        <a-descriptions-item label="挂车号">
          {{ detailRecord.trailerNo }}
        </a-descriptions-item>
        <a-descriptions-item label="维修项目">
          {{ detailRecord.project }}
        </a-descriptions-item>
        <a-descriptions-item label="送修地点">
          {{ detailRecord.shop }}
        </a-descriptions-item>
        <a-descriptions-item label="维保公里数">
          {{ formatMileage(detailRecord.mileage) }}
        </a-descriptions-item>
        <a-descriptions-item label="金额">
          {{ formatAmount(detailRecord.amount) }}
        </a-descriptions-item>
        <a-descriptions-item label="审核状态">
          <a-tag :color="statusColor(detailRecord.status)">
            {{ detailRecord.status }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="司机">
          {{ detailRecord.driver || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">
          {{ detailRecord.remark || '-' }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <a-modal
      v-model:open="inventoryModalOpen"
      :title="inventoryFormData.type === '入库' ? '配件入库' : '配件出库'"
      :confirm-loading="inventorySubmitting"
      width="720px"
      :mask-closable="false"
      :ok-text="inventoryFormData.type === '入库' ? '确认入库' : '确认出库并生成维保记录'"
      cancel-text="取消"
      @ok="handleInventorySubmit"
    >
      <a-alert
        v-if="inventoryFormData.type === '出库'"
        class="inventory-form-alert"
        type="info"
        show-icon
        message="出库后将按对应车号自动生成一条待审核维保记录"
      />
      <a-form ref="inventoryFormRef" :model="inventoryFormData" :rules="inventoryFormRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="8">
            <a-form-item name="movementDate" :label="`${inventoryFormData.type}日期`">
              <a-date-picker v-model:value="inventoryFormData.movementDate" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="16">
            <a-form-item name="partName" label="配件名称">
              <a-select
                v-if="inventoryFormData.type === '出库'"
                show-search
                placeholder="请选择有库存的配件"
                :options="inventoryPartOptions"
                @select="handleInventoryPartSelect"
              />
              <a-input v-else v-model:value="inventoryFormData.partName" placeholder="请输入配件名称" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="规格型号">
              <a-input v-model:value="inventoryFormData.specification" :disabled="inventoryFormData.type === '出库'" placeholder="请输入规格型号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="6">
            <a-form-item label="单位">
              <a-select v-model:value="inventoryFormData.unit" :disabled="inventoryFormData.type === '出库'">
                <a-select-option v-for="unit in ['件', '个', '条', '套', '桶', '升']" :key="unit" :value="unit">
                  {{ unit }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="6">
            <a-form-item name="quantity" label="数量">
              <a-input-number v-model:value="inventoryFormData.quantity" class="w-full" :min="0.001" :precision="3" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="unitPrice" label="单价(元)">
              <a-input-number v-model:value="inventoryFormData.unitPrice" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="金额(元)">
              <a-input-number :value="Number((inventoryFormData.quantity * inventoryFormData.unitPrice).toFixed(2))" class="w-full" disabled />
            </a-form-item>
          </a-col>
          <a-col v-if="inventoryFormData.type === '入库'" :xs="24" :md="8">
            <a-form-item label="供应商">
              <a-input v-model:value="inventoryFormData.supplier" placeholder="请输入供应商" />
            </a-form-item>
          </a-col>
          <template v-else>
            <a-col :xs="24" :md="8">
              <a-form-item name="plateNo" label="对应车号">
                <a-auto-complete
                  v-model:value="inventoryFormData.plateNo"
                  :options="baseVehicleOptions"
                  :filter-option="filterVehicleOption"
                  placeholder="请选择对应车号"
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="领用人">
                <a-input v-model:value="inventoryFormData.operator" placeholder="请输入领用人" />
              </a-form-item>
            </a-col>
          </template>
          <a-col :xs="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="inventoryFormData.remark" :rows="2" placeholder="请输入备注" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </page-container>
</template>

<style lang="less" scoped>
.maintenance-stats {
  margin-bottom: 16px;
}

.maintenance-card {
  margin-bottom: 16px;
}

.maintenance-tabs {
  margin-bottom: 16px;
  padding: 0 16px;
  background: #fff;
}

.inventory-search {
  width: 230px;
}

.inventory-type-filter {
  width: 112px;
}

.inventory-summary {
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;

  strong {
    color: #0f172a;
  }
}

.inventory-form-alert {
  margin-bottom: 16px;
}

.stat-card {
  min-height: 130px;

  :deep(.ant-card-body) {
    padding: 24px 28px;
  }
}

.stat-label {
  color: rgb(71 85 105);
  font-size: 15px;
}

.stat-value {
  margin-top: 12px;
  color: #1f2937;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;

  &.is-danger {
    color: #e82727;
  }

  &.is-warning {
    color: #f59f00;
  }

  &.is-primary {
    color: #2f80ed;
  }
}

.stat-hint {
  margin-top: 14px;
  color: #334155;
  font-size: 14px;

  &.is-danger {
    color: #e82727;
  }

  &.is-warning {
    color: #f59f00;
  }

  &.is-primary {
    color: #2f80ed;
  }
}

.chart-tip {
  color: #64748b;
  font-size: 13px;
}

.maintenance-chart {
  min-height: 320px;
}

.maintenance-query {
  display: flex;
  row-gap: 12px;

  :deep(.ant-form-item) {
    margin-inline-end: 14px;
    margin-bottom: 0;
  }
}

.filter-month {
  width: 132px;
}

.filter-shop {
  width: 176px;
}

.query-actions {
  margin-left: auto;
}

.amount-text {
  font-weight: 700;
}

.vehicle-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.vehicle-main {
  color: #0f172a;
  font-weight: 600;
}

.vehicle-sub {
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 768px) {
  .maintenance-query {
    display: block;

    :deep(.ant-form-item) {
      margin-right: 0;
      margin-bottom: 12px;
    }

    :deep(.ant-form-item-control),
    :deep(.ant-picker),
    :deep(.ant-input),
    :deep(.ant-select) {
      width: 100%;
    }
  }

  .query-actions {
    margin-left: 0;
  }

  .inventory-search,
  .inventory-type-filter {
    width: 100%;
  }
}
</style>
