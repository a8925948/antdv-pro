import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { systemStore } from '../../utils/system-store'

function token(event: H3Event) {
  return getRequestHeader(event, 'Authorization')
}

export const systemUserService = {
  list: (query: Record<string, unknown>) => systemStore.listUsers(query),
  save: (event: H3Event, payload: Record<string, unknown>) => systemStore.saveUser(payload, token(event)),
  remove: (event: H3Event, id: number) => systemStore.deleteUser(id, token(event)),
  setStatus: (event: H3Event, id: number, status: 'enabled' | 'disabled') => systemStore.disableUser(id, status, token(event)),
  resetPassword: (event: H3Event, id: number, password: string) => systemStore.resetPassword(id, password, token(event)),
}
