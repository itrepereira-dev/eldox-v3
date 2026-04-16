import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAppShell } from './useAppShell'
import type { BadgeVariant } from '@/components/ui'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  badge?: { variant: BadgeVariant; count: number }
  accent?: boolean
  pulse?: boolean
  end?: boolean
  onClick?: () => void
}

const badgeBg: Record<BadgeVariant, string> = {
  ok:   'bg-[var(--ok)]',
  run:  'bg-[var(--run)]',
  warn: 'bg-[var(--warn)]',
  nc:   'bg-[var(--nc)]',
  off:  'bg-[var(--off)]',
}

export function NavItem({ to, icon, label, badge, accent, pulse, end, onClick }: NavItemProps) {
  const { collapsed } = useAppShell()

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 px-4 py-[7px]',
          'text-[13.5px] font-[450] transition-all duration-[150ms]',
          'border-l-[3px] border-transparent',
          'text-[var(--text-low)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-high)]',
          isActive && [
            'bg-[var(--accent-dim)] text-[var(--text-high)]',
            'border-l-[var(--accent)] font-semibold',
          ],
          accent && !isActive && 'text-[var(--accent)]',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {/* ícone */}
      <span
        className={cn(
          'flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center',
          'transition-transform duration-[150ms] group-hover:scale-110',
        )}
      >
        {icon}
      </span>

      {/* label + badge (ocultos quando collapsed) */}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>

          {badge && (
            <span
              className={cn(
                'ml-auto min-w-[18px] h-[18px] px-1',
                'flex items-center justify-center',
                'rounded-full text-[10px] font-bold text-white font-mono',
                badgeBg[badge.variant],
              )}
            >
              {badge.count}
            </span>
          )}

          {pulse && (
            <span className="ml-auto w-2 h-2 rounded-full bg-[var(--accent)] animate-badge-pulse" />
          )}
        </>
      )}

      {/* badge visível no modo colapsado como dot */}
      {collapsed && badge && (
        <span
          className={cn(
            'absolute top-1 right-1 w-2 h-2 rounded-full',
            badgeBg[badge.variant],
          )}
        />
      )}
    </NavLink>
  )
}

/* ── NavItemGroup (com submenu) ─────────────────────── */
interface NavSubItem {
  to: string
  label: string
  end?: boolean
}

interface NavItemGroupProps {
  icon: React.ReactNode
  label: string
  items: NavSubItem[]
  onClick?: () => void
}

export function NavItemGroup({ icon, label, items, onClick }: NavItemGroupProps) {
  const { collapsed } = useAppShell()
  const location = useLocation()
  const isAnyActive = items.some(i => location.pathname.startsWith(i.to))
  const [open, setOpen] = useState(isAnyActive)

  if (collapsed) {
    return (
      <div className="relative group/group">
        <button
          title={label}
          className={cn(
            'flex items-center justify-center w-full py-2 mx-1 rounded-sm',
            'text-[var(--text-low)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-high)]',
            'transition-all duration-[150ms]',
            isAnyActive && 'text-[var(--accent)]',
          )}
        >
          <span className="w-[18px] h-[18px] flex items-center justify-center">
            {icon}
          </span>
        </button>
        {/* flyout on hover */}
        <div className={cn(
          'absolute left-full top-0 ml-2 z-50 min-w-[160px]',
          'bg-[var(--bg-raised)] border border-[var(--border)] rounded-md shadow-md',
          'hidden group-hover/group:flex flex-col py-1',
        )}>
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] font-mono">{label}</p>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClick}
              className={({ isActive }) => cn(
                'px-3 py-1.5 text-[13px] text-[var(--text-low)] hover:text-[var(--text-high)] hover:bg-[var(--bg-hover)]',
                isActive && 'text-[var(--accent)] font-semibold',
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'group flex items-center gap-2.5 px-4 py-[7px] w-full',
          'text-[13.5px] font-[450] transition-all duration-[150ms]',
          'border-l-[3px] border-transparent',
          'text-[var(--text-low)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-high)]',
          isAnyActive && 'text-[var(--accent)]',
        )}
      >
        <span className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center transition-transform duration-[150ms] group-hover:scale-110">
          {icon}
        </span>
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown
          size={13}
          className={cn('transition-transform duration-[150ms] text-[var(--text-faint)]', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-px pl-7 pr-2 pb-1">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClick}
              className={({ isActive }) => cn(
                'px-3 py-1.5 rounded-sm text-[12px] font-medium',
                'text-[var(--text-low)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-high)]',
                'transition-colors duration-[150ms] border-l-2 border-transparent',
                isActive && 'text-[var(--accent)] border-l-[var(--accent)] bg-[var(--accent-dim)] font-semibold',
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── NavSection ─────────────────────────────────────── */
export function NavSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const { collapsed } = useAppShell()

  return (
    <div className="mb-1">
      {!collapsed && (
        <p
          className={cn(
            'px-5 pt-3 pb-1',
            'text-[10px] font-semibold uppercase tracking-[0.08em] font-mono select-none',
            'text-[var(--text-faint)]',
          )}
        >
          {label}
        </p>
      )}
      {collapsed && <div className="my-2 mx-3 h-px bg-[var(--border-dim)]" />}
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  )
}
