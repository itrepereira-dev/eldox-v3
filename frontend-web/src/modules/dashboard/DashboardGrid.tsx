// src/modules/dashboard/DashboardGrid.tsx
import { useCallback } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, Layouts } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { widgetRegistry } from './registry'
import { WidgetWrapper } from './WidgetWrapper'
import type { WidgetInstance } from './registry/types'

const ResponsiveGrid = WidthProvider(Responsive)

interface DashboardGridProps {
  layout: WidgetInstance[]
  editMode: boolean
  onLayoutChange: (layout: WidgetInstance[]) => void
}

export function DashboardGrid({ layout, editMode, onLayoutChange }: DashboardGridProps) {
  const handleLayoutChange = useCallback(
    (_currentLayout: Layout[], allLayouts: Layouts) => {
      // Use the lg layout to preserve 12-column positions regardless of active breakpoint
      const source = allLayouts.lg ?? _currentLayout
      const updated: WidgetInstance[] = source.map((item) => {
        const existing = layout.find((w) => w.instanceId === item.i)
        return {
          instanceId: item.i,
          widgetId: existing?.widgetId ?? item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          config: existing?.config ?? {},
        }
      })
      onLayoutChange(updated)
    },
    [layout, onLayoutChange],
  )

  const handleRemove = useCallback(
    (instanceId: string) => {
      onLayoutChange(layout.filter((w) => w.instanceId !== instanceId))
    },
    [layout, onLayoutChange],
  )

  if (layout.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-faint)] gap-3">
        <p className="text-sm">Seu dashboard está vazio.</p>
        {editMode && <p className="text-xs">Clique em "Adicionar widget" para começar.</p>}
      </div>
    )
  }

  const gridLayout = layout.map((w) => ({
    i: w.instanceId,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: widgetRegistry.get(w.widgetId)?.minW ?? 1,
    minH: widgetRegistry.get(w.widgetId)?.minH ?? 1,
    maxW: widgetRegistry.get(w.widgetId)?.maxW ?? 12,
    maxH: widgetRegistry.get(w.widgetId)?.maxH ?? 6,
  }))

  return (
    <ResponsiveGrid
      layouts={{ lg: gridLayout }}
      breakpoints={{ lg: 1200, md: 768, sm: 0 }}
      cols={{ lg: 12, md: 6, sm: 1 }}
      rowHeight={100}
      margin={[8, 8]}
      isDraggable={editMode}
      isResizable={editMode}
      draggableHandle=".drag-handle"
      onLayoutChange={handleLayoutChange}
      useCSSTransforms
    >
      {layout.map((instance) => {
        const def = widgetRegistry.get(instance.widgetId)
        if (!def) return null
        const WidgetComponent = def.component

        return (
          <div key={instance.instanceId}>
            <WidgetWrapper
              titulo={def.titulo}
              editMode={editMode}
              onRemove={() => handleRemove(instance.instanceId)}
              className="h-full"
            >
              <WidgetComponent
                config={instance.config}
                instanceId={instance.instanceId}
              />
            </WidgetWrapper>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
