import logoPrincipal from '@/assets/logo-principal.png'
import simboloPrincipal from '@/assets/simbolo-principal.png'
import { cn } from '@/lib/cn'
import { useAppShell } from './useAppShell'
import { NavItem, NavItemGroup, NavSection } from './NavItem'
import { useTheme } from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { obrasService } from '@/services/obras.service'
import { useEffect } from 'react'
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  AlertTriangle,
  FlaskConical,
  FolderOpen,
  Users,
  Clock,
  Settings,
  Sun,
  Moon,
  BookOpen,
  Boxes,
  Building2,
  BookOpenCheck,
  Warehouse,
  BarChart2,
  TestTubes,
  Gauge,
  ListChecks,
} from 'lucide-react'

/* ── larguras ────────────────────────────────────────── */
const EXPANDED_W = 240
const COLLAPSED_W = 60

/* ── Hook: resolve obraAtivaId automaticamente ───────── */
function useResolvedObraId(): number | null {
  const { obraAtivaId, setObraAtivaId } = useAppShell()

  // Só busca obras se não há obra ativa no contexto
  const { data: obras } = useQuery({
    queryKey: ['obras-sidebar-fallback'],
    queryFn: () => obrasService.getAll({ limit: 1 }),
    enabled: obraAtivaId === null,
    staleTime: 60_000,
  })

  // Quando obras carregam e não há obra ativa, salva a primeira
  useEffect(() => {
    if (obraAtivaId === null) {
      const lista = Array.isArray(obras) ? obras : (obras as any)?.items ?? []
      const primeira = lista[0]
      if (primeira?.id) {
        setObraAtivaId(primeira.id)
      }
    }
  }, [obras, obraAtivaId, setObraAtivaId])

  if (obraAtivaId !== null) return obraAtivaId

  const lista = Array.isArray(obras) ? obras : (obras as any)?.items ?? []
  return lista[0]?.id ?? null
}

