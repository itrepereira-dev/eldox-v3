// src/modules/dashboard/WidgetWrapper.tsx
import { X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/cn'

interface WidgetWrapperProps {
  titulo: string
  editMode: boolean
  onRemove: () => void
  children: React.ReactNode
  className?: string
}

export function WidgetWrapper({ titulo, editMode, onRemove, children, className }: WidgetWrapperProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg overflow-hidden flex flex-col h-full',
        editMode && 'border-[var(--accent)] border-dashed',
        className,
      )}
    >
      {editMode && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-raised)] border-b border-[var(--border-dim)] flex-shrink-0">
          <div className="flex items-center gap-1.5 drag-handle cursor-grab active:cursor-grabbing">
            <GripVertical size={12} className="text-[var(--text-faint)]" />
            <span className="text-[10px] text-[var(--text-faint)] truncate max-w-[140px]">{titulo}</span>
          </div>
          <button
            onClick={onRemove}
            className="text-[var(--text-faint)] hover:text-[var(--nc)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden p-3">
        {children}
      </div>
    </div>
  )
}
