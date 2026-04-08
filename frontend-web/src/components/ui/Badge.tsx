import { cn } from '@/lib/cn'

export type BadgeVariant = 'ok' | 'run' | 'warn' | 'nc' | 'off'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
  pulse?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  ok:   'bg-ok-bg text-ok-text border border-ok-border',
  run:  'bg-run-bg text-run-text border border-run-border',
  warn: 'bg-warn-bg text-warn-text border border-warn-border',
  nc:   'bg-nc-bg text-nc-text border border-nc-border',
  off:  'bg-off-bg text-off-text border border-off-border',
}

export function Badge({ variant, children, className, pulse }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5',
        'rounded-full text-xs font-bold uppercase',
        'font-mono tracking-wide',
        pulse && 'animate-badge-pulse',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── StatusDot ──────────────────────────────────────── */
const dotColors: Record<BadgeVariant, string> = {
  ok:   'bg-ok',
  run:  'bg-run',
  warn: 'bg-warn',
  nc:   'bg-nc',
  off:  'bg-off',
}

export function StatusDot({ variant }: { variant: BadgeVariant }) {
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full', dotColors[variant])} />
  )
}

/* ── IconBadge ──────────────────────────────────────── */
const iconBadgeClasses: Record<BadgeVariant, string> = {
  ok:   'bg-ok-bg text-ok',
  run:  'bg-run-bg text-run',
  warn: 'bg-warn-bg text-warn',
  nc:   'bg-nc-bg text-nc',
  off:  'bg-off-bg text-off',
}

interface IconBadgeProps {
  variant: BadgeVariant
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
}

export function IconBadge({ variant, size = 'md', children, className }: IconBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm',
        size === 'md' ? 'w-10 h-10' : 'w-8 h-8',
        iconBadgeClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
