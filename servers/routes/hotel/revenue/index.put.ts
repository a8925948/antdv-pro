import { defineEventHandler, readBody } from 'h3'
import { hotelRevenueStore } from '../../../utils/hotel-revenue-store'
import { badRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    const date = String(body?.date || '')
    if (!date)
      badRequest('date 不能为空')
    const data = body && ('upsert' in body || 'deleteIds' in body)
      ? await hotelRevenueStore.applyChanges(date, body)
      : await hotelRevenueStore.replaceByDate(date, body?.rows ?? [])
    return ok(data, '保存成功')
  }
  catch (error: any) {
    return fail(event, error, '酒店营收保存失败')
  }
})
