<script setup lang="ts">
interface Option { value: string, label: string }
defineProps<{
  open: boolean
  title: string
  submitting: boolean
  tabKey: string
  columns: Array<{ title: string, dataIndex: string }>
  requiredDataIndex?: string
  vehicleOptions: Option[]
  customerOptions: Option[]
  routeValidityRange?: [string, string]
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:routeValidityRange': [value: [string, string] | undefined]
  'save': []
  'fillCrewVehicle': [value: string]
  'fillRouteCustomer': [value: string]
  'changeValidityType': [value: string]
  'syncGeofence': []
  'resolveCoordinates': [field: string]
}>()
const form = defineModel<Record<string, any>>('form', { required: true })
const statuses = ['正常', '合作中', '营运中', '维保提醒', '在岗', '启用', '停用']
const filterOption = (input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
</script>

<template>
  <a-modal :open="open" :title="title" :confirm-loading="submitting" width="760px" :mask-closable="false" ok-text="保存" cancel-text="取消" destroy-on-close @update:open="emit('update:open', $event)" @ok="emit('save')">
    <a-form layout="vertical" class="base-data-form">
      <a-row :gutter="[16, 8]">
        <a-col v-for="column in columns" :key="column.dataIndex" :xs="24" :md="column.dataIndex === 'detailAddress' || column.dataIndex === 'name' ? 24 : 12">
          <a-form-item :label="column.title" :required="column.dataIndex === 'code' || column.dataIndex === requiredDataIndex || (tabKey === 'route' && column.dataIndex === 'routeValidityType') || (tabKey === 'route' && column.dataIndex === 'routeEffectiveDateRange' && form.routeValidityType === '时间范围')">
            <a-select v-if="column.dataIndex === 'status'" v-model:value="form[column.dataIndex]">
              <a-select-option v-for="status in statuses" :key="status" :value="status">
                {{ status }}
              </a-select-option>
            </a-select>
            <a-select v-else-if="tabKey === 'crew' && column.dataIndex === 'plateNo'" v-model:value="form[column.dataIndex]" show-search allow-clear :filter-option="filterOption" placeholder="请选择车号" @change="emit('fillCrewVehicle', String($event || ''))">
              <a-select-option v-for="item in vehicleOptions" :key="item.value" :value="item.value" :label="item.label">
                {{ item.label }}
              </a-select-option>
            </a-select>
            <a-select v-else-if="tabKey === 'route' && column.dataIndex === 'customer'" v-model:value="form[column.dataIndex]" show-search allow-clear :filter-option="filterOption" placeholder="请选择客户" @change="emit('fillRouteCustomer', String($event || ''))">
              <a-select-option v-for="item in customerOptions" :key="item.value" :value="item.value" :label="item.label">
                {{ item.label }}
              </a-select-option>
            </a-select>
            <a-select v-else-if="tabKey === 'route' && column.dataIndex === 'routeValidityType'" v-model:value="form[column.dataIndex]" placeholder="请选择路线时效" @change="emit('changeValidityType', String($event || ''))">
              <a-select-option value="长期">
                长期
              </a-select-option><a-select-option value="时间范围">
                时间范围
              </a-select-option>
            </a-select>
            <a-range-picker v-else-if="tabKey === 'route' && column.dataIndex === 'routeEffectiveDateRange'" :value="routeValidityRange" class="w-full" value-format="YYYY-MM-DD" :disabled="form.routeValidityType !== '时间范围'" :allow-clear="form.routeValidityType === '时间范围'" :placeholder="['开始日期', '结束日期']" @update:value="emit('update:routeValidityRange', $event as [string, string] | undefined)" />
            <a-input-number v-else-if="tabKey === 'customer' && column.dataIndex === 'bidAmount'" v-model:value="form[column.dataIndex]" class="w-full" string-mode :min="0" :precision="2" addon-before="¥" placeholder="请输入中标金额" />
            <a-date-picker v-else-if="tabKey === 'customer' && column.dataIndex === 'bidStartDate'" v-model:value="form[column.dataIndex]" class="w-full" value-format="YYYY-MM-DD" placeholder="请选择开始时间" />
            <a-date-picker v-else-if="tabKey === 'vehicle' && ['purchaseDate', 'insuranceExpireDate', 'inspectionExpireDate'].includes(column.dataIndex)" v-model:value="form[column.dataIndex]" class="w-full" value-format="YYYY-MM-DD" :placeholder="`请选择${column.title}`" />
            <a-textarea v-else-if="column.dataIndex === 'detailAddress' || column.dataIndex === 'name'" v-model:value="form[column.dataIndex]" :auto-size="{ minRows: 1, maxRows: 3 }" :placeholder="`请输入${column.title}`" @change="emit('syncGeofence')" />
            <a-input v-else v-model:value="form[column.dataIndex]" :placeholder="`请输入${column.title}`" @change="emit('syncGeofence')" @blur="emit('resolveCoordinates', column.dataIndex)" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<style scoped>
.base-data-form :deep(.ant-form-item) {
  margin-bottom: 8px;
}
.base-data-form :deep(.ant-form-item-label) {
  padding-bottom: 2px;
}
.base-data-form :deep(.ant-input),
.base-data-form :deep(.ant-select-selector),
.base-data-form :deep(.ant-picker) {
  min-height: 34px;
  border-radius: 4px;
}
.base-data-form :deep(textarea.ant-input) {
  min-height: 60px;
}
</style>
