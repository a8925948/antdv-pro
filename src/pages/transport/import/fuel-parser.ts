import type { FuelRecord } from '~@/composables/transport-operation-data'
import { financialMonthKey } from '~@/utils/financialPeriod'

function cell(row: Record<string, unknown>, keys: string[]) {
  const key = keys.find(item => row[item] !== undefined && row[item] !== null && row[item] !== '')
  return key ? row[key] : ''
}

function numberValue(value: unknown) {
  if (typeof value === 'number')
    return value
  return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0
}

export function parseFuelDate(value: unknown) {
  if (value instanceof Date)
    return value
  if (typeof value === 'number')
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000)
  const raw = String(value ?? '').trim()
  const compact = raw.match(/^(20\d{2})(\d{2})(\d{2})(?:\s+(\d{2})(\d{2}))?$/)
  if (compact) {
    const [, year, month, day, hour = '00', minute = '00'] = compact
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  }
  const date = new Date(raw.replace(/[年月]/g, '/').replace(/日/g, '').replace(/-/g, '/'))
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function formatFuelDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    month: financialMonthKey(date),
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export function formatFuelAmount(value: unknown) {
  return `¥${numberValue(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function normalizeFuelRows(rawRows: Array<Record<string, unknown>>): FuelRecord[] {
  return rawRows.map((row, index) => {
    const rawDate = cell(row, ['订单时间', '交易时间', '日期', '加油时间'])
    const parsedDate = parseFuelDate(rawDate)
    const formattedDate = parsedDate ? formatFuelDate(parsedDate) : { month: '', date: String(rawDate) }
    const amount = cell(row, ['实付金额（元）', '实付金额', '金额', '油品实收金额（元）'])
    const quantity = cell(row, ['油量（升）', '油量', '升数'])
    return {
      code: String(cell(row, ['订单号', '交易流水号', '流水号']) || `JYIMPORT${index + 1}`),
      month: formattedDate.month,
      date: formattedDate.date,
      plateNo: String(cell(row, ['车牌号', '车牌', '车辆'])),
      location: String(cell(row, ['油站名称', '地点', '加油地点', '站点'])),
      product: String(cell(row, ['油品品号', '商品品类', '油品'])),
      quantity: quantity === '' ? '' : `${numberValue(quantity).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}L`,
      amount: formatFuelAmount(amount),
      driver: String(cell(row, ['会员名称', '司机姓名', '司机'])),
    }
  }).filter(row => row.date && row.plateNo && row.location && row.amount !== '¥0.00')
}
