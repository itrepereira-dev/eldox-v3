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

/* ui-upgrade: variant classes with premium hover states */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-accent to-[#2563eb] text-white ' +
    'shadow-[0_2px_8px_rgba(59,130,246,.25)] ' +
    'hover:shadow-[0_6px_20px_rgba(59,130,246,.45)] hover:-translate-y-[2px] ' +
    'ease-spring duration-[200ms]',
  ghost:
    'bg-transparent border border-border-dim text-text-mid ' +
    'hover:border-accent hover:text-accent hover:bg-accent-dim ' +
    'ease-out-expo',
  gray:
    'bg-bg-raised border border-border text-text-mid hover:bg-bg-hover ease-out-expo',
  ok:
    'bg-ok text-[var(--bg-void)] hover:brightness-110 hover:-translate-y-px ease-out-expo',
  nc:
    'bg-nc text-text-high hover:brightness-110 hover:-translate-y-px ease-out-expo',
  run:
    'bg-run text-[var(--bg-void)] hover:brightness-110 hover:-translate-y-px ease-out-expo',
  'outline-accent':
    'bg-transparent border-[1.5px] border-accent text-accent hover:bg-accent-dim ' +
    'hover:shadow-[0_0_0_3px_rgba(59,130,246,.12)] ease-out-expo',
}
/* /ui-upgrade */

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
          'cursor-pointer transition-all duration-[150ms]',
          'active:scale-[.97] active:translate-y-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]',
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
