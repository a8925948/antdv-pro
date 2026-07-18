<script setup lang="ts">
export interface SummaryCardItem {
  label: string
  value: string | number
  hint?: string
  tag?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
}

defineProps<{
  cards: SummaryCardItem[]
  loading?: boolean
  xlSpan?: number
  compact?: boolean
  singleColumn?: boolean
}>()
</script>

<template>
  <a-empty v-if="!loading && !cards.length" class="summary-empty" description="暂无统计数据" />
  <a-row v-else :gutter="[16, 16]" class="summary-cards" :class="{ 'is-compact': compact, 'is-single-column': singleColumn }">
    <a-col v-for="item in cards" :key="item.label" :xs="24" :sm="singleColumn ? 24 : 12" :xl="singleColumn ? 24 : (xlSpan ?? 6)">
      <a-card class="summary-card" :class="[`tone-${item.tone || 'default'}`, { 'is-compact': compact }]" :loading="loading" :bordered="true">
        <div class="summary-main">
          <div class="summary-title">
            {{ item.label }}
          </div>
          <div class="summary-value">
            {{ item.value }}
          </div>
        </div>
        <div class="summary-footer">
          <span class="summary-hint" :class="`is-${item.tone || 'default'}`">
            {{ item.hint || '当前筛选范围' }}
          </span>
          <a-tag v-if="item.tag" class="summary-tag" :color="item.tone === 'warning' ? 'orange' : item.tone === 'success' ? 'green' : item.tone === 'danger' ? 'red' : 'blue'">
            {{ item.tag }}
          </a-tag>
        </div>
      </a-card>
    </a-col>
  </a-row>
</template>

<style scoped lang="less">
.summary-cards {
  margin-bottom: 16px;
}

.summary-cards.is-single-column {
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;

  :deep(> .ant-col) {
    width: 214px !important;
    max-width: 214px !important;
    flex: 0 0 214px !important;
  }

  .summary-card {
    height: 118px;

    :deep(.ant-card-body) {
      height: 100%;
      min-height: 0;
      padding: 12px 14px 10px;
    }
  }

  .summary-title {
    font-size: 12px;
  }

  .summary-value {
    margin-top: 5px;
    overflow: hidden;
    font-size: 20px;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: keep-all;
  }

  .summary-footer {
    min-height: 18px;
    margin-top: 6px;
  }

  .summary-hint {
    font-size: 12px;
  }
}

.summary-empty {
  margin-bottom: 16px;
  background: var(--admin-surface);
  border: 1px dashed var(--admin-border);
  border-radius: var(--admin-radius);
}

.summary-card {
  position: relative;
  overflow: hidden;
  border-color: var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  box-shadow: var(--admin-shadow-card);

  &::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    content: '';
    background: var(--admin-border);
  }

  &.tone-primary::before {
    background: var(--admin-primary);
  }

  &.tone-success::before {
    background: var(--admin-success);
  }

  &.tone-warning::before {
    background: var(--admin-warning);
  }

  &.tone-danger::before {
    background: var(--admin-danger);
  }

  &:hover {
    box-shadow: var(--admin-shadow-hover);
  }

  :deep(.ant-card-body) {
    display: flex;
    min-height: 124px;
    flex-direction: column;
    justify-content: space-between;
    padding: 18px 20px 16px;
  }
}

.summary-card.is-compact {
  :deep(.ant-card-body) {
    min-height: 104px;
    padding: 16px 18px 14px;
  }
}

.summary-title {
  color: var(--admin-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.summary-value {
  margin-top: 10px;
  color: var(--admin-text);
  font-size: 26px;
  font-weight: 650;
  line-height: 1.15;
  word-break: break-word;
  font-variant-numeric: tabular-nums;
}

.summary-card.is-compact .summary-value {
  margin-top: 8px;
  font-size: 23px;
}

.summary-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 22px;
  margin-top: 14px;
}

.summary-card.is-compact .summary-footer {
  margin-top: 10px;
}

.summary-hint {
  min-width: 0;
  overflow: hidden;
  color: var(--admin-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-success {
    color: var(--admin-success);
  }

  &.is-warning {
    color: var(--admin-warning);
  }

  &.is-danger {
    color: var(--admin-danger);
  }

  &.is-primary {
    color: var(--admin-primary);
  }
}

.summary-tag {
  flex: 0 0 auto;
  margin-inline-end: 0;
}

@media (max-width: 768px) {
  .summary-cards {
    margin-bottom: 12px;
  }

  .summary-card {
    :deep(.ant-card-body) {
      min-height: 104px;
    }
  }

  .summary-value {
    font-size: 23px;
  }
}
</style>
