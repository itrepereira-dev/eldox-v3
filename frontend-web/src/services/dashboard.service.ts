// src/services/dashboard.service.ts
import { api } from './api'
import type { WidgetInstance } from '@/modules/dashboard/registry/types'

export interface DashboardSummary {
  obras: { total: number; em_execucao: number; paralisadas: number; concluidas: number }
  ncs: { abertas: number; criticas: number; vencidas: number }
  aprovacoes: { pendentes_do_usuario: number }
  ged: { vencendo_30d: number }
}

export interface FeedItem {
  tipo: string
  titulo: string
  subtitulo?: string
  obra_nome?: string
  created_at: string
  link: string
  cor: 'red' | 'yellow' | 'green' | 'blue' | 'purple'
}

export const dashboardService = {
  getLayout: () =>
    api.get<{ layout: WidgetInstance[] | null }>('/usuarios/me/dashboard-layout')
      .then((r) => r.data),

  saveLayout: (layout: WidgetInstance[]) =>
    api.put<{ layout: WidgetInstance[] }>('/usuarios/me/dashboard-layout', { layout })
      .then((r) => r.data),

  getSummary: () =>
    api.get<{ status: string; data: DashboardSummary }>('/dashboard/summary')
      .then((r) => r.data.data),

  getFeed: (limit = 20) =>
    api.get<{ status: string; data: { items: FeedItem[] } }>(`/dashboard/feed?limit=${limit}`)
      .then((r) => r.data.data),
}
