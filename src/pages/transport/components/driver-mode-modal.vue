<script setup lang="ts">
type Form = Record<string, any>
defineProps<{
  open: boolean
  vehicleOptions: Array<{ label: string, value: string }>
  plateNos: string[]
  getModeClass: (mode: string) => string
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'save': []
  'addPlate': []
  'removePlate': [plate: string]
}>()
const form = defineModel<Form>('form', { required: true })
const modes = ['固定月薪', '底薪+差费', '底薪+里程', '纯里程']
</script>

<template>
  <a-modal :open="open" title="薪资模式配置" width="520px" ok-text="保存" cancel-text="取消" destroy-on-close @update:open="emit('update:open', $event)" @ok="emit('save')">
    <a-form layout="vertical" :model="form">
      <a-form-item label="车牌号">
        <div class="plate-editor-list">
          <a-tag v-for="plate in plateNos.filter(item => item !== '-')" :key="plate" closable @close.prevent="emit('removePlate', plate)">
            {{ plate }}
          </a-tag>
        </div>
        <div class="plate-add-row">
          <a-select v-model:value="form.newPlateNo" :options="vehicleOptions" show-search allow-clear option-filter-prop="label" placeholder="从车辆信息选择车号" @keydown.enter="emit('addPlate')" />
          <a-date-picker v-model:value="form.newPlateStartDate" value-format="YYYY-MM-DD" placeholder="启用日期" />
          <a-button type="primary" :disabled="!form.newPlateNo || !form.newPlateStartDate" @click="emit('addPlate')">
            添加
          </a-button>
        </div>
        <div class="linked-field-tip">
          车号来源于基础资料的车辆信息；至少保留一个车牌号。
        </div>
      </a-form-item>
      <a-form-item label="薪资模式">
        <div class="salary-mode-options" role="radiogroup" aria-label="薪资模式">
          <button v-for="mode in modes" :key="mode" class="salary-mode-option" :class="[getModeClass(mode), { 'is-selected': form.salaryMode === mode }]" type="button" role="radio" :aria-checked="form.salaryMode === mode" @click="form.salaryMode = mode">
            {{ mode }}
          </button>
        </div>
      </a-form-item>
      <a-form-item label="模式金额（元）">
        <a-input-number v-model:value="form.modeAmount" :min="0" :precision="2" class="full-width-input" placeholder="请输入模式金额" />
        <div class="linked-field-tip">
          模式变更从出勤统计当前选中日期起生效，历史日期保留原模式颜色。
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.plate-editor-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
  margin-bottom: 10px;
}
.plate-add-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 150px auto;
  gap: 8px;
}
.full-width-input {
  width: 100%;
}
.linked-field-tip {
  margin-top: 6px;
  color: var(--admin-muted);
  font-size: 12px;
}
.salary-mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.salary-mode-option {
  min-height: 42px;
  padding: 8px 12px;
  color: var(--admin-text);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  cursor: pointer;
}
.salary-mode-option:hover,
.salary-mode-option.is-selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgb(22 119 255 / 10%);
}
.salary-mode-option.mode-fixed {
  color: #1677ff;
  background: #eaf2ff;
}
.salary-mode-option.mode-base-diff {
  color: #389e0d;
  background: #edf9e8;
}
.salary-mode-option.mode-base-mileage {
  color: #d46b08;
  background: #fff7e6;
}
.salary-mode-option.mode-mileage {
  color: #722ed1;
  background: #f9f0ff;
}
@media (max-width: 640px) {
  .plate-add-row,
  .salary-mode-options {
    grid-template-columns: 1fr;
  }
}
</style>
