import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { useAppShell } from './useAppShell'
import {
  Search,
  Bell,
  Plus,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

/* ── Breadcrumb ──────────────────────────────────────── */
interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRight
                size={12}
                className="text-[var(--text-faint)] flex-shrink-0"
              />
            )}
            <span
              className={cn(
                'text-[12px] truncate',
                isLast
                  ? 'font-semibold text-[var(--text-high)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-mid)] cursor-pointer transition-colors',
              )}
            >
              {item.label}
            </span>
          </span>
        )
      })}
    </nav>
  )
}

/* ── SearchBox ───────────────────────────────────────── */
function SearchBox() {
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // atalho ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 h-9',
        'bg-[var(--bg-raised)] border rounded-sm',
        'transition-all duration-[150ms]',
        'w-full max-w-[360px]',
        focused
          ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-dim)]'
          : 'border-[var(--border-dim)]',
      )}
    >
      <Search size={14} className="text-[var(--text-faint)] flex-shrink-0" />

      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Buscar em todos os módulos..."
        aria-label="Busca global"
        className={cn(
          'flex-1 bg-transparent outline-none border-none',
          'text-[13px] text-[var(--text-high)]',
          'placeholder:text-[var(--text-faint)]',
          'font-sans',
        )}
      />

      {query ? (
        <button
          onClick={() => setQuery('')}
          className="text-[var(--text-faint)] hover:text-[var(--text-mid)]"
          aria-label="Limpar busca"
        >
          <X size={12} />
        </button>
      ) : (
        <kbd
          className={cn(
            'hidden sm:flex items-center gap-0.5',
            'text-[10px] text-[var(--text-faint)] font-mono',
            'px-1.5 py-0.5 rounded border border-[var(--border-dim)]',
            'bg-[var(--bg-void)]',
          )}
        >
          ⌘K
        </kbd>
      )}
    </div>
  )
}

/* ── NotificationBell ────────────────────────────────── */
function NotificationBell() {
  const count = 3

  return (
    <button
      aria-label={`${count} notificações`}
      className={cn(
        'relative w-9 h-9 rounded-sm flex items-center justify-center',
        'text-[var(--text-low)] hover:text-[var(--text-high)]',
        'hover:bg-[var(--bg-hover)]',
        'border border-[var(--border-dim)] hover:border-[var(--border)]',
        'transition-all duration-[150ms]',
      )}
    >
      <Bell size={16} />
      {count > 0 && (
        <span
          className={cn(
            'absolute top-1 right-1',
            'w-2 h-2 rounded-full bg-[var(--nc)]',
            'animate-badge-pulse',
          )}
        />
      )}
    </button>
  )
}

/* ── PrimaryAction ───────────────────────────────────── */
interface PrimaryActionProps {
  label: string
  onClick?: () => void
}

function PrimaryAction({ label, onClick }: PrimaryActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 h-9 rounded-sm',
        'bg-[var(--accent)] hover:bg-[var(--accent-hover)]',
        'text-[var(--bg-void)] text-[13px] font-semibold',
        'transition-colors duration-[150ms]',
        'whitespace-nowrap',
        'hover:-translate-y-px hover:shadow-hover',
        'active:scale-[.97]',
      )}
    >
      <Plus size={14} />
      {label}
    </button>
  )
}

/* ── Topbar Principal ────────────────────────────────── */
export interface TopbarProps {
  breadcrumb?: BreadcrumbItem[]
  primaryAction?: { label: string; onClick?: () => void }
  scrolled?: boolean
}

export function Topbar({ breadcrumb = [], primaryAction, scrolled = false }: TopbarProps) {
  const { openMobile, mobileOpen } = useAppShell()

  return (
    <header
      className={cn(
        'relative flex items-center justify-between gap-3 px-4 sm:px-6',
        'h-[56px] flex-shrink-0',
        'bg-[var(--bg-surface)] border-b border-[var(--border)]',
        'z-40',
        'transition-all duration-[200ms]',
        scrolled && 'backdrop-blur-md border-b-[var(--border-bright)] shadow-sm',
        /* scan-line decorativo */
        'after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0',
        'after:h-px after:bg-gradient-to-r after:from-transparent',
        'after:via-[var(--accent)] after:to-transparent',
        'after:animate-scan-line',
      )}
    >
      {/* Mobile: botão de menu */}
      <button
        onClick={openMobile}
        aria-label="Abrir menu"
        className={cn(
          'lg:hidden w-8 h-8 flex items-center justify-center',
          'text-[var(--text-low)] hover:text-[var(--text-high)]',
          'rounded-sm hover:bg-[var(--bg-hover)]',
          'transition-colors duration-[150ms]',
          mobileOpen && 'hidden',
        )}
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <Breadcrumb items={breadcrumb} />
      </div>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <SearchBox />
      </div>

      {/* Ações à direita */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <NotificationBell />

        {primaryAction && (
          <PrimaryAction
            label={primaryAction.label}
            onClick={primaryAction.onClick}
          />
        )}

        {/* Avatar */}
        <button
          aria-label="Menu do usuário"
          className={cn(
            'w-8 h-8 rounded-full flex-shrink-0',
            'bg-[var(--accent-dim)] flex items-center justify-center',
            'text-[11px] font-bold text-[var(--accent)]',
            'hover:ring-2 hover:ring-[var(--accent)] hover:ring-offset-1',
            'hover:ring-offset-[var(--bg-void)]',
            'transition-all duration-[150ms] select-none',
          )}
        >
          IP
        </button>
      </div>
    </header>
  )
}
