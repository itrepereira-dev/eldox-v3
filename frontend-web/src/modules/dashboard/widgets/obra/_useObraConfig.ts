// src/modules/dashboard/widgets/obra/_useObraConfig.ts
export function useObraConfig(config: Record<string, unknown>): number | null {
  const id = config.obraId
  if (typeof id === 'number') return id
  if (typeof id === 'string') return parseInt(id)
  return null
}
