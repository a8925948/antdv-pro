<script setup lang="ts">
import type { OfficeVehicle, OfficeVehicleDetail, OfficeVehicleExpense, OfficeVehicleInsurance, OfficeVehicleLicense, OfficeVehicleQuery, OfficeVehicleReminder, OfficeVehicleSummary } from '~@/api/office-vehicle'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import {
  changeOfficeVehicleExpenseStatusApi,
  deleteOfficeVehicleApi,
  deleteOfficeVehicleExpenseApi,
  deleteOfficeVehicleLicenseApi,
  deleteOfficeVehicleReminderApi,
  exportOfficeVehicleExpensesApi,
  getOfficeVehicleDetailApi,
  getOfficeVehicleExpenseListApi,
  getOfficeVehicleInsuranceListApi,
  getOfficeVehicleLicenseListApi,
  getOfficeVehicleListApi,
  getOfficeVehicleReminderListApi,
  getOfficeVehicleSummaryApi,
  handleOfficeVehicleReminderApi,

  saveOfficeVehicleApi,
  saveOfficeVehicleExpenseApi,
  saveOfficeVehicleInsuranceApi,
  saveOfficeVehicleLicenseApi,
  saveOfficeVehicleReminderApi,
  submitOfficeVehicleExpenseApprovalApi,
} from '~@/api/office-vehicle'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import RecordActions from '~@/components/record-actions/index.vue'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import { useRecordPermission } from '~@/composables/record-permission'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { downloadWorkbook } from '~@/utils/xlsx-export'

type SectionKey = 'vehicles' | 'expenses' | 'licenses' | 'insurances' | 'reminders'
type ModalType = 'vehicle' | 'expense' | 'license' | 'insurance' | 'reminder'

const message = useMessage()
const route = useRoute()
const { canEditRecord, canDeleteRecord, canAuditRecord } = useRecordPermission()
const loading = ref(false)
const errorMessage = ref('')
const { model: financialPeriodFilter, queryParams, resetFinancialPeriodFilter } = useFinancialPeriodFilter()

const vehicleRows = ref<OfficeVehicle[]>([])
const expenseRows = ref<OfficeVehicleExpense[]>([])
const licenseRows = ref<OfficeVehicleLicense[]>([])
const insuranceRows = ref<OfficeVehicleInsurance[]>([])
const reminderRows = ref<OfficeVehicleReminder[]>([])
const summary = ref<OfficeVehicleSummary>()
const detail = ref<OfficeVehicleDetail>()
const detailOpen = ref(false)
const editOpen = ref(false)
const modalType = ref<ModalType>('vehicle')
const editing = ref<Record<string, any>>({})
const detailSectionFilter = ref<'all' | SectionKey>('all')

const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const queryModel = reactive({
  plateNo: '',
  vehicleId: undefined as string | undefined,
  expenseType: undefined as string | undefined,
  licenseType: undefined as string | undefined,
  reminderType: undefined as string | undefined,
  departmentName: undefined as string | undefined,
  status: undefined as string | undefined,
})

const expenseTypes = ['加油费', '充电费', '维修费', '保养费', '保险费', '年检费', '停车费', '过路费', '洗车费', '违章罚款', '其他费用']
const licenseTypes = ['行驶证', '车辆登记证', '营运证', '道路运输证', '驾驶证', '其他证照']
const reminderTypes = ['车辆年审到期', '车辆保险到期', '车辆保养时间', '交强险到期', '商业险到期', '行驶证到期', '营运证到期', '道路运输证到期', '其他提醒']
const paymentMethods = ['企业微信', '公务卡', '银行转账', '现金', '个人垫付']
const vehicleStatuses = ['正常', '停用', '维修中', '已出售']
const expenseStatuses = ['草稿', '待审批', '审批中', '已确认', '已驳回', '已撤回']
const dueStatuses = ['正常', '即将到期', '已过期', '已处理']
const attachmentAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'
const createTypeOptions = [
  { label: '车辆档案', value: 'vehicle' },
  { label: '费用记录', value: 'expense' },
  { label: '证照资料', value: 'license' },
  { label: '保险信息', value: 'insurance' },
  { label: '到期事项', value: 'reminder' },
]

const vehicleOptions = computed(() => vehicleRows.value.map(item => ({ label: `${item.plateNo} / ${item.brandModel}`, value: item.id! })))
const availableMonthKeys = computed(() => [...new Set(expenseRows.value.map(item => dayjs(item.occurredDate).format('YYYYMM')))])

