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
  obraAtivaId: number | null
  setObraAtivaId: (id: number | null) => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

const COLLAPSED_KEY   = 'eldox-sidebar-collapsed'
const OBRA_ATIVA_KEY  = 'eldox-obra-ativa-id'

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })

  const [mobileOpen, setMobileOpen] = useState(false)
  const [obraAtiva, setObraAtiva] = useState('')
  const [obraAtivaId, setObraAtivaIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem(OBRA_ATIVA_KEY)
    const parsed = saved ? parseInt(saved, 10) : null
    return parsed && !isNaN(parsed) ? parsed : null
  })

  const setObraAtivaId = useCallback((id: number | null) => {
    setObraAtivaIdState(id)
    if (id !== null) {
      localStorage.setItem(OBRA_ATIVA_KEY, String(id))
    } else {
      localStorage.removeItem(OBRA_ATIVA_KEY)
    }
  }, [])

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
      value={{ collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile, obraAtiva, setObraAtiva, obraAtivaId, setObraAtivaId: setObraAtivaId }}
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
