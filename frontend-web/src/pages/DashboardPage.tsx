// src/pages/DashboardPage.tsx
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, Pencil } from 'lucide-react'
import { dashboardService } from '@/services/dashboard.service'
import { DashboardGrid } from '@/modules/dashboard/DashboardGrid'
import { AddWidgetDrawer } from '@/modules/dashboard/AddWidgetDrawer'
import { WidgetConfigModal } from '@/modules/dashboard/WidgetConfigModal'
import { useAuthStore } from '@/store/auth.store'
import type { WidgetInstance } from '@/modules/dashboard/registry/types'
import type { WidgetDefinition } from '@/modules/dashboard/registry/types'
// importar para registrar todos os widgets (side-effect import)
import '@/modules/dashboard/registry/widgets.tsx'

const DEFAULT_LAYOUTS: Record<string, WidgetInstance[]> = {
  ADMIN_TENANT: [
    { instanceId: 'obras-1',   widgetId: 'obras-status',          x: 0, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'ncs-1',    widgetId: 'ncs-abertas',            x: 3, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'aprov-1',  widgetId: 'aprovacoes-pendentes',   x: 6, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'sem-1',    widgetId: 'semaforo-geral',         x: 0, y: 1, w: 6, h: 2, config: {} },
    { instanceId: 'feed-1',   widgetId: 'atividade-recente',      x: 6, y: 1, w: 6, h: 2, config: {} },
  ],
  ENGENHEIRO: [
    { instanceId: 'ncs-1',    widgetId: 'ncs-abertas',            x: 0, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'aprov-1',  widgetId: 'aprovacoes-pendentes',   x: 3, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'sem-1',    widgetId: 'semaforo-geral',         x: 0, y: 1, w: 6, h: 2, config: {} },
    { instanceId: 'feed-1',   widgetId: 'atividade-recente',      x: 6, y: 1, w: 6, h: 2, config: {} },
  ],
  TECNICO: [
    { instanceId: 'aprov-1',  widgetId: 'aprovacoes-pendentes',   x: 0, y: 0, w: 4, h: 1, config: {} },
    { instanceId: 'ncs-1',    widgetId: 'ncs-abertas',            x: 4, y: 0, w: 4, h: 1, config: {} },
    { instanceId: 'feed-1',   widgetId: 'atividade-recente',      x: 0, y: 1, w: 8, h: 2, config: {} },
  ],
  VISITANTE: [
    { instanceId: 'obras-1',  widgetId: 'obras-status',           x: 0, y: 0, w: 4, h: 1, config: {} },
    { instanceId: 'sem-1',    widgetId: 'semaforo-geral',         x: 0, y: 1, w: 8, h: 2, config: {} },
  ],
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [editMode, setEditMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingDef, setPendingDef] = useState<WidgetDefinition | null>(null)
  const [localLayout, setLocalLayout] = useState<WidgetInstance[] | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-layout'],
    queryFn: dashboardService.getLayout,
  })

  const saveMutation = useMutation({
    mutationFn: (layout: WidgetInstance[]) => dashboardService.saveLayout(layout),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-layout'] })
      setEditMode(false)
      setLocalLayout(null)
    },
  })

  const role = user?.role ?? 'TECNICO'
  const savedLayout = data?.layout as WidgetInstance[] | null
  const activeLayout = localLayout ?? savedLayout ?? DEFAULT_LAYOUTS[role] ?? DEFAULT_LAYOUTS.TECNICO

  const handleAddWidget = (def: WidgetDefinition) => {
    if (def.needsObraId) {
      setDrawerOpen(false)
      setPendingDef(def)
    } else {
      addWidgetToLayout(def, {})
      setDrawerOpen(false)
    }
  }

  const addWidgetToLayout = useCallback((def: WidgetDefinition, config: Record<string, unknown>) => {
    const instanceId = `${def.id}-${Date.now()}`
    const newWidget: WidgetInstance = {
      instanceId,
      widgetId: def.id,
      x: 0,
      y: Infinity,
      w: def.defaultW,
      h: def.defaultH,
      config,
    }
    setLocalLayout((prev) => [...(prev ?? activeLayout), newWidget])
    setPendingDef(null)
  }, [activeLayout])

  const handleSave = () => {
    saveMutation.mutate(activeLayout)
  }

  const handleCancel = () => {
    setLocalLayout(null)
    setEditMode(false)
  }

  const primeiroNome = user?.nome?.split(' ')[0] ?? 'Usuário'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-high)]">Bom dia, {primeiroNome} 👋</h1>
          <p className="text-xs text-[var(--text-faint)] mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border)] rounded-md text-[var(--text-mid)] hover:border-[var(--accent)] transition-colors"
              >
                <Plus size={12} /> Adicionar widget
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-high)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
              >
                <Check size={12} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-md text-[var(--text-faint)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
            >
              <Pencil size={12} /> Editar dashboard
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-faint)] text-sm">
            Carregando dashboard...
          </div>
        ) : (
          <DashboardGrid
            layout={activeLayout}
            editMode={editMode}
            onLayoutChange={setLocalLayout}
          />
        )}
      </div>

      <AddWidgetDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAddWidget}
      />

      <WidgetConfigModal
        def={pendingDef}
        onConfirm={(config) => pendingDef && addWidgetToLayout(pendingDef, config)}
        onClose={() => setPendingDef(null)}
      />
    </div>
  )
}
