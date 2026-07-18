<script setup lang="ts">
type Row = Record<string, any>
defineProps<{
  moduleKey: string
  salaryTab: string
  title: string
  columns: Row[]
  rows: Row[]
  pagination: Row | false
  scroll: Row
  loading: boolean
  salaryEditingId?: string
  wageFields: Set<string>
  socialFields: Set<string>
  columnKey: (dataIndex: unknown) => string
  statusColor: (status: string) => string
  statusCell: (record: Row, dataIndex: unknown) => string
  displayCell: (...args: any[]) => any
  inlineActions: (...args: any[]) => any[]
  moreActions: (...args: any[]) => any[]
}>()
const emit = defineEmits<{
  'viewEmployee': [record: Row]
  'editTemplate': [record: Row]
  'generateSalary': [record: Row]
  'recalculateSalary': [record: Row]
  'runAction': [action: any]
}>()
const approvalStatuses = ['草稿', '待审批', '审批通过', '审批驳回', '已发放', '已归档', '已作废']
</script>

<template>
  <a-card :title="title" :bordered="false">
    <a-table row-key="id" :loading="loading" :size="moduleKey === 'salary' ? 'small' : 'middle'" :columns="columns" :data-source="rows" :pagination="pagination" :scroll="scroll">
      <template #bodyCell="{ column, record }">
        <a-space v-if="moduleKey === 'salary' && salaryTab === 'templates' && column.dataIndex === 'action'" class="oa-row-actions" :size="4">
          <a-button type="link" size="small" @click="emit('viewEmployee', record)">
            查看人员
          </a-button>
          <a-button type="link" size="small" @click="emit('editTemplate', record)">
            修改
          </a-button>
          <a-button type="link" size="small" :disabled="record.linkStatus === '已生成工资' || record.employeeStatus !== '在职'" @click="emit('generateSalary', record)">
            生成工资
          </a-button>
        </a-space>
        <a-tag v-else-if="moduleKey === 'salary' && salaryTab === 'templates' && ['employeeStatus', 'linkStatus'].includes(String(column.dataIndex))" :color="statusColor(String(record[columnKey(column.dataIndex)] || ''))">
          {{ record[columnKey(column.dataIndex)] || '-' }}
        </a-tag>
        <span v-else-if="moduleKey === 'salary' && wageFields.has(String(column.dataIndex))" class="salary-amount salary-amount--wage">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
        <span v-else-if="moduleKey === 'salary' && socialFields.has(String(column.dataIndex))" class="salary-amount salary-amount--social">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
        <template v-else-if="moduleKey === 'salary' && salaryEditingId === record.id && ['attendanceDays', 'cashPayment', 'payStatus', 'status'].includes(String(column.dataIndex))">
          <a-input-number v-if="column.dataIndex === 'attendanceDays'" v-model:value="record[columnKey(column.dataIndex)]" size="small" style="width:100%" :precision="0" :min="0" :max="31" @change="emit('recalculateSalary', record)" />
          <a-select v-else-if="column.dataIndex === 'payStatus'" v-model:value="record.payStatus" size="small" style="width:100%">
            <a-select-option value="未发放">
              未发放
            </a-select-option><a-select-option value="已发放">
              已发放
            </a-select-option>
          </a-select>
          <a-select v-else-if="column.dataIndex === 'status'" v-model:value="record.status" size="small" style="width:100%">
            <a-select-option v-for="item in approvalStatuses" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-input v-else v-model:value="record[columnKey(column.dataIndex)]" size="small" />
        </template>
        <a-tag v-else-if="['status', 'payStatus', 'dispatchStatus'].includes(String(column.dataIndex))" :color="statusColor(statusCell(record, column.dataIndex))">
          {{ statusCell(record, column.dataIndex) }}
        </a-tag>
        <a-space v-else-if="column.dataIndex === 'action'" class="oa-row-actions" :size="4">
          <template v-for="action in inlineActions(record)" :key="action.key">
            <a-popconfirm v-if="action.confirm" :title="action.confirmTitle || `确定${action.label}该记录？`" @confirm="emit('runAction', action)">
              <a-button type="link" size="small" :danger="action.danger" :disabled="action.disabled">
                {{ action.label }}
              </a-button>
            </a-popconfirm>
            <a-button v-else type="link" size="small" :danger="action.danger" :disabled="action.disabled" @click="emit('runAction', action)">
              {{ action.label }}
            </a-button>
          </template>
          <a-popover v-if="moreActions(record).length" trigger="click" placement="bottomRight">
            <template #content>
              <div class="oa-action-popover">
                <template v-for="action in moreActions(record)" :key="action.key">
                  <a-popconfirm v-if="action.confirm" :title="action.confirmTitle || `确定${action.label}该记录？`" @confirm="emit('runAction', action)">
                    <a-button type="link" size="small" :danger="action.danger" :disabled="action.disabled">
                      {{ action.label }}
                    </a-button>
                  </a-popconfirm><a-button v-else type="link" size="small" :danger="action.danger" :disabled="action.disabled" @click="emit('runAction', action)">
                    {{ action.label }}
                  </a-button>
                </template>
              </div>
            </template><a-button type="link" size="small">
              更多
            </a-button>
          </a-popover>
        </a-space>
        <a-tooltip v-else :title="displayCell(record, columnKey(column.dataIndex))">
          <span class="cell-ellipsis">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
        </a-tooltip>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped>
.salary-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.salary-amount--wage {
  color: #1677ff;
}
.salary-amount--social {
  color: #389e0d;
}
.oa-action-popover {
  display: flex;
  flex-direction: column;
  min-width: 110px;
}
.cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
