import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'ok' | 'warn' | 'nc' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void
  success: (message: string) => void
  error:   (message: string) => void
  warn:    (message: string) => void
  info:    (message: string) => void
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ── Individual toast item ────────────────────────────────────────────────────

const icons: Record<ToastVariant, typeof CheckCircle> = {
  ok:   CheckCircle,
  warn: AlertTriangle,
  nc:   XCircle,
  info: Info,
}

const variantStyles: Record<ToastVariant, string> = {
  ok:   'border-l-[var(--ok)]   bg-[var(--ok-bg)]',
  warn: 'border-l-[var(--warn)] bg-[var(--warn-bg)]',
  nc:   'border-l-[var(--nc)]   bg-[var(--nc-bg)]',
  info: 'border-l-[var(--run)]  bg-[var(--run-bg)]',
}

const iconColors: Record<ToastVariant, string> = {
  ok:   'text-[var(--ok)]',
  warn: 'text-[var(--warn)]',
  nc:   'text-[var(--nc)]',
  info: 'text-[var(--run)]',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const Icon = icons[toast.variant]

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 min-w-[280px] max-w-[400px]',
        'bg-[var(--bg-surface)] border border-[var(--border)] border-l-[4px] rounded-md',
        'shadow-[var(--shadow-md)]',
        'animate-toast-in',
        variantStyles[toast.variant],
      )}
      role="alert"
    >
      <Icon size={16} className={cn('flex-shrink-0 mt-0.5', iconColors[toast.variant])} />
      <p className="flex-1 text-[13px] text-[var(--text-high)] leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Fechar"
        className="flex-shrink-0 text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, variant, duration }])
    setTimeout(() => remove(id), duration)
  }, [remove])

  const success = useCallback((msg: string) => toast(msg, 'ok'),   [toast])
  const error   = useCallback((msg: string) => toast(msg, 'nc'),   [toast])
  const warn    = useCallback((msg: string) => toast(msg, 'warn'), [toast])
  const info    = useCallback((msg: string) => toast(msg, 'info'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warn, info }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
