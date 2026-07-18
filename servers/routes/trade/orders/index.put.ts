import { defineEventHandler, readBody } from 'h3'
import { asBadRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { tradeOrderStore } from '../../../utils/trade-order-store'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event)
    const data = body && ('upsert' in body || 'deleteCodes' in body)
      ? await tradeOrderStore.applyChanges(body)
      : await tradeOrderStore.replace(body?.rows ?? body)
    return ok(data, '保存成功')
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '贸易订单保存失败')
  }
})
