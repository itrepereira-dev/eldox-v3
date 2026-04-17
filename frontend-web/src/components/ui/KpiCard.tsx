import { cn } from '@/lib/cn'
import type { BadgeVariant } from './Badge'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  variant?: BadgeVariant | 'accent'
  icon?: React.ReactNode
  trend?: { value: number; label?: string }
  className?: string
}

const topBorderColor: Record<string, string> = {
  accent: 'border-t-accent',
  ok:     'border-t-ok',
  run:    'border-t-run',
  warn:   'border-t-warn',
  nc:     'border-t-nc',
  off:    'border-t-off',
}

const valueColor: Record<string, string> = {
  accent: 'text-accent',
  ok:     'text-ok',
  run:    'text-run',
  warn:   'text-warn',
  nc:     'text-nc',
  off:    'text-off',
}

export function KpiCard({
  label,
  value,
  sub,
  variant = 'accent',
  icon,
  trend,
  className,
}: KpiCardProps) {
  const isPositive = trend && trend.value >= 0

  return (
    /* ui-upgrade: hover lift + shadow + rounded-md */
    <div
      className={cn(
        'bg-bg-surface border border-border-dim border-t-[3px] rounded-md p-4',
        'transition-all duration-[200ms] ease-out-expo',
        'hover:-translate-y-[3px] hover:shadow-md hover:border-border',
        topBorderColor[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-text-faint uppercase tracking-[0.5px]">
          {label}
        </p>
        {icon && (
          <span className="text-text-low opacity-60 w-4 h-4">{icon}</span>
        )}
      </div>

      <p className={cn('text-2xl font-bold', valueColor[variant])}>
        {value}
      </p>

      {(sub || trend) && (
        <div className="flex items-center justify-between mt-1">
          {sub && (
            <p className="text-xs text-text-faint">{sub}</p>
          )}
          {trend && (
            <span
              className={cn(
                'text-xs font-semibold',
                isPositive ? 'text-ok' : 'text-nc',
              )}
            >
              {isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              {trend.label && (
                <span className="text-text-faint font-normal ml-1">{trend.label}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ── KpiGrid — wrapper responsivo ──────────────────── */
interface KpiGridProps {
  children: React.ReactNode
  cols?: 2 | 3 | 4
  className?: string
}

export function KpiGrid({ children, cols = 4, className }: KpiGridProps) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols]

  return (
    <div className={cn('grid gap-4', colClass, className)}>
      {children}
    </div>
  )
}
