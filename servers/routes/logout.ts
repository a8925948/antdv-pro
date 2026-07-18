import { defineEventHandler, getRequestHeader, getRequestIP } from 'h3'
import { systemStore } from '../utils/system-store'

export default defineEventHandler((event) => {
  systemStore.logout(getRequestHeader(event, 'Authorization'), {
    ip: getRequestIP(event) || '127.0.0.1',
    userAgent: getRequestHeader(event, 'user-agent'),
  })
  return {
    code: 200,
    msg: 'success',
  }
})
