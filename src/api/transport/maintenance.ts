export interface MaintenanceSummaryParams {
  records: Array<Record<string, any>>
  filters?: Record<string, any>
}

export interface MaintenanceSummary {
  totalCount: number
  totalAmount: number
  pendingCount: number
  repairingCount: number
  approvedCount: number
  averageAmount: number
}

export function getMaintenanceSummaryApi(data: MaintenanceSummaryParams) {
  return usePost<MaintenanceSummary>('/transport/maintenance/summary', data)
}