const summaryCards = computed(() => [
  { label: '车辆数量', value: summary.value?.vehicleCount ?? 0, hint: '当前权限范围', tone: 'primary' },
  { label: '本月费用', value: money(summary.value?.monthExpense), hint: '费用台账合计', tone: 'danger' },
  { label: '审批总金额', value: money(summary.value?.approvalTotalAmount), hint: '待审批/审批中/已确认', tone: 'primary' },
  { label: '使用金额', value: money(summary.value?.usedAmount), hint: '已确认计入运营数据', tone: 'success' },
  { label: '即将到期提醒', value: summary.value?.upcomingReminderCount ?? 0, hint: '需及时处理', tag: '30天内', tone: 'warning' },
  { label: '已过期提醒', value: summary.value?.expiredReminderCount ?? 0, hint: '证照/保险/保养', tone: 'danger' },
  { label: '已确认费用', value: money(summary.value?.confirmedExpense), hint: '财务可追溯', tone: 'success' },
  { label: '待审批费用', value: summary.value?.pendingExpenseCount ?? 0, hint: '已接入 OA 审批', tone: 'warning' },
])

const expenseColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '费用类型', dataIndex: 'expenseType', width: 110 },
  { title: '费用金额', dataIndex: 'amount', width: 120 },
  { title: '发生日期', dataIndex: 'occurredDate', width: 120 },
  { title: '经办人', dataIndex: 'handlerName', width: 100 },
  { title: '所属部门', dataIndex: 'departmentName', width: 120 },
  { title: '支付方式', dataIndex: 'paymentMethod', width: 110 },
  { title: '发票号', dataIndex: 'invoiceNo', width: 140 },
  { title: '票据附件', dataIndex: 'attachmentName', width: 160 },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 200 },
]
const licenseColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '证照类型', dataIndex: 'licenseType', width: 120 },
  { title: '证照编号', dataIndex: 'licenseNo', width: 150 },
  { title: '发证日期', dataIndex: 'issueDate', width: 120 },
  { title: '到期日期', dataIndex: 'expiryDate', width: 120 },
  { title: '发证机关', dataIndex: 'issuingAuthority', width: 180 },
  { title: '附件', dataIndex: 'attachmentName', width: 160 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 170 },
]
const insuranceColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '保险类型', dataIndex: 'insuranceType', width: 120 },
  { title: '保单号', dataIndex: 'policyNo', width: 150 },
  { title: '保险公司', dataIndex: 'insurer', width: 140 },
  { title: '保费', dataIndex: 'amount', width: 120 },
  { title: '开始日期', dataIndex: 'startDate', width: 120 },
  { title: '到期日期', dataIndex: 'endDate', width: 120 },
  { title: '附件', dataIndex: 'attachmentName', width: 160 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 150 },
]
const reminderColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '提醒类型', dataIndex: 'reminderType', width: 150 },
  { title: '到期日期', dataIndex: 'dueDate', width: 120 },
  { title: '提前天数', dataIndex: 'remindDays', width: 100 },
  { title: '提醒对象', dataIndex: 'targetNames', width: 160 },
  { title: '提醒状态', dataIndex: 'status', width: 110 },
  { title: '是否处理', dataIndex: 'handled', width: 100 },
  { title: '处理时间', dataIndex: 'handledAt', width: 160 },
  { title: '处理备注', dataIndex: 'handleRemark', ellipsis: true },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 150 },
]

