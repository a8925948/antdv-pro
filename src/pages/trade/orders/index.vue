<script setup lang="ts">
import type { Dayjs } from 'dayjs'
import { AppstoreOutlined, CarOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined, EditOutlined, InboxOutlined, PlusOutlined, SearchOutlined, SlidersOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { financialPeriodKeyFromDate } from '../../../../shared/business-overview'

interface TradeOrderRecord {
  code: string
  year: string
  month: string
  carrier: string
  plateNo: string
  vehicleNature: string
  plannedUnit: string
  loadingFactory: string
  loadingDate: string
  loadingTon: number
  unloadingTime: string
  receiver: string
  unloadingStation: string
  unloadingTon: number
  settlementTon: number
  liquidPrice: number
  payableTotal: number
  poundDiff: number
  freightSettlementTon: number
  distance: number
  tonKilometer: number
  freightTotal: number
  receivableLiquidPrice: number
  receivableLiquidTotal: number
  cargoLoss: number
  profit: number
  status: string
}

interface TradeOrderForm {
  code: string
  year: string
  month: string
  carrier: string
  plateNo: string
  vehicleNature: string
  plannedUnit: string
  loadingFactory: string
  loadingDate?: Dayjs
  loadingTon: number
  unloadingTime?: Dayjs
  receiver: string
  unloadingStation: string
  unloadingTon: number
  settlementTon: number
  liquidPrice: number
  payableTotal: number
  poundDiff: number
  freightSettlementTon: number
  distance: number
  tonKilometer: number
  freightTotal: number
  receivableLiquidPrice: number
  receivableLiquidTotal: number
  cargoLoss: number
  profit: number
  status: string
}

const message = useMessage()
const route = useRoute()
const linkedFinancialYear = String(route.query.financialYear || '')
const linkedFinancialMonth = Number(route.query.financialMonth || 0)

const queryModel = reactive({
  keyword: '',
  year: /^\d{4}$/.test(linkedFinancialYear) ? linkedFinancialYear : '全部年份',
  month: linkedFinancialMonth >= 1 && linkedFinancialMonth <= 12 ? `${linkedFinancialMonth}月` : '全部月份',
  status: '全部状态',
  plateNo: '全部车辆',
})
const modalOpen = ref(false)
const submitting = ref(false)
const editingCode = ref('')
const loading = ref(false)

const tradeRows = ref<TradeOrderRecord[]>([])

const formData = reactive<TradeOrderForm>(createEmptyForm())
const carrierOptions = ['诚捷', '诚域', '诺锐', '外协车队'].map(value => ({ label: value, value }))
const plannedUnitOptions = ['诚域', '诚捷', '诺锐'].map(value => ({ label: value, value }))
const vehicleNatureOptions = ['自有', '外协'].map(value => ({ label: value, value }))
const statusOptions = ['待确认', '已确认', '已结算'].map(value => ({ label: value, value }))
const loadingFactoryOptions = ['阎中/巨安', '昆仑五厂', '昆仑格', '陕西延长/亿利通'].map(value => ({ label: value, value }))

const columns = [
  { title: '年份', dataIndex: 'year', width: 70, fixed: 'left' as const },
  { title: '月份', dataIndex: 'month', width: 70 },
  { title: '承运商', dataIndex: 'carrier', width: 90 },
  { title: '车号', dataIndex: 'plateNo', width: 110 },
  { title: '车辆性质', dataIndex: 'vehicleNature', width: 100 },
  { title: '计划单位', dataIndex: 'plannedUnit', width: 100 },
  { title: '装车液厂', dataIndex: 'loadingFactory', width: 150 },
  { title: '装车日期', dataIndex: 'loadingDate', width: 120 },
  { title: '装车吨位', dataIndex: 'loadingTon', width: 105 },
  { title: '卸车吨位', dataIndex: 'unloadingTon', width: 105 },
  { title: '结算吨位', dataIndex: 'settlementTon', width: 105 },
  { title: '液款单价', dataIndex: 'liquidPrice', width: 105 },
  { title: '应付总价', dataIndex: 'payableTotal', width: 120 },
  { title: '运费总价', dataIndex: 'freightTotal', width: 120 },
  { title: '应收液款总价', dataIndex: 'receivableLiquidTotal', width: 135 },
  { title: '利润', dataIndex: 'profit', width: 110 },
  { title: '操作', dataIndex: 'action', width: 90, fixed: 'right' as const },
]
const tableColumns = computed(() => enhanceBusinessTableColumns(columns))
const tableScrollX = computed(() => createBusinessTableScrollX(tableColumns.value, 1680))

const filteredRows = computed(() => tradeRows.value.filter((row) => {
  if (queryModel.keyword && !Object.values(row).some(value => String(value).includes(queryModel.keyword)))
    return false
  const periodKey = financialPeriodKeyFromDate(row.loadingDate)
  if (queryModel.year !== '全部年份' && periodKey.slice(0, 4) !== queryModel.year)
    return false
  if (queryModel.month !== '全部月份' && Number(periodKey.slice(4, 6)) !== Number.parseInt(queryModel.month))
    return false
  if (queryModel.status !== '全部状态' && row.status !== queryModel.status)
    return false
  if (queryModel.plateNo !== '全部车辆' && row.plateNo !== queryModel.plateNo)
    return false
  return true
}))

const vehicleOptions = computed(() => ['全部车辆', ...new Set(tradeRows.value.map(row => row.plateNo))])
const vehicleSelectOptions = computed(() => [...new Set(tradeRows.value.map(row => row.plateNo))].map(value => ({ label: value, value })))
const yearOptions = computed(() => [
  '全部年份',
  ...[...new Set(tradeRows.value.map(row => financialPeriodKeyFromDate(row.loadingDate).slice(0, 4)).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a)),
])
const monthOptions = computed(() => {
  const rows = queryModel.year === '全部年份'
    ? tradeRows.value
    : tradeRows.value.filter(row => financialPeriodKeyFromDate(row.loadingDate).slice(0, 4) === queryModel.year)
  return [
    '全部月份',
    ...[...new Set(rows.map(row => Number(financialPeriodKeyFromDate(row.loadingDate).slice(4, 6))).filter(Boolean))]
      .sort((a, b) => b - a)
      .map(month => `${month}月`),
  ]
})
watch(() => queryModel.year, () => {
  if (!monthOptions.value.includes(queryModel.month))
    queryModel.month = '全部月份'
})
const statusFilterOptions = computed(() => ['全部状态', ...new Set(tradeRows.value.map(row => row.status).filter(Boolean))])
const summary = computed(() => {
  const rows = filteredRows.value
  const loadingTon = sum(rows, 'loadingTon')
  const unloadingTon = sum(rows, 'unloadingTon')
  const payableTotal = sum(rows, 'payableTotal')
  const receivableTotal = sum(rows, 'receivableLiquidTotal')
  const profit = sum(rows, 'profit')
  return { count: rows.length, loadingTon, unloadingTon, payableTotal, receivableTotal, profit }
})

function createEmptyForm(): TradeOrderForm {
  return {
    code: `MY${dayjs().format('YYYYMMDDHHmmss')}`,
    year: dayjs().format('YYYY'),
    month: `${dayjs().month() + 1}月`,
    carrier: '',
    plateNo: '',
    vehicleNature: '自有',
    plannedUnit: '',
    loadingFactory: '',
    loadingDate: undefined,
    loadingTon: 0,
    unloadingTime: undefined,
    receiver: '',
    unloadingStation: '',
    unloadingTon: 0,
    settlementTon: 0,
    liquidPrice: 0,
    payableTotal: 0,
    poundDiff: 0,
    freightSettlementTon: 0,
    distance: 0,
    tonKilometer: 0,
    freightTotal: 0,
    receivableLiquidPrice: 0,
    receivableLiquidTotal: 0,
    cargoLoss: 0,
    profit: 0,
    status: '待确认',
  }
}

function createRow(partial: Partial<TradeOrderRecord>) {
  const row = { ...createEmptyForm(), ...partial }
  row.profit = round(row.receivableLiquidTotal - row.payableTotal - row.freightTotal - row.cargoLoss)
  return normalizeRow(row as TradeOrderForm | TradeOrderRecord)
}

function sum(rows: TradeOrderRecord[], key: keyof TradeOrderRecord) {
  return round(rows.reduce((total, row) => total + Number(row[key] || 0), 0))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function wan(value: number) {
  return `¥${(value / 10000).toFixed(2)}万`
}

function formatNumber(value: number, digits = 2) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function columnKey(dataIndex: unknown) {
  return Array.isArray(dataIndex) ? String(dataIndex[0] ?? '') : String(dataIndex ?? '')
}

function getNumberCell(record: Record<string, any>, dataIndex: unknown) {
  return Number(record[columnKey(dataIndex)] || 0)
}

function recalculate() {
  formData.payableTotal = round(formData.settlementTon * formData.liquidPrice)
  formData.freightTotal = round(formData.freightSettlementTon * formData.distance * formData.tonKilometer)
  formData.receivableLiquidTotal = round(formData.unloadingTon * formData.receivableLiquidPrice)
  formData.profit = round(formData.receivableLiquidTotal - formData.payableTotal - formData.freightTotal - formData.cargoLoss)
  formData.poundDiff = round(formData.loadingTon - formData.unloadingTon)
}

function openCreateModal() {
  editingCode.value = ''
  Object.assign(formData, createEmptyForm())
  modalOpen.value = true
}

function openEditModal(record: TradeOrderRecord) {
  editingCode.value = record.code
  Object.assign(formData, {
    ...record,
    loadingDate: record.loadingDate ? dayjs(record.loadingDate) : undefined,
    unloadingTime: record.unloadingTime ? dayjs(record.unloadingTime) : undefined,
  })
  modalOpen.value = true
}

async function loadTradeOrders() {
  loading.value = true
  try {
    const result = await useGet<TradeOrderRecord[]>('/trade/orders')
    if (result.code !== 200)
      throw new Error(result.msg || '贸易订单加载失败')
    tradeRows.value = (result.data || []).map(row => createRow(row))
  }
  catch (error: any) {
    tradeRows.value = []
    message.error(error?.message || '贸易订单加载失败')
  }
  finally {
    loading.value = false
  }
}

async function saveTradeChanges(upsert: TradeOrderRecord[] = [], deleteCodes: string[] = []) {
  const result = await usePut<TradeOrderRecord[]>('/trade/orders', { upsert, deleteCodes })
  if (result.code !== 200)
    throw new Error(result.msg || '贸易订单保存失败')
  tradeRows.value = (result.data || []).map(row => createRow(row))
}

async function submitTradeOrder() {
  if (!formData.plateNo || !formData.carrier || !formData.loadingDate || !formData.loadingTon || !formData.unloadingTon || !formData.settlementTon || !formData.liquidPrice) {
    message.warning('请填写必填项')
    return
  }
  submitting.value = true
  try {
    const payload = normalizeRow(formData)
    const index = tradeRows.value.findIndex(row => row.code === editingCode.value)
    const nextRows = [...tradeRows.value]
    if (index >= 0) {
      nextRows[index] = payload
    }
    else {
      nextRows.unshift(payload)
    }
    tradeRows.value = nextRows
    await saveTradeChanges([payload])
    message.success(index >= 0 ? '修改贸易订单成功' : '新增贸易订单成功')
    modalOpen.value = false
  }
  catch (error: any) {
    message.error(error?.message || '保存失败')
  }
  finally {
    submitting.value = false
  }
}

function normalizeRow(row: TradeOrderForm | TradeOrderRecord): TradeOrderRecord {
  const loadingDate = row.loadingDate ? dayjs(row.loadingDate) : null
  const unloadingTime = row.unloadingTime ? dayjs(row.unloadingTime) : null
  const normalized = {
    ...row,
    loadingDate: loadingDate?.isValid() ? loadingDate.format('YYYY/M/D') : '',
    unloadingTime: unloadingTime?.isValid() ? unloadingTime.format('YYYY/M/D HH:mm') : '',
    year: loadingDate?.isValid() ? loadingDate.format('YYYY') : row.year || dayjs().format('YYYY'),
    month: loadingDate?.isValid() ? `${loadingDate.month() + 1}月` : row.month || `${dayjs().month() + 1}月`,
  } as TradeOrderRecord

  if (normalized.settlementTon && normalized.liquidPrice)
    normalized.payableTotal = round(normalized.settlementTon * normalized.liquidPrice)
  if (normalized.freightSettlementTon && normalized.distance && normalized.tonKilometer)
    normalized.freightTotal = round(normalized.freightSettlementTon * normalized.distance * normalized.tonKilometer)
  if (normalized.unloadingTon && normalized.receivableLiquidPrice)
    normalized.receivableLiquidTotal = round(normalized.unloadingTon * normalized.receivableLiquidPrice)
  normalized.poundDiff = round(normalized.loadingTon - normalized.unloadingTon)
  normalized.profit = round(normalized.receivableLiquidTotal - normalized.payableTotal - normalized.freightTotal - normalized.cargoLoss)
  return normalized
}

function exportRows() {
  const worksheet = XLSX.utils.json_to_sheet(filteredRows.value.map(row => ({
    年份: row.year,
    月份: row.month,
    承运商: row.carrier,
    车号: row.plateNo,
    车辆性质: row.vehicleNature,
    计划单位: row.plannedUnit,
    装车液厂: row.loadingFactory,
    装车日期: row.loadingDate,
    装车吨位: row.loadingTon,
    卸车吨位: row.unloadingTon,
    结算吨位: row.settlementTon,
    液款单价: row.liquidPrice,
    应付总价: row.payableTotal,
    运费总价: row.freightTotal,
    应收液款总价: row.receivableLiquidTotal,
    利润: row.profit,
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '贸易订单')
  XLSX.writeFile(workbook, `贸易订单_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
}

async function removeRow(record: TradeOrderRecord) {
  const previous = tradeRows.value
  tradeRows.value = tradeRows.value.filter(row => row.code !== record.code)
  try {
    await saveTradeChanges([], [record.code])
    message.success('删除成功')
  }
  catch (error: any) {
    tradeRows.value = previous
    message.error(error?.message || '删除失败')
  }
}

function removeTableRow(record: Record<string, any>) {
  removeRow(record as TradeOrderRecord)
}

function resetFilters() {
  queryModel.keyword = ''
  queryModel.year = '全部年份'
  queryModel.month = '全部月份'
  queryModel.status = '全部状态'
  queryModel.plateNo = '全部车辆'
}

onMounted(loadTradeOrders)
</script>

<template>
  <page-container>
    <div class="trade-page">
      <div class="trade-header">
        <div class="trade-title">
          <span class="trade-title-icon">◇</span>
          <span>贸易管理</span>
        </div>
        <a-button type="primary" size="large" @click="openCreateModal">
          <template #icon>
            <PlusOutlined />
          </template>
          新增记录
        </a-button>
      </div>

      <a-row :gutter="[12, 12]" class="summary-row">
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card blue">
            <div>记录数</div><strong>{{ summary.count }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card slate">
            <div>装车吨位</div><strong>{{ formatNumber(summary.loadingTon) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card slate">
            <div>卸车吨位</div><strong>{{ formatNumber(summary.unloadingTon) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card orange">
            <div>应付总价</div><strong>{{ wan(summary.payableTotal) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card green">
            <div>应收总价</div><strong>{{ wan(summary.receivableTotal) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card emerald">
            <div>总利润</div><strong>{{ wan(summary.profit) }}</strong>
          </div>
        </a-col>
      </a-row>

      <a-card class="filter-card" :bordered="false">
        <a-space wrap class="filter-space">
          <a-input v-model:value="queryModel.keyword" class="search-input" allow-clear placeholder="搜索公司/车号/单位...">
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
          <a-select v-model:value="queryModel.year" class="filter-select">
            <a-select-option v-for="item in yearOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="queryModel.month" class="filter-select">
            <a-select-option v-for="item in monthOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="queryModel.status" class="filter-select">
            <a-select-option v-for="item in statusFilterOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="queryModel.plateNo" class="filter-select">
            <a-select-option v-for="item in vehicleOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-button @click="resetFilters">
            清除筛选
          </a-button>
        </a-space>
        <a-space>
          <a-button @click="exportRows">
            <template #icon>
              <DownloadOutlined />
            </template>
            导出
          </a-button>
          <a-button>
            <template #icon>
              <SlidersOutlined />
            </template>
          </a-button>
        </a-space>
      </a-card>

      <a-table
        class="trade-table"
        row-key="code"
        :columns="tableColumns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: tableScrollX }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'vehicleNature'">
            <a-tag color="blue">
              {{ record.vehicleNature }}
            </a-tag>
          </template>
          <template v-else-if="['loadingTon', 'unloadingTon', 'settlementTon'].includes(String(column.dataIndex))">
            <span :class="{ 'brown-text': columnKey(column.dataIndex) === 'settlementTon' }">{{ formatNumber(getNumberCell(record, column.dataIndex)) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'payableTotal'">
            <span class="orange-text">{{ formatMoney(record.payableTotal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'freightTotal'">
            <span class="blue-text">{{ formatMoney(record.freightTotal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'receivableLiquidTotal'">
            <span class="green-text">{{ formatMoney(record.receivableLiquidTotal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'profit'">
            <span class="profit-text">{{ formatMoney(record.profit) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <a-space>
              <a-button type="text" @click="openEditModal(record as TradeOrderRecord)">
                <span class="sr-only">编辑贸易订单</span>
                <EditOutlined />
              </a-button>
              <a-button type="text" danger @click="removeTableRow(record)">
                <span class="sr-only">删除贸易订单</span>
                <DeleteOutlined />
              </a-button>
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
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="editingCode ? '编辑贸易订单' : '新增贸易订单'"
      :confirm-loading="submitting"
      width="calc(100vw - 96px)"
      :style="{ top: '16px', maxWidth: '1480px' }"
      :body-style="{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', padding: '24px 28px' }"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitTradeOrder"
    >
      <a-form :model="formData" layout="vertical" class="trade-form">
        <section class="form-section section-blue">
          <div class="section-title">
            <AppstoreOutlined />
            <span>基础信息</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="车辆性质">
                <a-select v-model:value="formData.vehicleNature" :options="vehicleNatureOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="运输车号" required>
                <a-select v-model:value="formData.plateNo" show-search allow-clear placeholder="请选择车号" :options="vehicleSelectOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="承运商" required>
                <a-select v-model:value="formData.carrier" show-search allow-clear placeholder="请输入运输公司" :options="carrierOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="计划单位">
                <a-select v-model:value="formData.plannedUnit" allow-clear placeholder="请输入计划单位" :options="plannedUnitOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section section-green">
          <div class="section-title">
            <CarOutlined />
            <span>装车信息</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="装车液厂">
                <a-select v-model:value="formData.loadingFactory" allow-clear placeholder="请输入装车液厂" :options="loadingFactoryOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="装车日期" required>
                <a-date-picker v-model:value="formData.loadingDate" class="w-full" format="YYYY/M/D" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="装车吨位" required>
                <a-input-number v-model:value="formData.loadingTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="状态">
                <a-select v-model:value="formData.status" :options="statusOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section section-yellow">
          <div class="section-title">
            <InboxOutlined />
            <span>卸车信息</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="卸车时间">
                <a-date-picker v-model:value="formData.unloadingTime" class="w-full" show-time format="YYYY/M/D HH:mm" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="接收单位">
                <a-input v-model:value="formData.receiver" placeholder="请输入接收单位" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="卸车站点">
                <a-input v-model:value="formData.unloadingStation" placeholder="请输入卸车站点" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="卸车吨位" required>
                <a-input-number v-model:value="formData.unloadingTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section section-purple">
          <div class="section-title">
            <DollarOutlined />
            <span>费用信息</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="结算吨位" required>
                <a-input-number v-model:value="formData.settlementTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="液款单价" required>
                <a-input-number v-model:value="formData.liquidPrice" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="应付总价" required>
                <a-input-number v-model:value="formData.payableTotal" class="w-full amount-payable" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="磅差">
                <a-input-number v-model:value="formData.poundDiff" class="w-full" :precision="2" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-divider orientation="left">
            运费计算
          </a-divider>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="运费结算吨位">
                <a-input-number v-model:value="formData.freightSettlementTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="运距">
                <a-input-number v-model:value="formData.distance" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="吨/公里">
                <a-input-number v-model:value="formData.tonKilometer" class="w-full" :min="0" :precision="4" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="运费总价">
                <a-input-number v-model:value="formData.freightTotal" class="w-full amount-freight" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-divider orientation="left">
            应收账款
          </a-divider>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="应收液款单价">
                <a-input-number v-model:value="formData.receivableLiquidPrice" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="应收液款总价">
                <a-input-number v-model:value="formData.receivableLiquidTotal" class="w-full amount-receivable" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="货损">
                <a-input-number v-model:value="formData.cargoLoss" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="利润">
                <a-input-number v-model:value="formData.profit" class="w-full amount-profit" :precision="2" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>
      </a-form>
    </a-modal>
  </page-container>
</template>

<style lang="less" scoped>
.trade-page {
  padding: 8px 0 24px;
}

.trade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.trade-title {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #172033;
  font-size: 24px;
  font-weight: 700;
}

.trade-title-icon {
  color: #0b63ce;
  font-size: 24px;
}

.summary-row {
  margin-bottom: 16px;
}

.metric-card {
  min-height: 80px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #d9e2ef;
  border-left: 4px solid #2f6bff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgb(15 23 42 / 5%);

  div {
    color: #718096;
    font-size: 14px;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: #1f2937;
    font-size: 24px;
    line-height: 1.2;
  }
}

.metric-card.orange {
  border-left-color: #f97316;

  strong {
    color: #c55310;
  }
}

.metric-card.green,
.metric-card.emerald {
  border-left-color: #10b981;

  strong {
    color: #059669;
  }
}

.metric-card.slate {
  border-left-color: #94a3b8;
}

.filter-card {
  margin-bottom: 16px;

  :deep(.ant-card-body) {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
  }
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 130px;
}

.trade-table {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.orange-text {
  color: #d65a1f;
  font-weight: 700;
}

.blue-text {
  color: #3478f6;
  font-weight: 700;
}

.green-text,
.profit-text {
  color: #059669;
  font-weight: 700;
}

.brown-text {
  color: #b85f2c;
  font-weight: 600;
}

.trade-form {
  :deep(.ant-form-item-label > label) {
    color: #1f2937;
    font-size: 15px;
    font-weight: 600;
  }
}

.form-section {
  margin-bottom: 24px;
  padding: 22px 28px;
  background: #fff;
  border: 1px solid #d6e0ee;
  border-left: 5px solid #2f6bff;
  border-radius: 10px;
}

.section-title {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
  color: #1f5eff;
  font-size: 18px;
  font-weight: 700;
}

.section-green {
  border-left-color: #00b876;

  .section-title {
    color: #009966;
  }
}

.section-yellow {
  border-left-color: #f2c400;

  .section-title {
    color: #c79a00;
  }
}

.section-purple {
  border-left-color: #8b5cf6;

  .section-title {
    color: #7c3aed;
  }
}

.amount-payable {
  :deep(.ant-input-number-input) {
    color: #c55310;
    background: #fff6ea;
  }
}

.amount-freight {
  :deep(.ant-input-number-input) {
    color: #2563eb;
    background: #eef4ff;
  }
}

.amount-receivable {
  :deep(.ant-input-number-input) {
    color: #15803d;
    background: #ecfdf3;
  }
}

.amount-profit {
  :deep(.ant-input-number-input) {
    color: #047857;
    background: #ecfdf5;
    font-weight: 700;
  }
}
</style>
