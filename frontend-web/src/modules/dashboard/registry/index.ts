// src/modules/dashboard/registry/index.ts
import type { WidgetDefinition } from './types'

class WidgetRegistry {
  private map = new Map<string, WidgetDefinition>()

  register(def: WidgetDefinition) {
    this.map.set(def.id, def)
  }

  get(id: string): WidgetDefinition | undefined {
    return this.map.get(id)
  }

  getAll(): WidgetDefinition[] {
    return Array.from(this.map.values())
  }

  getByTier(tier: 1 | 2 | 3): WidgetDefinition[] {
    return this.getAll().filter((d) => d.tier === tier)
  }

  getByModulo(modulo: string): WidgetDefinition[] {
    return this.getAll().filter((d) => d.modulo === modulo)
  }
}

export const widgetRegistry = new WidgetRegistry()
