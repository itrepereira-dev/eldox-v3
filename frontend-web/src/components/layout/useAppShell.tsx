import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'

interface AppShellContextValue {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  openMobile: () => void
  closeMobile: () => void
  obraAtiva: string
  setObraAtiva: (obra: string) => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

const COLLAPSED_KEY = 'eldox-sidebar-collapsed'

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })

  const [mobileOpen, setMobileOpen] = useState(false)
  const [obraAtiva, setObraAtiva] = useState('Torre Residencial A')

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const openMobile  = useCallback(() => setMobileOpen(true),  [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // fecha drawer ao redimensionar para desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <AppShellContext.Provider
      value={{ collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile, obraAtiva, setObraAtiva }}
    >
      {children}
    </AppShellContext.Provider>
  )
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used inside AppShellProvider')
  return ctx
}
