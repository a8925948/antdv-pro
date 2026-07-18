import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  query: vi.fn(),
}))

const pool = { execute: mocks.execute, query: mocks.query }

vi.mock('node:fs', () => ({
  copyFileSync: vi.fn(),
  existsSync: () => false,
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))
vi.mock('./mysql', () => ({
  getMysqlPool: () => pool,
  isDatabaseRequired: () => true,
  withMysqlTransaction: async (_db: any, handler: any) => handler(pool),
}))

describe('system store MySQL persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sys_company')) {
        return [[{
          id: 1,
          parent_id: null,
          type: 'company',
          name: '测试公司',
          code: 'COMP001',
          leader_user_id: null,
          leader_name: null,
          sort_no: 0,
          status: 'enabled',
        }]]
      }
      return [[]]
    })
    mocks.execute.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO sys_user ('))
        return [{ insertId: 42 }]
      return [{}]
    })
  })

  it('inserts a newly created user instead of updating its temporary memory id', async () => {
    const { systemStore } = await import('./system-store')
    const user = await systemStore.saveUser({
      username: 'mysql-persistence-user',
      nickname: '持久化用户',
      mobile: '13900000000',
      roleIds: [],
      status: 'enabled',
    })

    expect(user.id).toBe(42)
    expect(mocks.execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sys_user ('))).toBe(true)
    expect(mocks.execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE sys_user'))).toBe(false)
  })
})
