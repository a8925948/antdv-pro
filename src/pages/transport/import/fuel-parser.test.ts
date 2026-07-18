import { describe, expect, it } from 'vitest'
import { normalizeFuelRows, parseFuelDate } from './fuel-parser'

describe('fuel import parser', () => {
  it('normalizes provider column aliases', () => {
    expect(normalizeFuelRows([{
      交易流水号: 'F001',
      加油时间: '2026-07-16 09:30',
      车辆: '青A12345',
      加油地点: '西宁城东加油站',
      油品: '柴油',
      升数: '123.45',
      金额: '¥900.5',
      司机: '张三',
    }])[0]).toMatchObject({
      code: 'F001',
      month: '202607',
      plateNo: '青A12345',
      quantity: '123.45L',
      amount: '¥900.50',
    })
  })

  it('supports Excel serial dates without importing XLSX on the UI thread', () => {
    expect(parseFuelDate(46_000)).toBeInstanceOf(Date)
  })
})
