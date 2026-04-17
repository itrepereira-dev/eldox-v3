import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
  className?: string
}

/**
 * Modal base component with built-in backdrop + content animations.
 * Use this for new modals and progressively migrate existing ones.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className,
}: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--bg-overlay)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className={cn(
          'relative z-10 w-full flex flex-col',
          'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg',
          'shadow-[var(--shadow-lg)]',
          'max-h-[90vh]',
          maxWidth,
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
            <div>
              {title && (
                <h3 id="modal-title" className="text-[15px] font-semibold text-[var(--text-high)] m-0">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[12px] text-[var(--text-faint)] mt-0.5 m-0">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors duration-[150ms] ml-4 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
