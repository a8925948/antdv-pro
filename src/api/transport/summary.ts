export interface TransportSummaryCard {
  label: string
  value: string | number
  hint?: string
  tag?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
}

export function getTransportModuleSummaryApi(data: {
  moduleName: string
  rows: Array<Record<string, any>>
  filters?: Record<string, any>
}) {
  return usePost<TransportSummaryCard[]>('/transport/module/summary', data)
}