const officeDetailColumns = computed(() => enhanceBusinessTableColumns([
  { title: '类型', dataIndex: 'sectionLabel', width: 100, fixed: 'left' as const },
  { title: '车牌号', dataIndex: 'plateNo', width: 130, fixed: 'left' as const },
  { title: '明细内容', dataIndex: 'itemName', width: 180 },
  { title: '金额', dataIndex: 'amount', width: 120 },
  { title: '业务日期/到期日', dataIndex: 'businessDate', width: 140 },
  { title: '经办/负责人', dataIndex: 'ownerName', width: 130 },
  { title: '所属部门', dataIndex: 'departmentName', width: 130 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '凭证/处理', dataIndex: 'attachmentName', width: 180, ellipsis: true },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 180 },
]))
const officeDetailScrollX = computed(() => createBusinessTableScrollX(officeDetailColumns.value, 1500))
const officeDetailRows = computed(() => [
  ...vehicleRows.value.map(row => ({
    id: `vehicle-${row.id}`,
    section: 'vehicles' as SectionKey,
    sectionLabel: '车辆',
    plateNo: row.plateNo,
    itemName: row.brandModel || row.vehicleType,
    amount: row.monthExpense,
    businessDate: row.purchaseDate || '-',
    ownerName: row.ownerName || row.defaultDriverName || '-',
    departmentName: row.departmentName,
    status: row.status,
    attachmentName: row.photoUrl || '-',
    remark: row.remark || `到期风险 ${row.riskCount ?? 0} 项`,
    raw: row,
  })),
  ...expenseRows.value.map(row => ({
    id: `expense-${row.id}`,
    section: 'expenses' as SectionKey,
    sectionLabel: '费用',
    plateNo: row.plateNo,
    itemName: row.expenseType,
    amount: row.amount,
    businessDate: row.occurredDate,
    ownerName: row.handlerName,
    departmentName: row.departmentName,
    status: row.approvalStatus,
    attachmentName: row.attachmentName || row.invoiceNo || '-',
    remark: row.remark || row.paymentMethod || '-',
    raw: row,
  })),
  ...licenseRows.value.map(row => ({
    id: `license-${row.id}`,
    section: 'licenses' as SectionKey,
    sectionLabel: '证照',
    plateNo: row.plateNo,
    itemName: row.licenseType,
    amount: undefined,
    businessDate: row.expiryDate || row.issueDate,
    ownerName: row.issuingAuthority || '-',
    departmentName: '-',
    status: row.status,
    attachmentName: row.attachmentName || row.licenseNo || '-',
    remark: row.remark || '-',
    raw: row,
  })),
  ...insuranceRows.value.map(row => ({
    id: `insurance-${row.id}`,
    section: 'insurances' as SectionKey,
    sectionLabel: '保险',
    plateNo: row.plateNo,
    itemName: row.insuranceType,
    amount: row.amount,
    businessDate: row.endDate || row.startDate,
    ownerName: row.insurer || '-',
    departmentName: '-',
    status: row.status,
    attachmentName: row.attachmentName || row.policyNo || '-',
    remark: row.remark || '-',
    raw: row,
  })),
  ...reminderRows.value.map(row => ({
    id: `reminder-${row.id}`,
    section: 'reminders' as SectionKey,
    sectionLabel: '到期事项',
    plateNo: row.plateNo,
    itemName: row.reminderType,
    amount: undefined,
    businessDate: row.dueDate,
    ownerName: Array.isArray(row.targetNames) ? row.targetNames.join('、') : row.targetNames,
    departmentName: '-',
    status: row.status,
    attachmentName: row.handled ? row.handledAt || '-' : '未处理',
    remark: row.handleRemark || `提前 ${row.remindDays} 天提醒`,
    raw: row,
  })),
])
const filteredOfficeDetailRows = computed(() => detailSectionFilter.value === 'all'
  ? officeDetailRows.value
  : officeDetailRows.value.filter(row => row.section === detailSectionFilter.value))
const detailFilterOptions = computed(() => [
  { label: `全部 ${officeDetailRows.value.length}`, value: 'all' },
  { label: `车辆 ${vehicleRows.value.length}`, value: 'vehicles' },
  { label: `费用 ${expenseRows.value.length}`, value: 'expenses' },
  { label: `证照 ${licenseRows.value.length}`, value: 'licenses' },
  { label: `保险 ${insuranceRows.value.length}`, value: 'insurances' },
  { label: `到期事项 ${reminderRows.value.length}`, value: 'reminders' },
])

const detailExpenseColumns = computed(() => enhanceBusinessTableColumns(expenseColumns.filter(item => item.dataIndex !== 'action')))
const detailLicenseColumns = computed(() => enhanceBusinessTableColumns(licenseColumns.filter(item => item.dataIndex !== 'action')))
const detailInsuranceColumns = computed(() => enhanceBusinessTableColumns(insuranceColumns.filter(item => item.dataIndex !== 'action')))
const detailReminderColumns = computed(() => enhanceBusinessTableColumns(reminderColumns.filter(item => item.dataIndex !== 'action')))
const detailExpenseScrollX = computed(() => createBusinessTableScrollX(detailExpenseColumns.value, 1200))
const detailLicenseScrollX = computed(() => createBusinessTableScrollX(detailLicenseColumns.value, 1100))
const detailInsuranceScrollX = computed(() => createBusinessTableScrollX(detailInsuranceColumns.value, 1100))
const detailReminderScrollX = computed(() => createBusinessTableScrollX(detailReminderColumns.value, 1100))

onMounted(() => {
  queryModel.plateNo = typeof route.query.plateNo === 'string' ? route.query.plateNo : ''
  queryModel.reminderType = typeof route.query.reminderType === 'string' ? route.query.reminderType : undefined
  loadAll()
})

