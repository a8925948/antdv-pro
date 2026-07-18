<script setup lang="ts">
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import RecordActions from '~@/components/record-actions/index.vue'

type Row = Record<string, any>
type BaseRow = Record<string, string>
type Column = Record<string, any>
interface Tab { key: string, title: string, columns: Column[], rows: Row[] }

const props = defineProps<{
  activeKey: string
  tabs: Tab[]
  activeRows: Row[]
  pagination: Record<string, any>
  loading: boolean
  beforeUpload: (file: File) => boolean | Promise<boolean>
  getColumns: (columns: Record<string, any>[], key?: string) => Record<string, any>[]
  getScrollX: (columns: Column[], minimum: number) => number
  getStatus: (record: BaseRow) => string
  displayValue: (value?: string) => string
  getVehicleAgeType: (code: string) => string
  getVehicleAgeTypeLabel: (code: string) => string
  normalizeDate: (value?: string) => string
  isVehicleScrapWarning: (code: string) => boolean
  getVehicleScrapDate: (code: string) => string
  getCustomerBalance: (record: BaseRow) => { recordedFreight: number, remainingAmount: number, progress: number } | undefined
  getActions: (record: BaseRow) => RecordActionItem[]
}>()
const emit = defineEmits<{ 'update:activeKey': [value: string], 'export': [], 'create': [] }>()
const importable = computed(() => ['customer', 'vehicle', 'crew', 'route'].includes(props.activeKey))
const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>

<template>
  <a-card title="基础资料列表" :bordered="false">
    <template #extra>
      <a-space>
        <a-upload v-if="importable" :show-upload-list="false" accept=".xlsx,.xls,.csv" :before-upload="beforeUpload">
          <a-button type="primary">
            导入{{ tabs.find(tab => tab.key === activeKey)?.title }}
          </a-button>
        </a-upload>
        <a-button @click="emit('export')">
          导出表格
        </a-button>
        <a-button type="primary" @click="emit('create')">
          新增
        </a-button>
      </a-space>
    </template>
    <a-tabs :active-key="activeKey" @update:active-key="emit('update:activeKey', String($event))">
      <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="tab.title">
        <a-table :row-key="(record: Row) => String(record.code || '')" :columns="getColumns(tab.columns, tab.key)" :data-source="tab.key === activeKey ? activeRows : tab.rows" :pagination="pagination" :loading="loading" :scroll="{ x: getScrollX(getColumns(tab.columns, tab.key), 1200) }">
          <template #headerCell="{ column }">
            <div v-if="tab.key === 'crew' && column.dataIndex === 'vehicleInfo'" class="vehicle-stack-cell">
              <b>车号</b><small>挂号</small>
            </div>
            <div v-else-if="tab.key === 'crew' && column.dataIndex === 'name'" class="crew-info-stack">
              <b>司押人员</b><div class="crew-info-row">
                <span>类型</span><span>姓名</span><span>电话</span><span>证号</span><span>有效期</span>
              </div>
            </div>
            <template v-else>
              {{ column.title }}
            </template>
          </template>
          <template #bodyCell="{ column, record }">
            <a-tag v-if="column.dataIndex === 'status'" color="blue">
              {{ getStatus(record) }}
            </a-tag>
            <div v-else-if="tab.key === 'vehicle' && column.dataIndex === 'code'" class="vehicle-stack-cell">
              <b>{{ displayValue(record.code) }}</b><small>{{ displayValue(record.trailerNo) }}</small>
            </div>
            <div v-else-if="tab.key === 'vehicle' && column.dataIndex === 'driver'" class="vehicle-stack-cell">
              <b>{{ displayValue(record.driver) }}</b><small>{{ displayValue(record.escort) }}</small>
            </div>
            <a-tag v-else-if="tab.key === 'vehicle' && column.dataIndex === 'vehicleAgeType'" :color="getVehicleAgeType(record.code) === 'new' ? 'green' : 'orange'">
              {{ getVehicleAgeTypeLabel(record.code) }}
            </a-tag>
            <template v-else-if="tab.key === 'vehicle' && column.dataIndex === 'purchaseDate'">
              {{ normalizeDate(record.purchaseDate) || '-' }}
            </template>
            <a-tag v-else-if="tab.key === 'vehicle' && column.dataIndex === 'scrapDate'" :color="isVehicleScrapWarning(record.code) ? 'red' : 'blue'">
              {{ getVehicleScrapDate(record.code) || '-' }}
            </a-tag>
            <div v-else-if="tab.key === 'crew' && column.dataIndex === 'vehicleInfo'" class="vehicle-stack-cell">
              <b>{{ displayValue(record.plateNo) }}</b><small>{{ displayValue(record.trailerNo) }}</small>
            </div>
            <div v-else-if="tab.key === 'crew' && column.dataIndex === 'name'" class="crew-info-stack">
              <div class="crew-info-row">
                <span>司机</span><span>{{ displayValue(record.driverName) }}</span><span>{{ displayValue(record.driverPhone) }}</span><span>{{ displayValue(record.driverCertNo) }}</span><span>{{ displayValue(record.driverCertValidTo) }}</span>
              </div>
              <div class="crew-info-row">
                <span>押运</span><span>{{ displayValue(record.escortName) }}</span><span>{{ displayValue(record.escortPhone) }}</span><span>{{ displayValue(record.escortCertNo) }}</span><span>{{ displayValue(record.escortCertValidTo) }}</span>
              </div>
            </div>
            <template v-else-if="tab.key === 'customer' && column.dataIndex === 'bidAmount'">
              {{ record.bidAmount ? money(Number(record.bidAmount)) : '-' }}
            </template>
            <template v-else-if="tab.key === 'customer' && column.dataIndex === 'recordedFreight'">
              {{ getCustomerBalance(record) ? money(getCustomerBalance(record)!.recordedFreight) : '-' }}
            </template>
            <template v-else-if="tab.key === 'customer' && column.dataIndex === 'remainingAmount'">
              {{ getCustomerBalance(record) ? money(getCustomerBalance(record)!.remainingAmount) : '-' }}
            </template>
            <a-progress v-else-if="tab.key === 'customer' && column.dataIndex === 'progress' && getCustomerBalance(record)" :percent="Math.round(getCustomerBalance(record)!.progress)" size="small" />
            <span v-else-if="tab.key === 'customer' && column.dataIndex === 'progress'">-</span>
            <RecordActions v-else-if="column.dataIndex === 'action'" :actions="getActions(record)" />
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
.vehicle-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.vehicle-stack-cell small {
  color: var(--admin-muted);
}
.crew-info-stack {
  display: grid;
  gap: 4px;
  min-width: 620px;
}
.crew-info-row {
  display: grid;
  grid-template-columns: 52px 100px 130px 180px 110px;
  gap: 8px;
  align-items: center;
}
.crew-info-row span:first-child {
  color: var(--admin-muted);
  font-weight: 600;
}
:deep(.table-cell-no-ellipsis) {
  white-space: normal;
}
</style>
