import { cn } from '@/lib/cn'

interface SkeletonProps {
  className?: string
  height?: string
  width?: string
}

/** Single skeleton line/block — uses .skeleton shimmer from index.css */
export function Skeleton({ className, height = 'h-4', width = 'w-full' }: SkeletonProps) {
  return <div className={cn('skeleton', height, width, className)} />
}

/** Skeleton for a KPI card */
export function SkeletonKpiCard({ className }: { className?: string }) {
  return (
    <div className={cn(
      'bg-bg-surface border border-border-dim border-t-[3px] border-t-border rounded-md p-4',
      className,
    )}>
      <Skeleton height="h-3" width="w-20" className="mb-3" />
      <Skeleton height="h-7" width="w-16" className="mb-2" />
      <Skeleton height="h-3" width="w-24" />
    </div>
  )
}

/** Skeleton grid matching KpiGrid layout */
export function SkeletonKpiGrid({ cols = 4, className }: { cols?: 2 | 3 | 4; className?: string }) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols]

  return (
    <div className={cn('grid gap-4', colClass, className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonKpiCard key={i} />
      ))}
    </div>
  )
}

/** Skeleton for a table/list row */
export function SkeletonRow({ cols = 4, className }: { cols?: number; className?: string }) {
  const widths = ['w-1/4', 'w-1/3', 'w-1/5', 'w-1/4', 'w-1/6']
  return (
    <div className={cn('flex items-center gap-4 py-3 px-4 border-b border-border-dim', className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height="h-3.5" width={widths[i % widths.length]} />
      ))}
    </div>
  )
}

/** Skeleton for an entire list/table */
export function SkeletonList({ rows = 6, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('bg-bg-surface border border-border-dim rounded-md overflow-hidden', className)}>
      {/* Header row */}
      <div className="flex items-center gap-4 py-2.5 px-4 border-b border-border bg-bg-raised">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="h-3" width="w-16" className="opacity-60" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  )
}

/** Skeleton for a card with title + content */
export function SkeletonCard({ height = 'h-48', className }: { height?: string; className?: string }) {
  return (
    <div className={cn('bg-bg-surface border border-border-dim rounded-md p-5', height, className)}>
      <Skeleton height="h-4" width="w-32" className="mb-4" />
      <Skeleton height="h-3" width="w-full" className="mb-2" />
      <Skeleton height="h-3" width="w-4/5" className="mb-2" />
      <Skeleton height="h-3" width="w-3/5" />
    </div>
  )
}
