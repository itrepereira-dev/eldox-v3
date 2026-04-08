import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/* ── base classes compartilhadas ───────────────────── */
const inputBase = [
  'w-full px-3 py-2.5',
  'border border-border rounded-sm',
  'text-sm bg-bg-raised text-text-mid',
  'font-sans',
  'outline-none transition-all duration-fast',
  'focus:border-accent focus:shadow-accent-ring',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'placeholder:text-text-faint',
].join(' ')

/* ── Input ─────────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputBase, error && 'border-nc focus:border-nc focus:shadow-[0_0_0_3px_var(--nc-border)]', className)}
      {...props}
    />
  )
)
Input.displayName = 'Input'

/* ── Textarea ──────────────────────────────────────── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputBase, 'min-h-[70px] resize-y', error && 'border-nc', className)}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

/* ── Select ────────────────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(inputBase, error && 'border-nc', className)}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

/* ── Field (wrapper com label) ─────────────────────── */
interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function Field({ label, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('mb-4', className)}>
      <label className="block text-xs font-semibold text-text-faint uppercase tracking-[0.6px] font-mono mb-1.5">
        {label}
        {required && <span className="text-nc ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-text-faint">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-nc-text">{error}</p>
      )}
    </div>
  )
}

/* ── FieldRow (grid de campos lado a lado) ─────────── */
export function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {children}
    </div>
  )
}