function money(value?: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildQuery(): OfficeVehicleQuery {
  return {
    current: pagination.current,
    pageSize: pagination.pageSize,
    plateNo: queryModel.plateNo || undefined,
    vehicleId: queryModel.vehicleId,
    expenseType: queryModel.expenseType,
    licenseType: queryModel.licenseType,
    reminderType: queryModel.reminderType,
    departmentName: queryModel.departmentName,
    status: queryModel.status,
    ...queryParams.value,
  }
}

async function loadAll() {
  await loadList()
}

async function loadVehiclesForOptions() {
  try {
    const { data } = await getOfficeVehicleListApi({ current: 1, pageSize: 1000 })
    vehicleRows.value = data?.records || []
  }
  catch (error: any) {
    errorMessage.value = error?.message || '车辆数据加载失败'
    throw error
  }
}

async function loadList() {
  loading.value = true
  errorMessage.value = ''
  try {
    const query = { ...buildQuery(), current: 1, pageSize: 1000 }
    const [summaryResult, vehicleResult, expenseResult, licenseResult, insuranceResult, reminderResult] = await Promise.all([
      getOfficeVehicleSummaryApi(buildQuery()),
      getOfficeVehicleListApi(query),
      getOfficeVehicleExpenseListApi(query),
      getOfficeVehicleLicenseListApi(query),
      getOfficeVehicleInsuranceListApi(query),
      getOfficeVehicleReminderListApi(query),
    ])
    summary.value = summaryResult.data
    vehicleRows.value = vehicleResult.data?.records || []
    expenseRows.value = expenseResult.data?.records || []
    licenseRows.value = licenseResult.data?.records || []
    insuranceRows.value = insuranceResult.data?.records || []
    reminderRows.value = reminderResult.data?.records || []
    pagination.total = Math.max(
      vehicleResult.data?.total || 0,
      expenseResult.data?.total || 0,
      licenseResult.data?.total || 0,
      insuranceResult.data?.total || 0,
      reminderResult.data?.total || 0,
    )
  }
  catch (error: any) {
    errorMessage.value = error?.message || '数据加载失败'
    message.error(errorMessage.value)
  }
  finally {
    loading.value = false
  }
}

function resetQuery() {
  queryModel.plateNo = ''
  queryModel.vehicleId = undefined
  queryModel.expenseType = undefined
  queryModel.licenseType = undefined
  queryModel.reminderType = undefined
  queryModel.departmentName = undefined
  queryModel.status = undefined
  resetFinancialPeriodFilter()
  pagination.current = 1
  loadList()
}

function openCreate(type: ModalType) {
  modalType.value = type
  editing.value = defaultRecord(type)
  editOpen.value = true
}

function openCreateDetail() {
  openCreate('vehicle')
}

function changeCreateType(value: string | number) {
  const type = String(value) as ModalType
  modalType.value = type
  editing.value = defaultRecord(type)
}

function openEdit(type: ModalType, record: Record<string, any>) {
  modalType.value = type
  editing.value = { ...record }
  editOpen.value = true
}

function modalTypeLabel(type: ModalType) {
  return {
    vehicle: '车辆',
    expense: '费用',
    license: '证照',
    insurance: '保险',
    reminder: '到期事项',
  }[type]
}

function defaultRecord(type: ModalType) {
  if (type === 'vehicle')
    return { vehicleType: '', status: '正常', departmentName: '', ownerName: '', photoUrl: '' }
  if (type === 'expense')
    return { vehicleId: vehicleRows.value[0]?.id, expenseType: undefined, amount: 0, occurredDate: dayjs().format('YYYY-MM-DD'), handlerName: '', departmentName: '', paymentMethod: undefined, needApproval: false, approvalStatus: '草稿' }
  if (type === 'license')
    return { vehicleId: vehicleRows.value[0]?.id, licenseType: undefined, issueDate: undefined, expiryDate: undefined, status: '有效' }
  if (type === 'insurance')
    return { vehicleId: vehicleRows.value[0]?.id, insuranceType: undefined, amount: 0, startDate: undefined, endDate: undefined, status: '有效' }
  return { vehicleId: vehicleRows.value[0]?.id, reminderType: undefined, dueDate: undefined, remindDays: 30, targetNames: [] }
}

async function saveEdit() {
  errorMessage.value = ''
  const apiMap = {
    vehicle: saveOfficeVehicleApi,
    expense: saveOfficeVehicleExpenseApi,
    license: saveOfficeVehicleLicenseApi,
    insurance: saveOfficeVehicleInsuranceApi,
    reminder: saveOfficeVehicleReminderApi,
  }
  try {
    const { code, msg } = await apiMap[modalType.value](editing.value as any)
    if (code !== 200)
      return message.warning(msg)
    editOpen.value = false
    message.success('保存成功')
    await Promise.all([loadVehiclesForOptions(), loadList()])
  }
  catch (error: any) {
    errorMessage.value = error?.message || '保存失败'
    message.error(errorMessage.value)
  }
}

async function openDetail(record: OfficeVehicle) {
  if (!record.id)
    return
  try {
    const { data, code, msg } = await getOfficeVehicleDetailApi(record.id)
    if (code !== 200 || !data)
      return message.warning(msg)
    detail.value = data
    detailOpen.value = true
  }
  catch (error: any) {
    errorMessage.value = error?.message || '详情加载失败'
    message.error(errorMessage.value)
  }
}

async function exportExpenses() {
  try {
    const { data } = await exportOfficeVehicleExpensesApi(buildQuery())
    downloadWorkbook(`办公用车费用台账_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`, [{ name: '费用台账', rows: data || [] }])
  }
  catch (error: any) {
    errorMessage.value = error?.message || '导出失败'
    message.error(errorMessage.value)
  }
}

function statusColor(status: string) {
  if (/正常|有效|已确认|已处理/.test(status))
    return 'green'
  if (/即将|待审批|审批中|草稿|维修/.test(status))
    return 'orange'
  if (/过期|驳回|停用|出售/.test(status))
    return 'red'
  return 'blue'
}

function sectionColor(section: SectionKey) {
  return {
    vehicles: 'blue',
    expenses: 'green',
    licenses: 'cyan',
    insurances: 'purple',
    reminders: 'orange',
  }[section]
}

function displayCell(record: Record<string, any>, dataIndex: string) {
  const value = record[dataIndex]
  if (dataIndex === 'amount' && (value === undefined || value === null || value === ''))
    return '-'
  if (['amount', 'monthExpense'].includes(dataIndex))
    return money(value)
  if (Array.isArray(value))
    return value.join('、')
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  return value || '-'
}

function columnKey(dataIndex: unknown) {
  return Array.isArray(dataIndex) ? String(dataIndex[0] ?? '') : String(dataIndex ?? '')
}

function buildActions(section: SectionKey, record: any): RecordActionItem[] {
  const canEdit = canEditRecord(record)
  const canDelete = canDeleteRecord(record)
  const canAudit = canAuditRecord(record)
  if (section === 'vehicles') {
    return [
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, disabled: !canEdit.allowed, onClick: () => openEdit('vehicle', record) },
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: true,
        hidden: !canDelete.allowed,
        disabled: !canDelete.allowed,
        confirmTitle: '确定删除该车辆档案？',
        onClick: async () => {
          await deleteOfficeVehicleApi(record.id)
          await loadList()
        },
      },
    ]
  }
  if (section === 'expenses') {
    return [
      { key: 'view', label: '查看', onClick: () => { message.info(record.remark || '暂无更多信息') } },
      {
        key: 'submit',
        label: '提交审批',
        hidden: true,
        onClick: async () => {
          await submitOfficeVehicleExpenseApprovalApi(record.id)
          await loadList()
        },
      },
      {
        key: 'approve',
        label: '确认',
        hidden: record.needApproval || record.approvalStatus === '已确认' || !canAudit.allowed,
        onClick: async () => {
          await changeOfficeVehicleExpenseStatusApi(record.id, '已确认')
          await loadList()
        },
      },
      {
        key: 'reject',
        label: '驳回',
        danger: true,
        confirm: true,
        hidden: record.needApproval || !['待审批', '审批中'].includes(record.approvalStatus) || !canAudit.allowed,
        onClick: async () => {
          await changeOfficeVehicleExpenseStatusApi(record.id, '已驳回')
          await loadList()
        },
      },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, disabled: !canEdit.allowed, onClick: () => openEdit('expense', record) },
      { key: 'preview', label: '预览票据', hidden: !record.attachmentName, onClick: () => { message.info(record.attachmentName) } },
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: true,
        hidden: !canDelete.allowed,
        disabled: !canDelete.allowed,
        confirmTitle: '确定删除该费用记录？',
        onClick: async () => {
          await deleteOfficeVehicleExpenseApi(record.id)
          await loadList()
        },
      },
    ]
  }
  if (section === 'licenses') {
    return [
      { key: 'view', label: '查看', onClick: () => { message.info(record.attachmentName || '暂无附件') } },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, onClick: () => openEdit('license', record) },
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: true,
        hidden: !canDelete.allowed,
        confirmTitle: '确定删除该证照？',
        onClick: async () => {
          await deleteOfficeVehicleLicenseApi(record.id)
          await loadList()
        },
      },
    ]
  }
  if (section === 'insurances') {
    return [
      { key: 'view', label: '查看', onClick: () => { message.info(record.attachmentName || record.policyNo) } },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, onClick: () => openEdit('insurance', record) },
    ]
  }
  return [
    { key: 'view', label: '查看', onClick: () => { message.info(record.handleRemark || record.reminderType) } },
    { key: 'edit', label: '编辑', hidden: record.handled || !canEdit.allowed, onClick: () => openEdit('reminder', record) },
    {
      key: 'handle',
      label: '处理',
      hidden: record.handled || !canAudit.allowed,
      onClick: async () => {
        await handleOfficeVehicleReminderApi(record.id, '页面处理完成')
        await loadList()
      },
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      confirm: true,
      hidden: !canDelete.allowed,
      confirmTitle: '确定删除该到期事项？',
      onClick: async () => {
        await deleteOfficeVehicleReminderApi(record.id)
        await loadList()
      },
    },
  ]
}