/* ── Logo ────────────────────────────────────────────── */
function SidebarLogo() {
  const { collapsed } = useAppShell()

  return (
    <div
      className={cn(
        'flex items-center px-4 py-3.5',
        'min-h-[56px]',
        collapsed && 'justify-center px-0',
      )}
    >
      {collapsed ? (
        <img
          src={simboloPrincipal}
          alt="EldoX"
          className="w-8 h-8 object-contain select-none dark:brightness-0 dark:invert"
          draggable={false}
        />
      ) : (
        <img
          src={logoPrincipal}
          alt="EldoX"
          className="h-8 object-contain select-none dark:brightness-0 dark:invert"
          draggable={false}
        />
      )}
    </div>
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
          'flex-shrink-0 w-7 h-7 rounded-full',
          'flex items-center justify-center',
          'text-[11px] font-bold text-white select-none',
          'bg-gradient-to-br from-[var(--accent)] to-[#a855f7]',
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

/* ── FVM Nav helper ──────────────────────────────────── */
function FvmControleLink({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const to = obraAtivaId ? `/fvm/obras/${obraAtivaId}` : '/fvm/catalogo'

  return (
    <NavItem
      to={to}
      icon={<Boxes size={18} />}
      label="Controle de Materiais"
      onClick={onClick}
    />
  )
}

/* ── Concretagem Nav helper ──────────────────────────── */
function ConcretagemNavGroup({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const base = obraAtivaId ? `/obras/${obraAtivaId}/concretagem` : null

  return (
    <NavItemGroup
      icon={<FlaskConical size={18} />}
      label="Concretagem"
      items={[
        { to: base ?? '/obras',                              label: 'Dashboard', end: true },
        { to: base ? `${base}/concretagens` : '/obras',     label: 'Concretagens' },
        { to: base ? `${base}/croqui` : '/obras',           label: 'Croqui' },
      ]}
      onClick={onClick}
    />
  )
}

/* ── Ensaios Nav helper ──────────────────────────────── */
function EnsaiosNavGroup({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const base = obraAtivaId ? `/obras/${obraAtivaId}/ensaios` : null

  return (
    <NavItemGroup
      icon={<TestTubes size={18} />}
      label="Ensaios"
      items={[
        { to: base ?? '/obras',                                  label: 'Conformidade', end: true },
        { to: base ? `${base}/laboratoriais` : '/obras',        label: 'Laboratoriais' },
        { to: base ? `${base}/revisoes` : '/obras',             label: 'Revisões' },
      ]}
      onClick={onClick}
    />
  )
}

/* ── Planos de Ação Nav helper ───────────────────────────── */
function PlanosAcaoLink({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const to = obraAtivaId ? `/obras/${obraAtivaId}/fvs/planos-acao` : '/obras'

  return (
    <NavItem
      to={to}
      icon={<ListChecks size={18} />}
      label="Planos de Ação"
      onClick={onClick}
    />
  )
}

/* ── Almoxarifado Nav helper ─────────────────────────── */
function AlmoxarifadoNavGroup({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const base = obraAtivaId ? `/obras/${obraAtivaId}/almoxarifado` : null

  return (
    <NavItemGroup
      icon={<Warehouse size={18} />}
      label="Almoxarifado"
      items={[
        { to: base ?? '/obras',                                  label: 'Dashboard', end: true },
        { to: base ? `${base}/estoque` : '/obras',              label: 'Estoque' },
        { to: base ? `${base}/solicitacoes` : '/obras',         label: 'Solicitações' },
        { to: base ? `${base}/ocs` : '/obras',                  label: 'Compras (OC)' },
        { to: base ? `${base}/nfes` : '/obras',                 label: 'NF-e' },
        { to: base ? `${base}/planejamento` : '/obras',         label: 'Planejamento' },
        { to: base ? `${base}/insights` : '/obras',             label: 'Insights IA' },
      ]}
      onClick={onClick}
    />
  )
}

/* ── Efetivo Nav helper ──────────────────────────────── */
function EfetivoNavLink({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const to = obraAtivaId ? `/obras/${obraAtivaId}/efetivo` : '/obras'

  return (
    <NavItem
      to={to}
      icon={<Users size={18} />}
      label="Efetivo"
      onClick={onClick}
    />
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
        'bg-[var(--bg-surface)]',
        'transition-[width] duration-[220ms] ease-in-out overflow-hidden',
        className,
      )}
    >
      <SidebarLogo />
      <div className="h-px w-full bg-[var(--border-dim)] flex-shrink-0" />

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
            end
            icon={<Layers size={18} />}
            label="Obras"
            badge={{ variant: 'run', count: 3 }}
            onClick={onNavClick}
          />
        </NavSection>

        <NavSection label="Qualidade">
          <NavItemGroup
            icon={<ClipboardList size={18} />}
            label="Fichas de Inspeções"
            items={[
              { to: '/fvs/fichas',  label: 'Inspeções' },
              { to: '/fvs/modelos', label: 'Templates' },
            ]}
            onClick={onNavClick}
          />
          <NavItem
            to="/fvs/dashboard"
            icon={<BarChart2 size={18} />}
            label="Dashboard FVS"
            onClick={onNavClick}
          />
          <NavItem
            to="/ncs"
            icon={<AlertTriangle size={18} />}
            label="Não conformidades"
            badge={{ variant: 'nc', count: 7 }}
            onClick={onNavClick}
          />
          <PlanosAcaoLink onClick={onNavClick} />
          <ConcretagemNavGroup onClick={onNavClick} />
          <EnsaiosNavGroup onClick={onNavClick} />
        </NavSection>

        <NavSection label="Materiais">
          <FvmControleLink onClick={onNavClick} />
          <NavItem
            to="/fvm/catalogo"
            icon={<BookOpen size={18} />}
            label="Catálogo FVM"
            onClick={onNavClick}
          />
          <NavItem
            to="/fvm/fornecedores"
            icon={<Building2 size={18} />}
            label="Fornecedores"
            onClick={onNavClick}
          />
        </NavSection>

        <NavSection label="Gestão de Estoque">
          <AlmoxarifadoNavGroup onClick={onNavClick} />
        </NavSection>

        <NavSection label="Operacional">
          <NavItem
            to="/diario"
            icon={<BookOpenCheck size={18} />}
            label="Diário de Obra"
            onClick={onNavClick}
          />
          <NavItem
            to="/ged/admin"
            icon={<FolderOpen size={18} />}
            label="GED"
            onClick={onNavClick}
          />
          <EfetivoNavLink onClick={onNavClick} />
          <NavItem
            to="/aprovacoes"
            icon={<Clock size={18} />}
            label="Aprovações"
            badge={{ variant: 'warn', count: 4 }}
            onClick={onNavClick}
          />
          <NavItem
            to="/semaforo"
            icon={<Gauge size={18} />}
            label="Semáforo"
            onClick={onNavClick}
          />
          <NavItemGroup
            icon={<ListChecks size={18} />}
            label="Cadastros"
            items={[
              { to: '/configuracoes/fvs/catalogo',      label: 'Serviços FVS' },
              { to: '/configuracoes/planos-acao',       label: 'Planos de Ação' },
              { to: '/configuracoes/ensaios/tipos',     label: 'Tipos de Ensaio' },
              { to: '/configuracoes/efetivo/cadastros', label: 'Cadastros Efetivo' },
            ]}
            onClick={onNavClick}
          />
        </NavSection>

      </nav>

      <SidebarFooter />
    </aside>
  )
}
