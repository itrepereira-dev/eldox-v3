// frontend-web/src/modules/fvs/catalogo/components/TodosServicosView.tsx
import { useState, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { useServicos } from '../hooks/useCatalogo'
import { ServicoCard } from './ServicoCard'
import type { FvsCategoria, FvsServico } from '@/services/fvs.service'
import { Plus, Loader2, Search, X } from 'lucide-react'

// ─── Tipos de filtro ────────────────────────────────────────────────────────

type Origem      = 'todos' | 'sistema' | 'tenant'
type StatusFiltro = 'todos' | 'ativo' | 'inativo'
type CritFiltro  = 'todos' | 'critico' | 'maior' | 'menor'

interface Filtros {
  categoriaId: number | ''    // '' = todas
  norma:       string         // '' = qualquer
  origem:      Origem
  status:      StatusFiltro
  criticidade: CritFiltro
}

const FILTROS_VAZIOS: Filtros = {
  categoriaId: '',
  norma:       '',
  origem:      'todos',
  status:      'todos',
  criticidade: 'todos',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function contarAtivos(f: Filtros): number {
  return (
    (f.categoriaId !== ''   ? 1 : 0) +
    (f.norma       !== ''   ? 1 : 0) +
    (f.origem      !== 'todos' ? 1 : 0) +
    (f.status      !== 'todos' ? 1 : 0) +
    (f.criticidade !== 'todos' ? 1 : 0)
  )
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  categorias: FvsCategoria[]
  onNovoServico: () => void
  onClonar:      (id: number) => void
  onEditar:      (servico: FvsServico) => void
  onExcluir:     (id: number) => void
  onToggleAtivo: (id: number, ativo: boolean) => void
  onMoverItem:   (servicoId: number, itens: { id: number; ordem: number }[]) => void
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function TodosServicosView({
  categorias, onNovoServico, onClonar, onEditar, onExcluir, onToggleAtivo, onMoverItem,
}: Props) {
  const { data: todos = [], isLoading } = useServicos()
  const [busca,   setBusca]   = useState('')
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setFiltros(f => ({ ...f, [k]: v }))

  // Normas distintas extraídas do catálogo
  const normasDisponiveis = useMemo(() => {
    const s = new Set<string>()
    for (const srv of todos) {
      if (srv.norma_referencia?.trim()) s.add(srv.norma_referencia.trim())
    }
    return [...s].sort()
  }, [todos])

  // Índice: categoria_id → categoria
  const catById = useMemo(() => {
    const m = new Map<number, FvsCategoria>()
    for (const c of categorias) m.set(c.id, c)
    return m
  }, [categorias])

  // Aplicar busca + filtros
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()

    return todos.filter(s => {
      // Busca textual
      if (q) {
        const hit =
          s.nome.toLowerCase().includes(q) ||
          (s.codigo ?? '').toLowerCase().includes(q) ||
          (s.norma_referencia ?? '').toLowerCase().includes(q) ||
          s.itens?.some(i => i.descricao.toLowerCase().includes(q))
        if (!hit) return false
      }

      // Categoria
      if (filtros.categoriaId !== '') {
        if (s.categoria_id !== filtros.categoriaId) return false
      }

      // Norma
      if (filtros.norma !== '') {
        if ((s.norma_referencia ?? '') !== filtros.norma) return false
      }

      // Origem
      if (filtros.origem === 'sistema' && !s.is_sistema)  return false
      if (filtros.origem === 'tenant'  &&  s.is_sistema)  return false

      // Status
      if (filtros.status === 'ativo'   && !s.ativo) return false
      if (filtros.status === 'inativo' &&  s.ativo) return false

      // Criticidade — serviço deve ter ao menos 1 item com a criticidade exigida
      if (filtros.criticidade !== 'todos') {
        const tem = s.itens?.some(i => i.criticidade === filtros.criticidade)
        if (!tem) return false
      }

      return true
    })
  }, [todos, busca, filtros])

  // Agrupar por categoria preservando ordem: sistema → tenant → sem categoria
  const grupos = useMemo(() => {
    const map = new Map<string, FvsServico[]>()
    for (const s of filtrados) {
      const cat  = s.categoria_id ? catById.get(s.categoria_id) : null
      const nome = cat?.nome ?? 'Sem categoria'
      if (!map.has(nome)) map.set(nome, [])
      map.get(nome)!.push(s)
    }

    const sistemaNomes = categorias.filter(c => c.is_sistema).map(c => c.nome)
    const tenantNomes  = categorias.filter(c => !c.is_sistema).map(c => c.nome)
    const ordered: { nome: string; isSistema: boolean; servicos: FvsServico[] }[] = []

    for (const nome of sistemaNomes) {
      if (map.has(nome)) ordered.push({ nome, isSistema: true,  servicos: map.get(nome)! })
    }
    for (const nome of tenantNomes) {
      if (map.has(nome)) ordered.push({ nome, isSistema: false, servicos: map.get(nome)! })
    }
    if (map.has('Sem categoria')) {
      ordered.push({ nome: 'Sem categoria', isSistema: false, servicos: map.get('Sem categoria')! })
    }
    return ordered
  }, [filtrados, catById, categorias])

  const totalAtivos   = todos.filter(s => s.ativo).length
  const totalInativos = todos.filter(s => !s.ativo).length
  const filtrosAtivos = contarAtivos(filtros)

  const semResultado = !isLoading && filtrados.length === 0
  const temFiltro    = busca.trim() !== '' || filtrosAtivos > 0

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-dim)] flex-shrink-0">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, código, norma ou item..."
            className={cn(
              'w-full h-8 pl-8 pr-3 rounded-sm text-[12px] outline-none border',
              'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-high)]',
              'placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]',
            )}
          />
        </div>

        <p className="text-[11px] text-[var(--text-faint)] whitespace-nowrap">
          {isLoading ? '—' : (
            <>
              {todos.length} serviço{todos.length !== 1 ? 's' : ''}
              {' · '}{totalAtivos} ativo{totalAtivos !== 1 ? 's' : ''}
              {totalInativos > 0 && ` · ${totalInativos} inativo${totalInativos !== 1 ? 's' : ''}`}
            </>
          )}
        </p>

        <button
          onClick={onNovoServico}
          className={cn(
            'flex items-center gap-1.5 px-3 h-8 rounded-sm text-[12px] font-semibold flex-shrink-0',
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors',
          )}
        >
          <Plus size={12} />
          Novo Serviço
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-[var(--border-dim)] bg-[var(--bg-raised)] flex-shrink-0">

        {/* Categoria */}
        <select
          value={filtros.categoriaId}
          onChange={e => set('categoriaId', e.target.value === '' ? '' : Number(e.target.value))}
          className={cn(
            'h-7 pl-2 pr-6 rounded-sm text-[11px] outline-none border appearance-none cursor-pointer',
            'bg-[var(--bg-input)] text-[var(--text-mid)]  transition-colors',
            filtros.categoriaId !== ''
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border)]',
          )}
        >
          <option value="">Categoria: todas</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        {/* Norma */}
        <select
          value={filtros.norma}
          onChange={e => set('norma', e.target.value)}
          className={cn(
            'h-7 pl-2 pr-6 rounded-sm text-[11px] outline-none border appearance-none cursor-pointer',
            'bg-[var(--bg-input)] transition-colors',
            filtros.norma !== ''
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-mid)]',
          )}
        >
          <option value="">Norma: todas</option>
          {normasDisponiveis.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Separador */}
        <div className="w-px h-5 bg-[var(--border-dim)]" />

        {/* Origem */}
        <ToggleGroup
          label="Origem"
          options={[
            { value: 'todos',   label: 'Todos'         },
            { value: 'sistema', label: 'PBQP-H'        },
            { value: 'tenant',  label: 'Personalizado' },
          ]}
          value={filtros.origem}
          onChange={v => set('origem', v as Origem)}
        />

        {/* Status */}
        <ToggleGroup
          label="Status"
          options={[
            { value: 'todos',   label: 'Todos'    },
            { value: 'ativo',   label: 'Ativos'   },
            { value: 'inativo', label: 'Inativos' },
          ]}
          value={filtros.status}
          onChange={v => set('status', v as StatusFiltro)}
        />

        {/* Criticidade */}
        <ToggleGroup
          label="Criticidade"
          options={[
            { value: 'todos',   label: 'Qualquer' },
            { value: 'critico', label: 'Crítico'  },
            { value: 'maior',   label: 'Maior'    },
            { value: 'menor',   label: 'Menor'    },
          ]}
          value={filtros.criticidade}
          onChange={v => set('criticidade', v as CritFiltro)}
        />

        {/* Limpar */}
        {filtrosAtivos > 0 && (
          <>
            <div className="w-px h-5 bg-[var(--border-dim)]" />
            <button
              onClick={() => setFiltros(FILTROS_VAZIOS)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-sm text-[11px] border border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--nc)] hover:border-[var(--nc-border)] transition-colors"
            >
              <X size={11} />
              Limpar ({filtrosAtivos})
            </button>
          </>
        )}

        {/* Contador de resultados quando filtrado */}
        {temFiltro && !isLoading && (
          <span className="ml-auto text-[11px] text-[var(--text-faint)]">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Lista ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-faint)]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Carregando...
          </div>
        ) : semResultado ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-faint)]">
            {temFiltro ? (
              <>
                <p className="text-sm">Nenhum serviço encontrado com os filtros aplicados</p>
                <button
                  onClick={() => { setBusca(''); setFiltros(FILTROS_VAZIOS) }}
                  className="mt-2 text-[var(--accent)] text-sm hover:underline"
                >
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-sm mb-3">Nenhum serviço cadastrado</p>
                <button onClick={onNovoServico} className="text-[var(--accent)] text-sm hover:underline">
                  + Adicionar primeiro serviço
                </button>
              </>
            )}
          </div>
        ) : (
          grupos.map(({ nome, isSistema, servicos }) => (
            <div key={nome}>
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                <span className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                  {nome}
                </span>
                {isSistema && (
                  <span className="text-[9px] bg-[var(--run-bg)] text-[var(--run-text)] border border-[var(--run-border)] px-1.5 py-0.5 rounded-full font-semibold">
                    PBQP-H
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-faint)]">
                  · {servicos.length} serviço{servicos.length !== 1 ? 's' : ''}
                </span>
              </div>
              {servicos.map(s => (
                <ServicoCard
                  key={s.id}
                  servico={s}
                  onClonar={onClonar}
                  onEditar={onEditar}
                  onExcluir={onExcluir}
                  onToggleAtivo={onToggleAtivo}
                  onMoverItem={onMoverItem}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── ToggleGroup ─────────────────────────────────────────────────────────────

function ToggleGroup({
  label, options, value, onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const isActive = value !== options[0].value

  return (
    <div className="flex items-center gap-0">
      <span className={cn(
        'text-[10px] pr-1.5',
        isActive ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]',
      )}>
        {label}:
      </span>
      <div className="flex">
        {options.map((o, i) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 px-2.5 text-[11px] border-y border-r transition-colors',
              i === 0 && 'border-l rounded-l-sm',
              i === options.length - 1 && 'rounded-r-sm',
              value === o.value
                ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)] font-medium z-10 relative'
                : 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-faint)] hover:text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