function selectAttachment(file: File, field: 'photoUrl' | 'attachmentName') {
  uploadAttachment(file, field)
  return false
}

async function uploadAttachment(file: File, field: 'photoUrl' | 'attachmentName') {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: {
        Authorization: String(useAuthorization().value || ''),
      },
      body: formData,
    })
    const result = await res.json()
    if (!res.ok || result.code !== 200)
      throw new Error(result.msg || '上传失败')

    if (field === 'photoUrl') {
      editing.value.photoUrl = result.data.url
    }
    else {
      editing.value.attachmentName = result.data.originalName
      editing.value.attachmentUrl = result.data.url
    }
    message.success(`已上传 ${file.name}`)
  }
  catch (error: any) {
    message.error(error?.message || '上传失败')
  }
}
</script>

<template>
  <page-container>
    <a-card :bordered="false" mb-4>
      <a-row :gutter="[16, 16]" align="middle">
        <a-col :xs="24" :lg="14">
          <div text-20px font-600>
            办公用车
          </div>
          <div mt-2 c="var(--text-color-secondary)">
            聚焦车辆费用台账、证照资料、保险/年检/证照到期提醒，不做复杂派车和车队调度。
          </div>
        </a-col>
        <a-col :xs="24" :lg="10" style="text-align: right;">
          <a-space wrap>
            <a-button type="primary" @click="openCreateDetail">
              新增明细
            </a-button>
            <a-button @click="exportExpenses">
              导出费用台账
            </a-button>
          </a-space>
        </a-col>
      </a-row>
      <a-form mt-4 class="office-query" :label-col="{ span: 7 }">
        <a-row :gutter="[16, 0]">
          <FinancialPeriodFilter v-model="financialPeriodFilter" :available-month-keys="availableMonthKeys" />
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="车辆">
              <a-select v-model:value="queryModel.vehicleId" allow-clear show-search :options="vehicleOptions" placeholder="请选择车辆" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="车牌">
              <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车牌" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="费用类型">
              <a-select v-model:value="queryModel.expenseType" allow-clear :options="expenseTypes.map(item => ({ label: item, value: item }))" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="证照类型">
              <a-select v-model:value="queryModel.licenseType" allow-clear :options="licenseTypes.map(item => ({ label: item, value: item }))" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="提醒类型">
              <a-select v-model:value="queryModel.reminderType" allow-clear :options="reminderTypes.map(item => ({ label: item, value: item }))" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear :options="[...vehicleStatuses, ...expenseStatuses, ...dueStatuses].map(item => ({ label: item, value: item }))" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadList">
                  查询
                </a-button>
                <a-button @click="resetQuery">
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-alert v-if="errorMessage" mb-4 type="error" show-icon :message="errorMessage" closable @close="errorMessage = ''" />

    <section class="office-summary-grid">
      <div v-for="item in summaryCards" :key="item.label" class="office-summary-card" :class="`tone-${item.tone}`">
        <div class="summary-label">
          {{ item.label }}
        </div>
        <strong>{{ item.value }}</strong>
        <span>{{ item.hint }}</span>
        <a-tag v-if="item.tag" size="small">
          {{ item.tag }}
        </a-tag>
      </div>
    </section>

    <a-card title="办公用车明细表" :bordered="false" class="office-section-card">
      <template #extra>
        <a-space>
          <a-tag color="blue">
            当前 {{ filteredOfficeDetailRows.length }} / 共 {{ officeDetailRows.length }} 条
          </a-tag>
          <a-button type="primary" @click="openCreateDetail">
            新增明细
          </a-button>
        </a-space>
      </template>
      <div class="detail-filter-bar">
        <a-segmented v-model:value="detailSectionFilter" :options="detailFilterOptions" />
      </div>
      <a-table :key="detailSectionFilter" row-key="id" :loading="loading" :columns="officeDetailColumns" :data-source="filteredOfficeDetailRows" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }" :scroll="{ x: officeDetailScrollX }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'sectionLabel'">
            <a-tag :color="sectionColor(record.section)">
              {{ record.sectionLabel }}
            </a-tag>
          </template>
          <template v-else-if="['status', 'approvalStatus'].includes(columnKey(column.dataIndex))">
            <a-tag :color="statusColor(record[columnKey(column.dataIndex)])">
              {{ record[columnKey(column.dataIndex)] }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <RecordActions :actions="buildActions(record.section, record.raw)" />
          </template>
          <template v-else>
            <a-tooltip :title="displayCell(record, columnKey(column.dataIndex))">
              <span class="cell-ellipsis">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="editOpen" :title="editing.id ? `编辑${modalTypeLabel(modalType)}` : '新增办公用车明细'" width="760px" :mask-closable="false" ok-text="保存" @ok="saveEdit">
      <div v-if="!editing.id" class="create-type-picker">
        <div class="create-type-label">
          明细类型
        </div>
        <a-segmented :value="modalType" block :options="createTypeOptions" @change="changeCreateType" />
      </div>
      <a-form layout="vertical">
        <a-row :gutter="16">
          <template v-if="modalType === 'vehicle'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车牌号">
                <a-input v-model:value="editing.plateNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="品牌型号">
                <a-input v-model:value="editing.brandModel" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆类型">
                <a-input v-model:value="editing.vehicleType" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="所属部门">
                <a-input v-model:value="editing.departmentName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="负责人">
                <a-input v-model:value="editing.ownerName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="默认司机">
                <a-input v-model:value="editing.defaultDriverName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆状态">
                <a-select v-model:value="editing.status" :options="vehicleStatuses.map(item => ({ label: item, value: item }))" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="购置日期">
                <a-date-picker v-model:value="editing.purchaseDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="车辆照片">
                <a-upload :show-upload-list="false" accept="image/*" :before-upload="(file: File) => selectAttachment(file, 'photoUrl')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片
                  </a-button>
                </a-upload>
                <div v-if="editing.photoUrl" class="attachment-name">
                  {{ editing.photoUrl }}
                </div>
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'expense'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆">
                <a-select v-model:value="editing.vehicleId" :options="vehicleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="费用类型">
                <a-select v-model:value="editing.expenseType" :options="expenseTypes.map(item => ({ label: item, value: item }))" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="费用金额">
                <a-input-number v-model:value="editing.amount" :min="0" :precision="2" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发生日期">
                <a-date-picker v-model:value="editing.occurredDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="经办人">
                <a-input v-model:value="editing.handlerName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="所属部门">
                <a-input v-model:value="editing.departmentName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="支付方式">
                <a-select v-model:value="editing.paymentMethod" :options="paymentMethods.map(item => ({ label: item, value: item }))" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发票号">
                <a-input v-model:value="editing.invoiceNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="票据附件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => selectAttachment(file, 'attachmentName')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片/文件
                  </a-button>
                </a-upload>
                <div v-if="editing.attachmentName" class="attachment-name">
                  {{ editing.attachmentName }}
                </div>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="是否需要审批">
                <a-switch v-model:checked="editing.needApproval" />
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'license'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆">
                <a-select v-model:value="editing.vehicleId" :options="vehicleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="证照类型">
                <a-select v-model:value="editing.licenseType" :options="licenseTypes.map(item => ({ label: item, value: item }))" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="证照编号">
                <a-input v-model:value="editing.licenseNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发证日期">
                <a-date-picker v-model:value="editing.issueDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="到期日期">
                <a-date-picker v-model:value="editing.expiryDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发证机关">
                <a-input v-model:value="editing.issuingAuthority" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="附件图片/扫描件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => selectAttachment(file, 'attachmentName')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片/文件
                  </a-button>
                </a-upload>
                <div v-if="editing.attachmentName" class="attachment-name">
                  {{ editing.attachmentName }}
                </div>
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'insurance'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆">
                <a-select v-model:value="editing.vehicleId" :options="vehicleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保险类型">
                <a-input v-model:value="editing.insuranceType" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保单号">
                <a-input v-model:value="editing.policyNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保险公司">
                <a-input v-model:value="editing.insurer" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保费">
                <a-input-number v-model:value="editing.amount" :min="0" :precision="2" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="起止日期">
                <a-range-picker v-model:value="editing.insuranceRange" value-format="YYYY-MM-DD" style="width: 100%;" @change="(value: any) => { editing.startDate = value?.[0]; editing.endDate = value?.[1] }" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="保单附件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => selectAttachment(file, 'attachmentName')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片/文件
                  </a-button>
                </a-upload>
                <div v-if="editing.attachmentName" class="attachment-name">
                  {{ editing.attachmentName }}
                </div>
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'reminder'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆" required>
                <a-select v-model:value="editing.vehicleId" show-search option-filter-prop="label" :options="vehicleOptions" placeholder="请选择车辆" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="事项类型" required>
                <a-select v-model:value="editing.reminderType" :options="reminderTypes.slice(0, 3).map(item => ({ label: item, value: item }))" placeholder="请选择事项类型" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item :label="editing.reminderType === '车辆保养时间' ? '保养日期' : '到期日期'" required>
                <a-date-picker v-model:value="editing.dueDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="提前提醒天数">
                <a-input-number v-model:value="editing.remindDays" :min="0" :max="365" :precision="0" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="提醒对象">
                <a-select v-model:value="editing.targetNames" mode="tags" :max-tag-count="3" placeholder="输入姓名或岗位后回车；留空时使用车辆负责人" />
              </a-form-item>
            </a-col>
          </template>
          <a-col v-if="modalType !== 'reminder'" :xs="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="editing.remark" :rows="3" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="detailOpen" title="车辆详情" width="960px" :footer="null">
      <a-descriptions v-if="detail" bordered size="small" :column="2">
        <a-descriptions-item label="车牌号">
          {{ detail.vehicle.plateNo }}
        </a-descriptions-item>
        <a-descriptions-item label="品牌型号">
          {{ detail.vehicle.brandModel }}
        </a-descriptions-item>
        <a-descriptions-item label="所属部门">
          {{ detail.vehicle.departmentName }}
        </a-descriptions-item>
        <a-descriptions-item label="负责人">
          {{ detail.vehicle.ownerName }}
        </a-descriptions-item>
        <a-descriptions-item label="车辆状态">
          {{ detail.vehicle.status }}
        </a-descriptions-item>
        <a-descriptions-item label="购置日期">
          {{ detail.vehicle.purchaseDate || '-' }}
        </a-descriptions-item>
      </a-descriptions>
      <a-tabs v-if="detail" mt-4>
        <a-tab-pane key="expense" tab="费用记录">
          <a-table size="small" :pagination="false" :columns="detailExpenseColumns" :data-source="detail.expenses" :scroll="{ x: detailExpenseScrollX }">
            <template #bodyCell="{ column, record }">
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="license" tab="证照资料">
          <a-table size="small" :pagination="false" :columns="detailLicenseColumns" :data-source="detail.licenses" :scroll="{ x: detailLicenseScrollX }">
            <template #bodyCell="{ column, record }">
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="insurance" tab="保险信息">
          <a-table size="small" :pagination="false" :columns="detailInsuranceColumns" :data-source="detail.insurances" :scroll="{ x: detailInsuranceScrollX }">
            <template #bodyCell="{ column, record }">
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="reminder" tab="到期提醒">
          <a-table size="small" :pagination="false" :columns="detailReminderColumns" :data-source="detail.reminders" :scroll="{ x: detailReminderScrollX }">
            <template #bodyCell="{ column, record }">
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="log" tab="操作日志">
          <a-timeline>
            <a-timeline-item v-for="log in detail.logs" :key="log.id">
              {{ log.createdAt }} {{ log.operatorName }} {{ log.content }}
            </a-timeline-item>
          </a-timeline>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </page-container>
</template>

<style scoped lang="less">
.office-query {
  :deep(.ant-form-item) {
    margin-bottom: 0;
  }

  :deep(.ant-picker),
  :deep(.ant-input),
  :deep(.ant-select) {
    width: 100%;
  }
}

.detail-filter-bar {
  display: flex;
  margin-bottom: 16px;
  overflow-x: auto;

  :deep(.ant-segmented) {
    min-width: max-content;
  }
}

.create-type-picker {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.create-type-label {
  margin-bottom: 8px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.office-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.office-summary-card {
  position: relative;
  min-height: 96px;
  padding: 14px 16px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 8px rgb(15 23 42 / 4%);

  &::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    background: #1677ff;
    content: '';
  }

  .summary-label {
    color: #475569;
    font-size: 13px;
    font-weight: 600;
  }

  strong {
    display: block;
    margin: 8px 0 4px;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.15;
    white-space: nowrap;
  }

  span {
    display: block;
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.ant-tag) {
    margin-top: 8px;
  }

  &.tone-success::before {
    background: #16a34a;
  }

  &.tone-danger::before {
    background: #dc2626;
  }

  &.tone-warning::before {
    background: #d97706;
  }
}

.office-section-card {
  margin-bottom: 16px;
}

.attachment-name {
  margin-top: 8px;
  color: var(--text-color-secondary);
  font-size: 13px;
  word-break: break-all;
}

@media (max-width: 1280px) {
  .office-summary-grid {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }
}

@media (max-width: 720px) {
  .office-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
