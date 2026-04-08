import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { AppShellProvider, useAppShell } from './useAppShell'
import { Sidebar } from './Sidebar'
import { Topbar, type TopbarProps } from './Topbar'

/* ── Mobile Drawer Overlay ───────────────────────────── */
function MobileDrawer() {
  const { mobileOpen, closeMobile } = useAppShell()

  if (!mobileOpen) return null

  return (
    <>
      {/* backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-[var(--bg-overlay)] lg:hidden',
          'animate-fade-in',
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* sidebar deslizante */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden',
          'shadow-lg animate-fade-in',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        <Sidebar onNavClick={closeMobile} />
      </div>
    </>
  )
}

/* ── AppShellInner (usa o context) ───────────────────── */
interface AppShellInnerProps extends TopbarProps {
  children: ReactNode
}

function AppShellInner({ children, breadcrumb, primaryAction }: AppShellInnerProps) {
  const { collapsed } = useAppShell()

  return (
    <div
      className={cn(
        'flex h-screen w-full overflow-hidden',
        'bg-[var(--bg-void)] text-[var(--text-high)]',
        'font-sans antialiased',
      )}
    >
      {/* ── Sidebar desktop (fixa à esquerda) ── */}
      <div className="hidden lg:flex flex-shrink-0 h-screen">
        <Sidebar />
      </div>

      {/* ── Mobile Drawer ── */}
      <MobileDrawer />

      {/* ── Área direita: topbar + conteúdo ── */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        <Topbar breadcrumb={breadcrumb} primaryAction={primaryAction} />

        {/* ── Conteúdo principal ── */}
        <main
          role="main"
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden',
            'p-4 sm:p-6',
            'bg-[var(--bg-void)]',
            'transition-all duration-[220ms]',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

/* ── AppShell (exportação pública) ──────────────────── */
export interface AppShellProps extends AppShellInnerProps {}

export function AppShell({ children, breadcrumb, primaryAction }: AppShellProps) {
  return (
    <AppShellProvider>
      <AppShellInner breadcrumb={breadcrumb} primaryAction={primaryAction}>
        {children}
      </AppShellInner>
    </AppShellProvider>
  )
}
