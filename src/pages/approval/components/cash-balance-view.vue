<script setup lang="ts">
import type { SummaryCardItem } from '~@/components/summary-cards/index.vue'

type Row = Record<string, any>
defineProps<{
  cards: SummaryCardItem[]
  currentGroups: Array<{ company_name: string, subtotal: number }>
  total: number
  groups: Array<{ company_name: string, subtotal: number, rows: Row[] }>
  filteredTotal: number
  columns: Row[]
  scrollX: number
  loading: boolean
  money: (value: unknown) => string
}>()
const emit = defineEmits<{ 'batch': [], 'create': [], 'edit': [record: Row], 'delete': [record: Row] }>()
const query = defineModel<Row>('query', { required: true })
</script>

<template>
  <div>
    <a-card title="现金余额管理" :bordered="false" mb-4>
      <template #extra>
        <a-space>
          <a-button @click="emit('batch')">
            批量录入余额
          </a-button><a-button type="primary" @click="emit('create')">
            新增余额记录
          </a-button>
        </a-space>
      </template>
      <SummaryCards :cards="cards" compact />
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :lg="10">
          <a-card size="small" title="各主体余额合计" class="cash-sub-card">
            <div v-for="group in currentGroups" :key="group.company_name" class="subject-total-row">
              <span>{{ group.company_name }}</span><strong>{{ money(group.subtotal) }}</strong>
            </div><div class="subject-total-row total">
              <span>总汇总</span><strong>{{ money(total) }}</strong>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="14">
          <a-card size="small" title="历史查询" class="cash-sub-card">
            <a-row :gutter="[12, 12]">
              <a-col :xs="24" :md="8">
                <a-input v-model:value="query.balance_date" placeholder="统计日期 YYYY-MM-DD" allow-clear />
              </a-col><a-col :xs="24" :md="8">
                <a-input v-model:value="query.company_name" placeholder="主体名称" allow-clear />
              </a-col><a-col :xs="24" :md="8">
                <a-input v-model:value="query.bank_name" placeholder="银行名称" allow-clear />
              </a-col>
            </a-row>
          </a-card>
        </a-col>
      </a-row>
    </a-card>
    <a-card title="余额明细表" :bordered="false" mb-4>
      <template #extra>
        <a-tag color="blue">
          总汇总：{{ money(filteredTotal) }}
        </a-tag>
      </template>
      <div v-for="group in groups" :key="group.company_name" class="cash-balance-group">
        <div class="cash-group-title">
          <span>{{ group.company_name }}</span><strong>主体小计：{{ money(group.subtotal) }}</strong>
        </div>
        <a-table row-key="id" size="small" :loading="loading" :pagination="false" :data-source="group.rows" :columns="columns" :scroll="{ x: scrollX }">
          <template #bodyCell="{ column, record }">
            <strong v-if="column.dataIndex === 'balance_amount'">{{ money(record.balance_amount) }}</strong><a-space v-else-if="column.dataIndex === 'action'">
              <a @click="emit('edit', record)">修改</a><a-popconfirm title="确定删除该余额记录？" ok-type="danger" @confirm="emit('delete', record)">
                <a class="danger-link">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
          <template #summary>
            <a-table-summary fixed>
              <a-table-summary-row>
                <a-table-summary-cell :index="0" :col-span="5">
                  {{ group.company_name }} 主体小计
                </a-table-summary-cell><a-table-summary-cell :index="5">
                  {{ money(group.subtotal) }}
                </a-table-summary-cell><a-table-summary-cell :index="6" :col-span="2" />
              </a-table-summary-row>
            </a-table-summary>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.subject-total-row,
.cash-group-title {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--admin-border-subtle);
}
.subject-total-row.total {
  font-weight: 700;
  border-bottom: 0;
}
.cash-balance-group {
  margin-bottom: 20px;
}
.danger-link {
  color: #ff4d4f;
}
</style>
