import { describe, expect, it } from 'vitest'
import { normalizeEtcRows } from './etc-parser'

describe('eTC import parser', () => {
  it('combines entry and exit stations into one normalized record', () => {
    expect(normalizeEtcRows([{
      交易流水号: 'E001',
      通行时间: '2026-07-16 10:00',
      车牌号: '青A12345',
      入口收费站: '西宁南',
      出口收费站: '湟源',
      通行费: 42.5,
    }])[0]).toMatchObject({
      code: 'E001',
      name: '西宁南 至 湟源',
      entryInfo: '西宁南',
      exitInfo: '湟源',
      amount: '¥42.50',
    })
  })

  it('rejects invoice header fragments as route names', () => {
    expect(normalizeEtcRows([{ 日期: '2026-07-16', 路线: '价税合计 42.50', 金额: 42.5 }])).toEqual([])
  })
})
