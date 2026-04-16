// src/modules/dashboard/widgets/global/_useSummary.ts
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardService.getSummary,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
