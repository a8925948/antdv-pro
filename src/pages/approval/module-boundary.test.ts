import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('oA module component boundaries', () => {
  it('uses dedicated route entries for each OA business category', () => {
    const routes = fs.readFileSync(path.resolve('src/router/dynamic-routes.ts'), 'utf8')
    expect(routes).toContain('~/pages/approval/oa/dashboard.vue')
    expect(routes).toContain('~/pages/approval/oa/receivable-payable.vue')
    expect(routes).toContain('~/pages/approval/oa/cash.vue')
    expect(routes).toContain('~/pages/approval/oa/salary.vue')
    expect(routes).toContain('~/pages/approval/oa/organization.vue')
    expect(routes).not.toContain('component: () => import(\'~/pages/approval/oa-module.vue\')')
  })

  it('keeps large business views in dedicated components', () => {
    const source = fs.readFileSync(path.resolve('src/pages/approval/oa-module.vue'), 'utf8')
    expect(source).toContain('import OrgManagementView from \'./components/org-management-view.vue\'')
    expect(source).toContain('import CashBalanceView from \'./components/cash-balance-view.vue\'')
    expect(source).toContain('import OaBusinessTable from \'./components/oa-business-table.vue\'')
    expect(source).toContain('import OaDashboardView from \'./components/oa-dashboard-view.vue\'')
    expect(source).toContain('import FinanceWorkflowView from \'./components/finance-workflow-view.vue\'')
    expect(source).not.toContain('<a-card title="组织树"')
    expect(source).not.toContain('<a-card title="现金余额管理"')
    expect(source).not.toContain('<template v-for="column in currentColumns"')
    expect(source).not.toContain('<a-card title="快速入口"')
    expect(source).not.toContain('<section class="finance-workflow"')
    expect(source.split('\n').length).toBeLessThanOrEqual(4400)
  })
})
