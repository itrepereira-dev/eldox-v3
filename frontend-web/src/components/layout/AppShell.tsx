import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useParams } from 'react-router-dom'

/* ui-upgrade: page transition wrapper */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-page-enter h-full">
      {children}
    </div>
  )
}
/* /ui-upgrade */
import { cn } from '@/lib/cn'
import { AppShellProvider, useAppShell } from './useAppShell'
import { Sidebar } from './Sidebar'
import { Topbar, type TopbarProps } from './Topbar'
import { AgenteFloat } from '../agente/AgenteFloat'

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

function ObraAtivaSync() {
  const { obraAtivaId, setObraAtivaId } = useAppShell()
  const { obraId } = useParams<{ obraId?: string }>()
  const location = useLocation()

  useEffect(() => {
    // Extrai obraId tanto de params (rotas aninhadas) quanto do pathname
    const fromParams = obraId ? parseInt(obraId, 10) : null
    const match = location.pathname.match(/\/obras\/(\d+)/)
    const fromPath = match ? parseInt(match[1], 10) : null
    const id = fromParams ?? fromPath

    if (id && !isNaN(id) && id !== obraAtivaId) {
      setObraAtivaId(id)
    }
  }, [location.pathname, obraId, obraAtivaId, setObraAtivaId])

  return null
}

function AppShellInner({ children, breadcrumb, primaryAction }: AppShellInnerProps) {
  const { collapsed: _collapsed } = useAppShell()
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 8)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return (
    <div
      className={cn(
        'flex h-screen w-full overflow-hidden',
        'bg-[var(--bg-void)] text-[var(--text-high)]',
        'font-sans antialiased',
      )}
    >
      <ObraAtivaSync />

      {/* ── Sidebar desktop (fixa à esquerda) ── */}
      <div className="relative hidden lg:flex flex-shrink-0 h-screen">
        <Sidebar />
      </div>

      {/* ── Mobile Drawer ── */}
      <MobileDrawer />

      {/* ── Área direita: topbar + conteúdo ── */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden border-l border-[var(--border-dim)]">
        <Topbar breadcrumb={breadcrumb} primaryAction={primaryAction} scrolled={scrolled} />

        {/* ── Conteúdo principal ── */}
        <main
          ref={mainRef}
          role="main"
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden',
            'p-4 sm:p-6',
            'bg-[var(--bg-void)]',
          )}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <AgenteFloat />
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
