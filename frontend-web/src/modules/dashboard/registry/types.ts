// src/modules/dashboard/registry/types.ts
import type { ReactNode } from 'react'

export interface WidgetInstance {
  instanceId: string
  widgetId: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
}

export interface WidgetDefinition {
  id: string
  titulo: string
  descricao: string
  icone: ReactNode
  modulo: string
  tier: 1 | 2 | 3
  defaultW: number
  defaultH: number
  minW: number
  minH: number
  maxW: number
  maxH: number
  roles: string[]
  needsObraId: boolean
  component: React.FC<{ config: Record<string, unknown>; instanceId: string }>
}
