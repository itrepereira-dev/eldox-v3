import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant =
  | 'primary'
  | 'ghost'
  | 'gray'
  | 'ok'
  | 'nc'
  | 'run'
  | 'outline-accent'

export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent hover:bg-accent-hover text-[var(--bg-void)] shadow-hover hover:-translate-y-px',
  ghost:
    'bg-transparent border border-border text-text-mid hover:border-accent hover:text-accent',
  gray:
    'bg-bg-raised border border-border text-text-mid hover:bg-bg-hover',
  ok:
    'bg-ok text-[var(--bg-void)] hover:brightness-110',
  nc:
    'bg-nc text-text-high hover:brightness-110',
  run:
    'bg-run text-[var(--bg-void)] hover:brightness-110',
  'outline-accent':
    'bg-transparent border-[1.5px] border-accent text-accent hover:bg-accent-dim',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[32px]',
  md: 'px-5 py-2.5 text-sm min-h-[40px]',
  lg: 'px-8 py-3.5 text-base min-h-[48px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm font-semibold',
          'cursor-pointer transition-all duration-fast',
          'active:scale-[.97]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : icon ? (
          <span className="w-3.5 h-3.5 flex items-center">{icon}</span>
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
