import { defineEventHandler, getQuery } from 'h3'
import { tradeOrderStore } from '../../../utils/trade-order-store'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const paginated = query.current !== undefined || query.pageSize !== undefined
  return {
    code: 200,
    msg: '获取成功',
    data: paginated ? await tradeOrderStore.listPage(query.current, query.pageSize) : await tradeOrderStore.list(),
  }
})
