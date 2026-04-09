import logoPrincipal from '@/assets/logo-principal.png'
import simboloPrincipal from '@/assets/simbolo-principal.png'
import { cn } from '@/lib/cn'
import { useAppShell } from './useAppShell'
import { NavItem, NavSection } from './NavItem'
import { useTheme } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  AlertTriangle,
  FlaskConical,
  FolderOpen,
  Users,
  Truck,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'

/* ── larguras ────────────────────────────────────────── */
const EXPANDED_W = 240
const COLLAPSED_W = 60

/* ── Logo ────────────────────────────────────────────── */
function SidebarLogo() {
  const { collapsed } = useAppShell()

  return (
    <div
      className={cn(
        'flex items-center px-4 py-3.5 border-b border-[var(--border-dim)]',
        'min-h-[56px]',
        collapsed && 'justify-center px-0',
      )}
    >
      {collapsed ? (
        /* símbolo isolado quando colapsado */
        <img
          src={simboloPrincipal}
          alt="EldoX"
          className="w-8 h-8 object-contain select-none"
          draggable={false}
        />
      ) : (
        /* logo completa */
        <img
          src={logoPrincipal}
          alt="EldoX"
          className="h-8 object-contain select-none"
          draggable={false}
        />
      )}
    </div>
  )
}

/* ── Obra Selector ───────────────────────────────────── */
function ObraSelector() {
  const { obraAtiva, collapsed } = useAppShell()
  if (collapsed) return null

  return (
    <div className="mx-3 my-2">
      <button
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-2',
          'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
          'text-left cursor-pointer',
          'hover:bg-[var(--bg-hover)] hover:border-[var(--border)]',
          'transition-all duration-[150ms]',
        )}
      >
        <Layers size={13} className="text-[var(--text-faint)] flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <p className="text-[12px] font-medium text-[var(--text-high)] truncate">
            {obraAtiva}
          </p>
          <p className="text-[10px] text-[var(--text-faint)]">Projeto ativo</p>
        </div>
        <ChevronDown size={12} className="text-[var(--text-faint)] flex-shrink-0" />
      </button>
    </div>
  )
}

/* ── Collapse Toggle ─────────────────────────────────── */
function CollapseBtn() {
  const { collapsed, toggleCollapsed } = useAppShell()

  return (
    <button
      onClick={toggleCollapsed}
      title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      className={cn(
        'absolute -right-3 top-[68px] z-10',
        'w-6 h-6 rounded-full',
        'bg-[var(--bg-raised)] border border-[var(--border)]',
        'flex items-center justify-center',
        'text-[var(--text-faint)] hover:text-[var(--accent)]',
        'hover:border-[var(--accent)]',
        'transition-all duration-[150ms] shadow-xs',
      )}
    >
      {collapsed
        ? <ChevronRight size={12} />
        : <ChevronLeft  size={12} />
      }
    </button>
  )
}

/* ── Footer do usuário ───────────────────────────────── */
function SidebarFooter() {
  const { collapsed } = useAppShell()
  const { theme, toggleTheme } = useTheme()
  const user = useAuthStore((s) => s.user)

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '?'

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN_TENANT: 'Administrador',
    ENGENHEIRO: 'Engenheiro',
    TECNICO: 'Técnico',
    VISITANTE: 'Visitante',
  }

  return (
    <div
      className={cn(
        'mt-auto border-t border-[var(--border-dim)]',
        'p-3 flex items-center gap-2.5',
        collapsed && 'flex-col gap-2 py-3',
      )}
    >
      {/* avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full',
          'bg-[var(--accent-dim)] flex items-center justify-center',
          'text-[11px] font-bold text-[var(--accent)] select-none',
        )}
      >
        {initials}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          <p className="text-[12px] font-semibold text-[var(--text-high)] truncate">
            {user?.nome ?? '—'}
          </p>
          <p className="text-[10px] text-[var(--text-faint)]">
            {user?.role ? (roleLabel[user.role] ?? user.role) : '—'}
          </p>
        </div>
      )}

      {/* theme toggle + settings */}
      <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          aria-label="Alternar tema"
          className={cn(
            'w-7 h-7 rounded-sm flex items-center justify-center',
            'text-[var(--text-faint)] hover:text-[var(--accent)]',
            'hover:bg-[var(--bg-hover)] transition-colors duration-[150ms]',
          )}
        >
          {theme === 'dark'
            ? <Sun  size={14} />
            : <Moon size={14} />
          }
        </button>

        <button
          title="Configurações"
          aria-label="Configurações"
          className={cn(
            'w-7 h-7 rounded-sm flex items-center justify-center',
            'text-[var(--text-faint)] hover:text-[var(--accent)]',
            'hover:bg-[var(--bg-hover)] transition-colors duration-[150ms]',
          )}
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  )
}

/* ── Sidebar Principal ───────────────────────────────── */
interface SidebarProps {
  onNavClick?: () => void
  className?: string
}

export function Sidebar({ onNavClick, className }: SidebarProps) {
  const { collapsed } = useAppShell()

  return (
    <aside
      style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      className={cn(
        'relative flex flex-col h-full',
        'bg-[var(--bg-void)] border-r border-[var(--border-dim)]',
        'transition-[width] duration-[220ms] ease-in-out overflow-hidden',
        className,
      )}
    >
      <CollapseBtn />
      <SidebarLogo />
      <ObraSelector />

      {/* Nav */}
      <nav
        role="navigation"
        aria-label="Navegação principal"
        className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin"
      >
        <NavSection label="Principal">
          <NavItem
            to="/dashboard"
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            onClick={onNavClick}
          />
          <NavItem
            to="/obras"
            icon={<Layers size={18} />}
            label="Obras"
            badge={{ variant: 'run', count: 3 }}
            onClick={onNavClick}
          />
        </NavSection>

        <NavSection label="Qualidade">
          <NavItem
            to="/fvs/fichas"
            icon={<ClipboardList size={18} />}
            label="Fichas FVS"
            onClick={onNavClick}
          />
          <NavItem
            to="/nc"
            icon={<AlertTriangle size={18} />}
            label="Não conformidades"
            badge={{ variant: 'nc', count: 7 }}
            onClick={onNavClick}
          />
          <NavItem
            to="/concretagem"
            icon={<FlaskConical size={18} />}
            label="Concretagem"
            onClick={onNavClick}
          />
        </NavSection>

        <NavSection label="Operacional">
          <NavItem
            to="/ged/admin"
            icon={<FolderOpen size={18} />}
            label="GED"
            onClick={onNavClick}
          />
          <NavItem
            to="/efetivo"
            icon={<Users size={18} />}
            label="Efetivo"
            onClick={onNavClick}
          />
          <NavItem
            to="/frota"
            icon={<Truck size={18} />}
            label="Frota"
            onClick={onNavClick}
          />
          <NavItem
            to="/aprovacoes"
            icon={<Clock size={18} />}
            label="Aprovações"
            badge={{ variant: 'warn', count: 4 }}
            onClick={onNavClick}
          />
        </NavSection>

        <NavSection label="Inteligência">
          <NavItem
            to="/ia"
            icon={<Sparkles size={18} />}
            label="Eldox IA"
            accent
            pulse
            onClick={onNavClick}
          />
        </NavSection>
      </nav>

      <SidebarFooter />
    </aside>
  )
}
