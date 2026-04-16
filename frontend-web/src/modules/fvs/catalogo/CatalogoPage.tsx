// frontend-web/src/modules/fvs/catalogo/CatalogoPage.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { Upload, Sparkles } from 'lucide-react'
import { CategoriasList } from './components/CategoriasList'
import { ServicosPanel } from './components/ServicosPanel'
import { TodosServicosView } from './components/TodosServicosView'
import { ServicoModal } from './components/ServicoModal'
import { ImportarCsvModal } from './components/ImportarCsvModal'
import { GerarCatalogoIaModal } from './components/GerarCatalogoIaModal'
import {
  useCategorias, useServicos,
  useCreateServico, useUpdateServico, useDeleteServico, useClonarServico,
  useCreateCategoria, useUpdateCategoria, useReordenarCategorias, useReordenarItens,
} from './hooks/useCatalogo'
import { fvsService } from '@/services/fvs.service'
import type { FvsServico, CreateServicoPayload, GerarCatalogoIAServico } from '@/services/fvs.service'

export default function CatalogoPage() {
  const qc = useQueryClient()
  const [tab,           setTab]                 = useState<'todos' | 'categoria'>('todos')
  const [selectedCatId, setSelectedCatId]       = useState<number | null>(null)
  const [servicoEditando, setServicoEditando]   = useState<FvsServico | null | undefined>(undefined)
  // undefined = modal fechado, null = criação, FvsServico = edição
  const [importarOpen, setImportarOpen]         = useState(false)
  const [iaOpen,       setIaOpen]               = useState(false)
  const [iaLoading,    setIaLoading]            = useState(false)

  const { data: categorias = [], isLoading: loadingCats } = useCategorias()
  const { data: servicos   = [], isLoading: loadingSrv  } = useServicos(selectedCatId ?? undefined)

  const createServico        = useCreateServico()
  const updateServico        = useUpdateServico()
  const deleteServico        = useDeleteServico()
  const clonarServico        = useClonarServico()
  const createCategoria      = useCreateCategoria()
  const updateCategoria      = useUpdateCategoria()
  const reordenarCategorias  = useReordenarCategorias()
  const reordenarItens       = useReordenarItens()

  const selectedCat = categorias.find(c => c.id === selectedCatId) ?? null

  const handleSaveServico = (payload: CreateServicoPayload) => {
    if (servicoEditando !== null && servicoEditando !== undefined) {
      updateServico.mutate({ id: servicoEditando.id, ...payload })
    } else {
      createServico.mutate({ ...payload, categoriaId: payload.categoriaId ?? selectedCatId ?? undefined })
    }
    setServicoEditando(undefined)
  }

  // Importar serviços gerados pela IA: cria categorias e serviços sequencialmente
  const handleImportarIA = async (servicosIA: GerarCatalogoIAServico[]) => {
    setIaLoading(true)
    try {
      // Mapa: nome da categoria → id (cria se não existir)
      const catMap = new Map<string, number>()
      for (const cat of categorias) catMap.set(cat.nome.toLowerCase(), cat.id)

      for (const srv of servicosIA) {
        const catNome = srv.categoria?.trim() || 'Geral'
        let catId = catMap.get(catNome.toLowerCase())
        if (!catId) {
          const nova = await fvsService.createCategoria({ nome: catNome })
          catId = nova.id
          catMap.set(catNome.toLowerCase(), catId)
        }
        await fvsService.createServico({
          categoriaId:    catId,
          nome:           srv.nome,
          codigo:         srv.codigo || undefined,
          normaReferencia: srv.norma_referencia || undefined,
          itens: srv.itens.map((item, ordem) => ({
            descricao:    item.descricao,
            criterioAceite: item.criterio_aceite || undefined,
            criticidade:  item.criticidade,
            fotoModo:     item.foto_modo,
            ordem,
          })),
        })
      }

      qc.invalidateQueries({ queryKey: ['fvs-servicos'] })
      qc.invalidateQueries({ queryKey: ['fvs-categorias'] })
    } finally {
      setIaLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
        <div>
          <h1 className="text-[18px] font-semibold text-[var(--text-high)]">Catálogo de Serviços FVS</h1>
          <p className="text-[12px] text-[var(--text-faint)] mt-0.5">
            {categorias.length} categorias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIaOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px]',
              'border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors',
            )}
          >
            <Sparkles size={14} />
            Gerar com IA
          </button>
          <button
            onClick={() => setImportarOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px]',
              'border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors',
            )}
          >
            <Upload size={14} />
            Importar CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-dim)] flex-shrink-0 px-4">
        {([
          { key: 'todos',     label: 'Todos os Serviços' },
          { key: 'categoria', label: 'Por Categoria'     },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-mid)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {tab === 'todos' ? (
          <TodosServicosView
            categorias={categorias}
            onNovoServico={() => setServicoEditando(null)}
            onClonar={(id) => clonarServico.mutate(id)}
            onEditar={(s) => setServicoEditando(s)}
            onExcluir={(id) => {
              if (window.confirm('Excluir este serviço?')) deleteServico.mutate(id)
            }}
            onToggleAtivo={(id, ativo) => updateServico.mutate({ id, ativo })}
            onMoverItem={(servicoId, itens) => reordenarItens.mutate({ servicoId, payload: { itens } })}
          />
        ) : (
          <>
            {/* Left: categories */}
            <div className="w-56 flex-shrink-0">
              {loadingCats ? (
                <div className="p-4 text-[var(--text-faint)] text-sm">Carregando...</div>
              ) : (
                <CategoriasList
                  categorias={categorias}
                  selectedId={selectedCatId}
                  onSelect={setSelectedCatId}
                  onNovaCategoria={() => {
                    const nome = window.prompt('Nome da nova categoria:')
                    if (nome?.trim()) createCategoria.mutate({ nome: nome.trim() })
                  }}
                  onRenomear={(id, nome) => updateCategoria.mutate({ id, nome })}
                  onReordenar={(itens) => reordenarCategorias.mutate({ itens })}
                  onToggleAtivo={(id, ativo) => updateCategoria.mutate({ id, ativo })}
                />
              )}
            </div>
            {/* Right: services */}
            <ServicosPanel
              categoria={selectedCat}
              servicos={servicos}
              isLoading={loadingSrv}
              onNovoServico={() => setServicoEditando(null)}
              onClonar={(id) => clonarServico.mutate(id)}
              onEditar={(s) => setServicoEditando(s)}
              onExcluir={(id) => {
                if (window.confirm('Excluir este serviço?')) deleteServico.mutate(id)
              }}
              onToggleAtivo={(id, ativo) => updateServico.mutate({ id, ativo })}
              onMoverItem={(servicoId, itens) => reordenarItens.mutate({ servicoId, payload: { itens } })}
            />
          </>
        )}
      </div>

      {/* Modais */}
      <ServicoModal
        open={servicoEditando !== undefined}
        categorias={categorias}
        servico={servicoEditando ?? null}
        onSave={handleSaveServico}
        onClose={() => setServicoEditando(undefined)}
      />
      <ImportarCsvModal
        open={importarOpen}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['fvs-servicos'] })
          qc.invalidateQueries({ queryKey: ['fvs-categorias'] })
        }}
        onClose={() => setImportarOpen(false)}
      />
      <GerarCatalogoIaModal
        open={iaOpen}
        onImportar={handleImportarIA}
        onClose={() => setIaOpen(false)}
      />
      {iaLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)]">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-6 py-5 flex items-center gap-3 shadow-[var(--shadow-lg)]">
            <Sparkles size={16} className="text-[var(--accent)] animate-pulse" />
            <p className="text-[13px] text-[var(--text-high)]">Importando serviços gerados pela IA...</p>
          </div>
        </div>
      )}
    </div>
  )
}
