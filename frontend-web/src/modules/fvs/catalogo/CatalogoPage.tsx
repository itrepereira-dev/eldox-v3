// frontend-web/src/modules/fvs/catalogo/CatalogoPage.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { Upload } from 'lucide-react'
import { CategoriasList } from './components/CategoriasList'
import { ServicosPanel } from './components/ServicosPanel'
import { ServicoModal } from './components/ServicoModal'
import { ImportarCsvModal } from './components/ImportarCsvModal'
import {
  useCategorias, useServicos,
  useCreateServico, useUpdateServico, useDeleteServico, useClonarServico,
  useCreateCategoria,
} from './hooks/useCatalogo'
import type { FvsServico, CreateServicoPayload } from '@/services/fvs.service'

export default function CatalogoPage() {
  const qc = useQueryClient()
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [servicoEditando, setServicoEditando] = useState<FvsServico | null | undefined>(undefined)
  // undefined = modal fechado, null = criação, FvsServico = edição
  const [importarOpen, setImportarOpen] = useState(false)

  const { data: categorias = [], isLoading: loadingCats } = useCategorias()
  const { data: servicos = [], isLoading: loadingSrv } = useServicos(selectedCatId ?? undefined)

  const createServico   = useCreateServico()
  const updateServico   = useUpdateServico()
  const deleteServico   = useDeleteServico()
  const clonarServico   = useClonarServico()
  const createCategoria = useCreateCategoria()

  const selectedCat = categorias.find(c => c.id === selectedCatId) ?? null

  const handleSaveServico = (payload: CreateServicoPayload) => {
    if (servicoEditando !== null && servicoEditando !== undefined) {
      updateServico.mutate({ id: servicoEditando.id, ...payload })
    } else {
      createServico.mutate({ ...payload, categoriaId: payload.categoriaId ?? selectedCatId ?? undefined })
    }
    setServicoEditando(undefined)
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

      {/* Split layout */}
      <div className="flex flex-1 min-h-0">
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
        />
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
    </div>
  )
}
