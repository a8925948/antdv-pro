<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { Dayjs } from 'dayjs'
import {
  DownloadOutlined,
  ExportOutlined,
  FileExcelOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import * as XLSX from 'xlsx'
import { getApprovalInstancesApi, submitApprovalApi } from '~@/api/approval'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { flushTransportOperationData, transportOperationError, transportOperationLoading, transportVehicleLoanRows } from '~@/composables/transport-operation-data'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { getLoanApprovalAmount, parseVehicleLoanWorkbook } from './import-utils'

type LoanStatus = '未开始' | '还款中' | '临近到期' | '已逾期' | '已结清'
type PaymentMethod = '银行转账' | '现金' | '承兑' | '其他'

interface RepaymentRecord {
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

interface VehicleLoanRecord {
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

interface LoanPlanRow {
  periodNo: number
  dueDate: string
  scheduledAmount: number
  scheduledPrincipal: number
  scheduledInterest: number
  paidAmount: number
  paidPrincipal: number
  paidInterest: number
  remainingPrincipal: number
  overdueDays: number
  status: LoanStatus | '已还款'
}

interface LoanComputed {
  paidPeriods: number
  remainingPeriods: number
  paidAmount: number
  paidPrincipal: number
  remainingPrincipal: number
  overdueDays: number
  nextDueDate: string
  status: LoanStatus
}

interface QueryModel {
  keyword?: string
  plateNo?: string
  lender?: string
  status?: LoanStatus
  dueRange?: [Dayjs, Dayjs]
}

type LoanForm = Omit<VehicleLoanRecord, 'id' | 'startDate' | 'firstDueDate' | 'payments'> & {
  id?: number
  startDate?: Dayjs
  firstDueDate?: Dayjs
}

interface PaymentForm {
  loanId?: number
  periodNo?: number
  paymentDate?: Dayjs
  amount: number
  principal: number
  interest: number
  method: PaymentMethod
  voucherNo?: string
  remark?: string
}

const message = useMessage()
const fileInputRef = ref<HTMLInputElement>()
const modalOpen = ref(false)
const detailOpen = ref(false)
const planOpen = ref(false)
const paymentOpen = ref(false)
const submitting = ref(false)
const isUpdate = ref(false)
const formRef = ref<FormInstance>()
const paymentFormRef = ref<FormInstance>()
const formData = ref<LoanForm>(createEmptyLoanForm())
const paymentForm = ref<PaymentForm>(createEmptyPaymentForm())
const detailRecord = ref<VehicleLoanRecord>()
const planRecord = ref<VehicleLoanRecord>()
const paymentRecord = ref<VehicleLoanRecord>()
const queryModel = reactive<QueryModel>({})

const lenderOptions = ['青海银行', '建设银行', '工商银行', '平安租赁', '东风金融', '解放金融']
  .map(value => ({ label: value, value }))
const statusOptions: LoanStatus[] = ['未开始', '还款中', '临近到期', '已逾期', '已结清']
const paymentMethods: PaymentMethod[] = ['银行转账', '现金', '承兑', '其他']

const records = transportVehicleLoanRows

const columns = shallowRef([
  { title: '合同编号', dataIndex: 'contractNo', width: 130, fixed: 'left' as const },
  { title: '车辆', dataIndex: 'vehicleInfo', width: 130, fixed: 'left' as const },
  { title: '贷款机构', dataIndex: 'lender', width: 120 },
  { title: '贷款金额', dataIndex: 'loanAmount', width: 120 },
  { title: '月供金额', dataIndex: 'monthlyPayment', width: 120 },
  { title: '总期数', dataIndex: 'totalPeriods', width: 90 },
  { title: '剩余期数', dataIndex: 'remainingPeriods', width: 100 },
  { title: '剩余本金', dataIndex: 'remainingPrincipal', width: 130 },
  { title: '下期应还日', dataIndex: 'nextDueDate', width: 120 },
  { title: '逾期天数', dataIndex: 'overdueDays', width: 100 },
  { title: '还款状态', dataIndex: 'status', width: 110 },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 210 },
])
const tableColumns = computed(() => enhanceBusinessTableColumns(columns.value))
const tableScrollX = computed(() => createBusinessTableScrollX(tableColumns.value, 1400))

const planColumns = shallowRef([
  { title: '期数', dataIndex: 'periodNo', width: 70 },
  { title: '应还日期', dataIndex: 'dueDate', width: 120 },
  { title: '应还金额', dataIndex: 'scheduledAmount', width: 110 },
  { title: '应还本金', dataIndex: 'scheduledPrincipal', width: 110 },
  { title: '应还利息', dataIndex: 'scheduledInterest', width: 110 },
  { title: '已还金额', dataIndex: 'paidAmount', width: 110 },
  { title: '剩余本金', dataIndex: 'remainingPrincipal', width: 120 },
  { title: '逾期天数', dataIndex: 'overdueDays', width: 100 },
  { title: '状态', dataIndex: 'status', width: 100 },
])
const planTableColumns = computed(() => enhanceBusinessTableColumns(planColumns.value))
const planTableScrollX = computed(() => createBusinessTableScrollX(planTableColumns.value, 980))

const formRules: Record<string, Rule[]> = {
  contractNo: [{ required: true, message: '请输入合同编号', trigger: 'blur' }],
  plateNo: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  lender: [{ required: true, message: '请选择贷款机构', trigger: 'change' }],
  loanAmount: [{ required: true, message: '请输入贷款金额', trigger: 'change' }],
  principalAmount: [{ required: true, message: '请输入本金金额', trigger: 'change' }],
  totalPeriods: [{ required: true, message: '请输入总期数', trigger: 'change' }],
  firstDueDate: [{ required: true, message: '请选择首期还款日', trigger: 'change' }],
  monthlyPayment: [{ required: true, message: '请输入月供金额', trigger: 'change' }],
}

const paymentRules: Record<string, Rule[]> = {
  periodNo: [{ required: true, message: '请选择还款期数', trigger: 'change' }],
  paymentDate: [{ required: true, message: '请选择还款日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入还款金额', trigger: 'change' }],
  principal: [{ required: true, message: '请输入偿还本金', trigger: 'change' }],
}

const filteredRecords = computed(() => {
  return records.value.filter((record) => {
    const computed = getLoanComputed(record)
    const keyword = queryModel.keyword?.trim()
    if (keyword && ![record.contractNo, record.plateNo, record.trailerNo, record.owner, record.remark].some(value => String(value || '').includes(keyword)))
      return false
    if (queryModel.plateNo && !`${record.plateNo}${record.trailerNo || ''}`.includes(queryModel.plateNo))
      return false
    if (queryModel.lender && record.lender !== queryModel.lender)
      return false
    if (queryModel.status && computed.status !== queryModel.status)
      return false
    if (queryModel.dueRange?.length === 2 && computed.nextDueDate) {
      const nextDue = dayjs(computed.nextDueDate)
      if (nextDue.isBefore(queryModel.dueRange[0], 'day') || nextDue.isAfter(queryModel.dueRange[1], 'day'))
        return false
    }
    return true
  })
})

const summaryCards = computed(() => {
  const source = filteredRecords.value
  const summary = source.reduce((acc, record) => {
    const computed = getLoanComputed(record)
    acc.totalLoan += record.loanAmount
    acc.remainingPrincipal += computed.remainingPrincipal
    acc.monthlyPayment += computed.status === '已结清' ? 0 : record.monthlyPayment
    if (computed.status === '已逾期')
      acc.overdueCount += 1
    if (computed.status === '已结清')
      acc.settledCount += 1
    return acc
  }, { totalLoan: 0, remainingPrincipal: 0, monthlyPayment: 0, overdueCount: 0, settledCount: 0 })

  return [
    { label: '贷款合同数', value: source.length, hint: `${summary.settledCount} 笔已结清`, tone: 'primary' as const },
    { label: '贷款总额', value: formatAmount(summary.totalLoan), hint: '当前筛选范围', tone: 'default' as const },
    { label: '剩余本金', value: formatAmount(summary.remainingPrincipal), hint: `月供合计 ${formatAmount(summary.monthlyPayment)}`, tone: 'warning' as const },
    { label: '逾期合同', value: summary.overdueCount, hint: summary.overdueCount ? '需跟进还款' : '无逾期', tag: summary.overdueCount ? '预警' : '正常', tone: summary.overdueCount ? 'danger' as const : 'success' as const },
  ]
})

const planRows = computed(() => planRecord.value ? buildRepaymentPlan(planRecord.value) : [])
const unpaidPeriodOptions = computed(() => {
  if (!paymentRecord.value)
    return []
  return buildRepaymentPlan(paymentRecord.value)
    .filter(row => row.status !== '已还款')
    .map(row => ({ label: `第 ${row.periodNo} 期 / ${row.dueDate} / 应还 ${formatAmount(row.scheduledAmount)}`, value: row.periodNo }))
})

watch(() => paymentForm.value.periodNo, (periodNo) => {
  if (!paymentRecord.value || !periodNo)
    return
  const row = buildRepaymentPlan(paymentRecord.value).find(item => item.periodNo === periodNo)
  if (!row)
    return
  paymentForm.value.amount = round2(Math.max(row.scheduledAmount - row.paidAmount, 0))
  paymentForm.value.principal = round2(Math.max(row.scheduledPrincipal - row.paidPrincipal, 0))
  paymentForm.value.interest = round2(Math.max(row.scheduledInterest - row.paidInterest, 0))
})

onMounted(() => {
  loadLoanApprovalStatus()
})

async function loadLoanApprovalStatus() {
  const res = await getApprovalInstancesApi({ businessType: 'vehicle_loan' })
  const instanceMap = new Map((res.data ?? []).map(item => [String(item.businessId), item]))
  records.value.forEach((record) => {
    const instance = instanceMap.get(`VL-${record.id}`)
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

function createEmptyLoanForm(): LoanForm {
  const startDate = dayjs()
  return {
    contractNo: '',
    plateNo: '',
    trailerNo: '',
    lender: '',
    loanAmount: 0,
    principalAmount: 0,
    annualRate: 4.5,
    totalPeriods: 36,
    startDate,
    firstDueDate: startDate.add(1, 'month'),
    monthlyPayment: 0,
    owner: '',
    remark: '',
  }
}

function createEmptyPaymentForm(): PaymentForm {
  return {
    periodNo: undefined,
    paymentDate: dayjs(),
    amount: 0,
    principal: 0,
    interest: 0,
    method: '银行转账',
    voucherNo: '',
    remark: '',
  }
}

function round2(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function getScheduledInterest(record: VehicleLoanRecord, remainingPrincipal: number) {
  return round2(remainingPrincipal * (record.annualRate / 100 / 12))
}

function buildRepaymentPlan(record: VehicleLoanRecord): LoanPlanRow[] {
  let remainingPrincipal = record.principalAmount
  return Array.from({ length: record.totalPeriods }, (_, index) => {
    const periodNo = index + 1
    const dueDate = dayjs(record.firstDueDate).add(index, 'month').format('YYYY-MM-DD')
    const paidList = record.payments.filter(payment => payment.periodNo === periodNo)
    const paidAmount = round2(paidList.reduce((sum, payment) => sum + payment.amount, 0))
    const paidPrincipal = round2(paidList.reduce((sum, payment) => sum + payment.principal, 0))
    const paidInterest = round2(paidList.reduce((sum, payment) => sum + payment.interest, 0))
    const scheduledInterest = getScheduledInterest(record, remainingPrincipal)
    const scheduledPrincipal = round2(Math.min(record.monthlyPayment - scheduledInterest, remainingPrincipal))
    const scheduledAmount = round2(scheduledPrincipal + scheduledInterest)
    remainingPrincipal = round2(Math.max(remainingPrincipal - paidPrincipal, 0))
    const isPaid = paidPrincipal >= scheduledPrincipal || paidAmount >= scheduledAmount
    const overdueDays = isPaid ? 0 : Math.max(dayjs().diff(dayjs(dueDate), 'day'), 0)
    const status = isPaid ? '已还款' : overdueDays > 0 ? '已逾期' : dayjs(dueDate).diff(dayjs(), 'day') <= 7 ? '临近到期' : '还款中'
    return {
      periodNo,
      dueDate,
      scheduledAmount,
      scheduledPrincipal,
      scheduledInterest,
      paidAmount,
      paidPrincipal,
      paidInterest,
      remainingPrincipal,
      overdueDays,
      status,
    }
  })
}

function getLoanComputed(record: VehicleLoanRecord): LoanComputed {
  const plan = buildRepaymentPlan(record)
  const paidPrincipal = round2(record.payments.reduce((sum, payment) => sum + payment.principal, 0))
  const paidAmount = round2(record.payments.reduce((sum, payment) => sum + payment.amount, 0))
  const remainingPrincipal = round2(Math.max(record.principalAmount - paidPrincipal, 0))
  const paidPeriods = plan.filter(item => item.status === '已还款').length
  const remainingPeriods = Math.max(record.totalPeriods - paidPeriods, 0)
  const nextPlan = plan.find(item => item.status !== '已还款')
  const overdueDays = Math.max(...plan.map(item => item.overdueDays), 0)
  let status: LoanStatus = '还款中'
  if (remainingPrincipal <= 0 || remainingPeriods === 0)
    status = '已结清'
  else if (dayjs(record.firstDueDate).isAfter(dayjs(), 'day') && paidPeriods === 0)
    status = '未开始'
  else if (overdueDays > 0)
    status = '已逾期'
  else if (nextPlan && dayjs(nextPlan.dueDate).diff(dayjs(), 'day') <= 7)
    status = '临近到期'

  return {
    paidPeriods,
    remainingPeriods,
    paidAmount,
    paidPrincipal,
    remainingPrincipal,
    overdueDays,
    nextDueDate: nextPlan?.dueDate || '',
    status,
  }
}

function asLoanRecord(record: Record<string, any>) {
  return record as VehicleLoanRecord
}

function getLoanAmountCell(record: Record<string, any>, dataIndex: unknown) {
  const key = String(dataIndex) as 'loanAmount' | 'monthlyPayment'
  return Number(record[key] || 0)
}

function displayVehicleValue(value?: string) {
  return value || '-'
}

function getLoanComputedCell(record: Record<string, any>) {
  return getLoanComputed(asLoanRecord(record))
}

function getPlanAmountCell(record: Record<string, any>, dataIndex: unknown) {
  const key = String(dataIndex) as keyof LoanPlanRow
  return Number(record[key] || 0)
}

function handleSearch() {
  message.success('查询成功')
}

function handleReset() {
  Object.keys(queryModel).forEach((key) => {
    delete queryModel[key as keyof QueryModel]
  })
}

function handleAdd() {
  isUpdate.value = false
  formData.value = createEmptyLoanForm()
  modalOpen.value = true
}

function handleView(record: VehicleLoanRecord) {
  detailRecord.value = record
  detailOpen.value = true
}

function handleEdit(record: VehicleLoanRecord) {
  isUpdate.value = true
  formData.value = {
    ...record,
    startDate: dayjs(record.startDate),
    firstDueDate: dayjs(record.firstDueDate),
  }
  modalOpen.value = true
}

async function handleSubmit() {
  const snapshot = structuredClone(records.value)
  try {
    await formRef.value?.validate()
    submitting.value = true
    const payload: VehicleLoanRecord = {
      id: formData.value.id || Math.max(...records.value.map(item => item.id), 0) + 1,
      contractNo: formData.value.contractNo.trim(),
      plateNo: formData.value.plateNo.trim(),
      trailerNo: formData.value.trailerNo?.trim(),
      lender: formData.value.lender,
      loanAmount: Number(formData.value.loanAmount || 0),
      principalAmount: Number(formData.value.principalAmount || formData.value.loanAmount || 0),
      annualRate: Number(formData.value.annualRate || 0),
      totalPeriods: Number(formData.value.totalPeriods || 0),
      startDate: formData.value.startDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      firstDueDate: formData.value.firstDueDate?.format('YYYY-MM-DD') || dayjs().add(1, 'month').format('YYYY-MM-DD'),
      monthlyPayment: Number(formData.value.monthlyPayment || 0),
      owner: formData.value.owner?.trim(),
      remark: formData.value.remark?.trim(),
      payments: isUpdate.value && formData.value.id
        ? records.value.find(item => item.id === formData.value.id)?.payments || []
        : [],
    }

    if (isUpdate.value) {
      const index = records.value.findIndex(item => item.id === payload.id)
      if (index > -1)
        records.value[index] = payload
    }
    else {
      records.value.unshift(payload)
    }
    await nextTick()
    await flushTransportOperationData()
    modalOpen.value = false
    message.success(isUpdate.value ? '编辑成功' : '新增成功')
  }
  catch (error: any) {
    records.value = snapshot
    message.error(error?.message || '车贷记录保存失败，已恢复修改前数据')
  }
  finally {
    submitting.value = false
  }
}

async function handleDelete(record: VehicleLoanRecord) {
  const snapshot = structuredClone(records.value)
  try {
    records.value = records.value.filter(item => item.id !== record.id)
    await nextTick()
    await flushTransportOperationData()
    message.success('删除成功')
  }
  catch (error: any) {
    records.value = snapshot
    message.error(error?.message || '删除失败，已恢复原数据')
  }
}

async function handleSubmitApproval(record: VehicleLoanRecord) {
  if (String(record.approvalStatus ?? '') === '审批中')
    return message.warning('该车贷记录已提交审批')

  const computedLoan = getLoanComputed(record)
  const approvalAmount = getLoanApprovalAmount(record)
  if (!approvalAmount)
    return message.warning('该车贷已无待还期次')
  const snapshot = { ...record }
  try {
    const detail = await submitApprovalApi({
      businessType: 'vehicle_loan',
      businessModule: '车贷费用',
      businessId: `VL-${record.id}`,
      businessNo: record.contractNo,
      title: `车贷审批-${record.plateNo}`,
      applicantId: 1,
      applicantName: '超级管理员',
      deptId: 'transport',
      deptName: '运输管理部',
      amount: approvalAmount,
      formData: {
        moduleName: '车贷费用',
        modulePath: '/transport/vehicle-loans',
        plateNo: record.plateNo,
        occurredDate: computedLoan.nextDueDate || record.firstDueDate,
        feeType: '车贷',
        amount: approvalAmount,
        lender: record.lender,
        contractNo: record.contractNo,
        businessNo: record.contractNo,
      },
    })
    record.approvalStatus = detail.data?.instance?.status || 'PENDING'
    record.approvalInstanceId = detail.data?.instance?.id
    await nextTick()
    await flushTransportOperationData()
    message.success('已提交审批')
  }
  catch (error: any) {
    Object.assign(record, snapshot)
    message.error(error?.message || '提交审批失败')
  }
}

function handlePlan(record: VehicleLoanRecord) {
  planRecord.value = record
  planOpen.value = true
}

function handlePayment(record: VehicleLoanRecord) {
  paymentRecord.value = record
  const firstUnpaid = buildRepaymentPlan(record).find(item => item.status !== '已还款')
  paymentForm.value = createEmptyPaymentForm()
  paymentForm.value.loanId = record.id
  paymentForm.value.periodNo = firstUnpaid?.periodNo
  paymentOpen.value = true
}

async function handlePaymentSubmit() {
  const snapshot = structuredClone(records.value)
  try {
    await paymentFormRef.value?.validate()
    const target = records.value.find(item => item.id === paymentForm.value.loanId)
    if (!target)
      return
    target.payments.push({
      id: Math.max(...target.payments.map(item => item.id), 0) + 1,
      periodNo: Number(paymentForm.value.periodNo),
      paymentDate: paymentForm.value.paymentDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      amount: Number(paymentForm.value.amount || 0),
      principal: Number(paymentForm.value.principal || 0),
      interest: Number(paymentForm.value.interest || 0),
      method: paymentForm.value.method,
      voucherNo: paymentForm.value.voucherNo?.trim(),
      remark: paymentForm.value.remark?.trim(),
    })
    await nextTick()
    await flushTransportOperationData()
    paymentOpen.value = false
    message.success('还款登记成功')
  }
  catch (error: any) {
    records.value = snapshot
    message.error(error?.message || '还款记录保存失败，已恢复修改前数据')
  }
}

function handleTemplate() {
  const worksheet = XLSX.utils.json_to_sheet([{
    合同编号: '',
    车牌号: '',
    挂车号: '',
    贷款机构: '',
    贷款金额: '',
    本金金额: '',
    年利率: '',
    总期数: '',
    放款日期: '',
    首期还款日: '',
    月供金额: '',
    归属部门: '',
    备注: '',
  }])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '车贷导入模板')
  XLSX.writeFile(workbook, '车贷导入模板.xlsx')
  message.success('模板已下载')
}

function handleExport() {
  const rows = filteredRecords.value.map((record) => {
    const computed = getLoanComputed(record)
    return {
      合同编号: record.contractNo,
      车牌号: record.plateNo,
      挂车号: record.trailerNo || '',
      贷款机构: record.lender,
      贷款金额: record.loanAmount,
      本金金额: record.principalAmount,
      年利率: record.annualRate,
      总期数: record.totalPeriods,
      已还期数: computed.paidPeriods,
      剩余期数: computed.remainingPeriods,
      已还金额: computed.paidAmount,
      剩余本金: computed.remainingPrincipal,
      下期应还日: computed.nextDueDate,
      逾期天数: computed.overdueDays,
      还款状态: computed.status,
      放款日期: record.startDate,
      首期还款日: record.firstDueDate,
      月供金额: record.monthlyPayment,
      归属部门: record.owner || '',
      备注: record.remark || '',
    }
  })
  const conditionWorksheet = XLSX.utils.json_to_sheet([{
    关键字: queryModel.keyword || '',
    车号: queryModel.plateNo || '',
    贷款机构: queryModel.lender || '',
    还款状态: queryModel.status || '',
    下期开始日期: queryModel.dueRange?.[0]?.format('YYYY-MM-DD') || '',
    下期结束日期: queryModel.dueRange?.[1]?.format('YYYY-MM-DD') || '',
  }])
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, conditionWorksheet, '筛选条件')
  XLSX.utils.book_append_sheet(workbook, worksheet, '车贷费用')
  XLSX.writeFile(workbook, `车贷费用_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
  message.success('导出成功')
}

function handleImportClick() {
  fileInputRef.value?.click()
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = async () => {
    const snapshot = structuredClone(records.value)
    try {
      const workbook = XLSX.read(reader.result, { type: 'array', cellStyles: true })
      const nextId = Math.max(...records.value.map(item => item.id), 0) + 1
      const planRecords = parseVehicleLoanWorkbook(workbook, nextId)
      if (planRecords.length) {
        records.value.unshift(...planRecords)
        await nextTick()
        await flushTransportOperationData()
        input.value = ''
        const paidCount = planRecords.reduce((sum, record) => sum + record.payments.length, 0)
        message.success(`导入成功 ${planRecords.length} 份合同，识别已还 ${paidCount} 期`)
        return
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet)
      const imported = rows.map((row, index) => ({
        id: nextId + index,
        contractNo: String(row.合同编号 || `IMPORT-${dayjs().format('YYYYMMDD')}-${index + 1}`),
        plateNo: String(row.车牌号 || ''),
        trailerNo: String(row.挂车号 || ''),
        lender: String(row.贷款机构 || ''),
        loanAmount: Number(row.贷款金额 || 0),
        principalAmount: Number(row.本金金额 || row.贷款金额 || 0),
        annualRate: Number(row.年利率 || 0),
        totalPeriods: Number(row.总期数 || 1),
        startDate: normalizeExcelDate(row.放款日期),
        firstDueDate: normalizeExcelDate(row.首期还款日),
        monthlyPayment: Number(row.月供金额 || 0),
        owner: String(row.归属部门 || ''),
        remark: String(row.备注 || ''),
        payments: [],
      })).filter(item => item.plateNo && item.lender)
      records.value.unshift(...imported)
      await nextTick()
      await flushTransportOperationData()
      input.value = ''
      message.success(`导入成功 ${imported.length} 条`)
    }
    catch (error: any) {
      records.value = snapshot
      input.value = ''
      message.error(error?.message || '导入数据保存失败，已恢复导入前数据')
    }
  }
  reader.readAsArrayBuffer(file)
}

function normalizeExcelDate(value: any) {
  if (!value)
    return dayjs().format('YYYY-MM-DD')
  if (typeof value === 'number')
    return dayjs('1899-12-30').add(value, 'day').format('YYYY-MM-DD')
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
}

function formatAmount(value: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusColor(status: LoanStatus | '已还款') {
  const map: Record<LoanStatus | '已还款', string> = {
    未开始: 'default',
    还款中: 'blue',
    临近到期: 'orange',
    已逾期: 'red',
    已结清: 'green',
    已还款: 'green',
  }
  return map[status]
}
</script>

<template>
  <page-container>
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
        <a-button @click="handleImportClick">
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
          新增车贷
        </a-button>
      </a-space>
      <input ref="fileInputRef" class="hidden-input" type="file" accept=".xlsx,.xls" @change="handleImport">
    </template>

    <a-alert v-if="transportOperationError" class="loan-card" type="error" show-icon :message="transportOperationError" />

    <SummaryCards :cards="summaryCards" :loading="transportOperationLoading" />

    <a-card class="loan-card">
      <a-form :model="queryModel" class="loan-query" layout="inline">
        <a-form-item label="关键字">
          <a-input v-model:value="queryModel.keyword" allow-clear placeholder="合同/车号/备注" />
        </a-form-item>
        <a-form-item label="车号">
          <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车号" />
        </a-form-item>
        <a-form-item label="贷款机构">
          <a-select v-model:value="queryModel.lender" allow-clear class="filter-lender" placeholder="全部" :options="lenderOptions" />
        </a-form-item>
        <a-form-item label="还款状态">
          <a-select v-model:value="queryModel.status" allow-clear class="filter-status" placeholder="全部">
            <a-select-option v-for="item in statusOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="下期应还日">
          <a-range-picker v-model:value="queryModel.dueRange" />
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

    <a-card class="loan-card" title="车贷费用列表">
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
              <span class="vehicle-main">{{ displayVehicleValue(asLoanRecord(record).plateNo) }}</span>
              <span class="vehicle-sub">{{ displayVehicleValue(asLoanRecord(record).trailerNo) }}</span>
            </div>
          </template>
          <template v-else-if="['loanAmount', 'monthlyPayment'].includes(String(column.dataIndex))">
            {{ formatAmount(getLoanAmountCell(record, column.dataIndex)) }}
          </template>
          <template v-else-if="column.dataIndex === 'remainingPeriods'">
            {{ getLoanComputedCell(record).remainingPeriods }}
          </template>
          <template v-else-if="column.dataIndex === 'remainingPrincipal'">
            <span class="amount-text">{{ formatAmount(getLoanComputedCell(record).remainingPrincipal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'nextDueDate'">
            {{ getLoanComputedCell(record).nextDueDate || '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'overdueDays'">
            <span :class="{ 'danger-text': getLoanComputedCell(record).overdueDays > 0 }">
              {{ getLoanComputedCell(record).overdueDays }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(getLoanComputedCell(record).status)">
              {{ getLoanComputedCell(record).status }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'approvalStatus'">
            <a-tag :color="approvalStatusColor(asLoanRecord(record).approvalStatus)">
              {{ asLoanRecord(record).approvalStatus || '-' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <a-space size="small">
              <a-button size="small" type="link" @click="handleView(asLoanRecord(record))">
                查看
              </a-button>
              <a-button size="small" type="link" @click="handlePayment(asLoanRecord(record))">
                还款登记
              </a-button>
              <a-button size="small" type="link" @click="handlePlan(asLoanRecord(record))">
                还款计划
              </a-button>
              <a-button
                v-if="false"
                size="small"
                type="link"
                @click="handleSubmitApproval(asLoanRecord(record))"
              >
                提交审批
              </a-button>
              <a-button size="small" type="link" @click="handleEdit(asLoanRecord(record))">
                编辑
              </a-button>
              <a-popconfirm
                title="确定删除该车贷记录？"
                ok-type="danger"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handleDelete(asLoanRecord(record))"
              >
                <a-button danger size="small" type="link">
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
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

    <a-modal
      v-model:open="modalOpen"
      :title="isUpdate ? '编辑车贷' : '新增车贷'"
      :confirm-loading="submitting"
      width="860px"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="8">
            <a-form-item name="contractNo" label="合同编号">
              <a-input v-model:value="formData.contractNo" placeholder="请输入合同编号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="plateNo" label="车牌号">
              <a-input v-model:value="formData.plateNo" placeholder="请输入车牌号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="挂车号">
              <a-input v-model:value="formData.trailerNo" placeholder="请输入挂车号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="lender" label="贷款机构">
              <a-select v-model:value="formData.lender" show-search :options="lenderOptions" placeholder="请选择贷款机构" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="loanAmount" label="贷款金额">
              <a-input-number v-model:value="formData.loanAmount" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="principalAmount" label="本金金额">
              <a-input-number v-model:value="formData.principalAmount" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="年利率(%)">
              <a-input-number v-model:value="formData.annualRate" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="totalPeriods" label="总期数">
              <a-input-number v-model:value="formData.totalPeriods" class="w-full" :min="1" :precision="0" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="monthlyPayment" label="月供金额">
              <a-input-number v-model:value="formData.monthlyPayment" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="放款日期">
              <a-date-picker v-model:value="formData.startDate" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="firstDueDate" label="首期还款日">
              <a-date-picker v-model:value="formData.firstDueDate" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="归属部门">
              <a-input v-model:value="formData.owner" placeholder="请输入归属部门" />
            </a-form-item>
          </a-col>
          <a-col :xs="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="formData.remark" :rows="2" placeholder="请输入备注" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="paymentOpen" title="还款登记" width="720px" :mask-closable="false" ok-text="保存" cancel-text="取消" @ok="handlePaymentSubmit">
      <a-form ref="paymentFormRef" :model="paymentForm" :rules="paymentRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item name="periodNo" label="还款期数">
              <a-select v-model:value="paymentForm.periodNo" :options="unpaidPeriodOptions" placeholder="请选择期数" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item name="paymentDate" label="还款日期">
              <a-date-picker v-model:value="paymentForm.paymentDate" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="amount" label="还款金额">
              <a-input-number v-model:value="paymentForm.amount" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item name="principal" label="偿还本金">
              <a-input-number v-model:value="paymentForm.principal" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="偿还利息">
              <a-input-number v-model:value="paymentForm.interest" class="w-full" :min="0" :precision="2" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="付款方式">
              <a-select v-model:value="paymentForm.method">
                <a-select-option v-for="item in paymentMethods" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="凭证号">
              <a-input v-model:value="paymentForm.voucherNo" placeholder="请输入凭证号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="paymentForm.remark" :rows="2" placeholder="请输入备注" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="planOpen" title="还款计划" :footer="null" width="1050px">
      <a-table
        row-key="periodNo"
        size="small"
        :columns="planTableColumns"
        :data-source="planRows"
        :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }"
        :scroll="{ x: planTableScrollX }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="['scheduledAmount', 'scheduledPrincipal', 'scheduledInterest', 'paidAmount', 'remainingPrincipal'].includes(String(column.dataIndex))">
            {{ formatAmount(getPlanAmountCell(record, column.dataIndex)) }}
          </template>
          <template v-else-if="column.dataIndex === 'overdueDays'">
            <span :class="{ 'danger-text': record.overdueDays > 0 }">{{ record.overdueDays }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">
              {{ record.status }}
            </a-tag>
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
    </a-modal>

    <a-modal v-model:open="detailOpen" title="车贷详情" :footer="null" width="820px">
      <a-descriptions v-if="detailRecord" bordered :column="2" size="small">
        <a-descriptions-item label="合同编号">
          {{ detailRecord.contractNo }}
        </a-descriptions-item>
        <a-descriptions-item label="还款状态">
          <a-tag :color="statusColor(getLoanComputed(detailRecord).status)">
            {{ getLoanComputed(detailRecord).status }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="车牌号">
          {{ detailRecord.plateNo }}
        </a-descriptions-item>
        <a-descriptions-item label="挂车号">
          {{ detailRecord.trailerNo || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="贷款机构">
          {{ detailRecord.lender }}
        </a-descriptions-item>
        <a-descriptions-item label="贷款金额">
          {{ formatAmount(detailRecord.loanAmount) }}
        </a-descriptions-item>
        <a-descriptions-item label="剩余期数">
          {{ getLoanComputed(detailRecord).remainingPeriods }}
        </a-descriptions-item>
        <a-descriptions-item label="剩余本金">
          {{ formatAmount(getLoanComputed(detailRecord).remainingPrincipal) }}
        </a-descriptions-item>
        <a-descriptions-item label="下期应还日">
          {{ getLoanComputed(detailRecord).nextDueDate || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="逾期天数">
          {{ getLoanComputed(detailRecord).overdueDays }}
        </a-descriptions-item>
        <a-descriptions-item label="放款日期">
          {{ detailRecord.startDate }}
        </a-descriptions-item>
        <a-descriptions-item label="首期还款日">
          {{ detailRecord.firstDueDate }}
        </a-descriptions-item>
        <a-descriptions-item label="归属部门">
          {{ detailRecord.owner || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="备注">
          {{ detailRecord.remark || '-' }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </page-container>
</template>

<style lang="less" scoped>
.loan-card {
  margin-bottom: 16px;
}

.loan-query {
  display: flex;
  row-gap: 12px;

  :deep(.ant-form-item) {
    margin-inline-end: 14px;
    margin-bottom: 0;
  }
}

.filter-lender {
  width: 150px;
}

.filter-status {
  width: 120px;
}

.query-actions {
  margin-left: auto;
}

.amount-text {
  font-weight: 700;
}

.danger-text {
  color: #ff4d4f;
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

.hidden-input {
  display: none;
}

@media (max-width: 768px) {
  .loan-query {
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
}
</style>
