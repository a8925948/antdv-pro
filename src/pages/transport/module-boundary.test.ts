import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('transport module state boundaries', () => {
  it('keeps form, query, pagination and modal state in a composable', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/module.vue'), 'utf8')
    expect(source).toContain('useTransportModuleState } from \'./composables/use-transport-module-state\'')
    expect(source).not.toContain('const queryModel = reactive({')
    expect(source).not.toContain('const orderModalOpen = ref(false)')
    expect(source).not.toContain('const baseDataModalOpen = ref(false)')
    expect(source).not.toContain('const tablePagination = reactive({')
    expect(source).not.toContain('const importPreview = reactive<')
    expect(source.split('\n').length).toBeLessThanOrEqual(5500)
  })

  it('separates the state by responsibility', () => {
    const source = fs.readFileSync(path.resolve('src/pages/transport/composables/use-transport-module-state.ts'), 'utf8')
    expect(source).toContain('useTransportOrderForm')
    expect(source).toContain('useTransportBaseDataState')
    expect(source).toContain('useTransportQueryState')
    expect(source).toContain('useTransportImportState')
    expect(source.split('\n').length).toBeLessThanOrEqual(30)
  })
})
