import dayjs from 'dayjs'
import { defineEventHandler, readBody } from 'h3'
import { calculateTransportFreightExcludingTax } from '../../../../shared/transport-freight'

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function normalizeMonthKey(value?: string) {
  if (!value)
    return ''

  const matched = value.match(/(\d{4})[-/年.]?(\d{1,2})/)
  if (!matched)
    return ''

  return `${matched[1]}${matched[2].padStart(2, '0')}`
}

function getRowBusinessDate(row: Record<string, any>) {
  const dateValue = row.shipDate || row.date || row.repairDate || row.updatedAt
  if (dateValue)
    return dayjs(dateValue)

  const monthKey = normalizeMonthKey(row.financeMonth || row.month)
  if (monthKey)
    return dayjs(`${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}-01`)

  return undefined
}

function matches(row: Record<string, any>, filters: Record<string, any>) {
  const keyword = String(filters.keyword ?? '').trim()
  const status = String(filters.status ?? '').trim()
  if (keyword && !Object.values(row).some(value => String(value ?? '').includes(keyword)))
    return false
  if (status) {
    const statusMap: Record<string, string[]> = {
      pending: ['待审核', '待处理', '待派车', '待审批', '待完善', '待确认', '待复核', '待还款'],
      running: ['运输中', '处理中', '审批中', '生效中', '核算中', '推修中'],
      done: ['已完成', '已通过', '已发放', '已扣款', '正常'],
    }
    const allowed = statusMap[status] ?? [status]
    if (!allowed.some(item => String(row.status ?? '').includes(item)))
      return false
  }
  if (filters.startDate && filters.endDate) {
    const rowDate = getRowBusinessDate(row)
    if (rowDate?.isValid() && (rowDate.isBefore(dayjs(filters.startDate), 'day') || !rowDate.isBefore(dayjs(filters.endDate), 'day')))
      return false
  }
  return true
}

function comparisonHint(current: number, previous: number) {
  if (!previous)
    return current ? '较上月新增（上月无数据）' : '较上月持平'

  const change = (current - previous) / previous * 100
  if (Math.abs(change) < 0.05)
    return '较上月持平'
  return `较上月 ${change > 0 ? '上升' : '下降'} ${Math.abs(change).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%`
}

function orderMetrics(rows: Array<Record<string, any>>) {
  return {
    count: rows.length,
    freightTotal: rows.reduce((sum, row) => sum + toNumber(row.freightTotal), 0),
    taxedFreight: rows.reduce((sum, row) => {
      const savedAmount = toNumber(row.taxedFreight)
      return sum + (savedAmount || calculateTransportFreightExcludingTax(toNumber(row.freightTotal)))
    }, 0),
    pending: rows.filter(row => String(row.status ?? '').includes('待')).length,
  }
}

function previousFinancialMonthFilters(filters: Record<string, any>) {
  if (!filters.financialYear || !filters.financialMonth || filters.periodType !== 'financialMonth')
    return undefined

  const currentMonth = dayjs(`${filters.financialYear}-${String(filters.financialMonth).padStart(2, '0')}-01`)
  const previousMonth = currentMonth.subtract(1, 'month')
  const startDate = previousMonth.subtract(1, 'month').date(26).format('YYYY-MM-DD')
  const endDate = previousMonth.date(26).format('YYYY-MM-DD')
  return { ...filters, startDate, endDate }
}

function summarize(moduleName: string, rows: Array<Record<string, any>>, previousRows: Array<Record<string, any>> = []) {
  if (moduleName === 'TransportOrders') {
    const current = orderMetrics(rows)
    const previous = orderMetrics(previousRows)
    return [
      { label: '总订单数', value: current.count, hint: comparisonHint(current.count, previous.count), tone: 'primary' },
      { label: '运费总额', value: money(current.freightTotal), hint: comparisonHint(current.freightTotal, previous.freightTotal), tone: 'success' },
      { label: '税后运费总额', value: money(current.taxedFreight), hint: comparisonHint(current.taxedFreight, previous.taxedFreight), tone: 'success' },
      { label: '待审核订单数', value: current.pending, hint: comparisonHint(current.pending, previous.pending), tag: current.pending ? '需及时处理' : '状态正常', tone: current.pending ? 'warning' : 'success' },
    ]
  }

  if (moduleName === 'TransportFuel') {
    const amount = rows.reduce((sum, row) => sum + toNumber(row.amount), 0)
    const vehicles = new Set(rows.map(row => row.plateNo || row.name).filter(Boolean)).size
    return [
      { label: '加油记录数', value: rows.length, hint: '当前筛选范围内', tone: 'primary' },
      { label: '燃油支出', value: money(amount), hint: '加油金额合计', tone: 'danger' },
      { label: '涉及车辆', value: vehicles, hint: '去重车牌数', tone: 'default' },
      { label: '平均单笔', value: money(rows.length ? amount / rows.length : 0), hint: '按记录数计算', tone: 'success' },
    ]
  }

  const abnormal = rows.filter(row => /待|异常|预警|截止|离线/.test(String(row.status ?? ''))).length
  return [
    { label: '记录总数', value: rows.length, hint: '当前筛选范围内', tone: 'primary' },
    { label: '异常/待处理', value: abnormal, hint: `${rows.length - abnormal} 条正常`, tag: abnormal ? '需及时处理' : '状态正常', tone: abnormal ? 'warning' : 'success' },
    { label: '金额合计', value: money(rows.reduce((sum, row) => sum + toNumber(row.amount || row.freightTotal), 0)), hint: '可识别金额字段', tone: 'success' },
    { label: '业务类型', value: moduleName.replace(/^Transport/, ''), hint: '当前模块', tone: 'default' },
  ]
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const sourceRows = body.rows ?? []
  const filters = body.filters ?? {}
  const rows = sourceRows.filter((row: Record<string, any>) => matches(row, filters))
  const previousFilters = String(body.moduleName ?? '') === 'TransportOrders' ? previousFinancialMonthFilters(filters) : undefined
  const previousRows = previousFilters
    ? sourceRows.filter((row: Record<string, any>) => matches(row, previousFilters))
    : []
  return {
    code: 200,
    msg: '获取成功',
    data: summarize(String(body.moduleName ?? ''), rows, previousRows),
  }
})
