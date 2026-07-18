import { describe, expect, it, vi } from 'vitest'
import { resolveUserOrganizations } from './user-organization-service'

describe('user organization application service', () => {
  it('reuses existing company, department and post', async () => {
    const state: any = { organizations: [
      { id: 'C1', type: 'company', name: '公司' },
      { id: 'D1', parentId: 'C1', type: 'department', name: '运输部' },
      { id: 'P1', parentId: 'D1', type: 'post', name: '司机' },
    ] }
    const saveOrganization = vi.fn()
    const recordOperation = vi.fn()
    const result = await resolveUserOrganizations(state, { companyId: 'C1', deptName: '运输部', postName: '司机' }, {
      nextId: type => type,
      saveOrganization,
      recordOperation,
    })
    expect(result).toMatchObject({ company: { id: 'C1' }, dept: { id: 'D1' }, post: { id: 'P1' } })
    expect(saveOrganization).not.toHaveBeenCalled()
    expect(recordOperation).not.toHaveBeenCalled()
  })

  it('creates department before post and applies database ids', async () => {
    const state: any = { organizations: [{ id: 'C1', type: 'company', name: '公司' }] }
    const saveOrganization = vi.fn()
      .mockResolvedValueOnce('101')
      .mockResolvedValueOnce('202')
    const recordOperation = vi.fn()
    const result = await resolveUserOrganizations(state, { deptName: '调度部', postName: '调度员' }, {
      nextId: type => `local-${type}`,
      saveOrganization,
      recordOperation,
    })
    expect(result.dept).toMatchObject({ id: '101', parentId: 'C1', code: 'DEPT001' })
    expect(result.post).toMatchObject({ id: '202', parentId: '101', code: 'POST001' })
    expect(saveOrganization.mock.calls.map(call => call[0].type)).toEqual(['department', 'post'])
    expect(recordOperation.mock.calls.map(call => call[0].content)).toEqual(['新增部门 调度部', '新增岗位 调度员'])
  })
})
