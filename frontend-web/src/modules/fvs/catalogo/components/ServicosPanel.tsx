// frontend-web/src/modules/fvs/catalogo/components/ServicosPanel.tsx
import { cn } from '@/lib/cn'
import type { FvsCategoria, FvsServico } from '@/services/fvs.service'
import { ServicoCard } from './ServicoCard'
import { Plus, Loader2 } from 'lucide-react'

interface Props {
  categoria: FvsCategoria | null
  servicos: FvsServico[]
  isLoading: boolean
  onNovoServico: () => void
  onClonar: (id: number) => void
  onEditar: (servico: FvsServico) => void
  onExcluir: (id: number) => void
}

export function ServicosPanel({ categoria, servicos, isLoading, onNovoServico, onClonar, onEditar, onExcluir }: Props) {
  if (!categoria) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-faint)] text-sm">
        Selecione uma categoria
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dim)] flex-shrink-0">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text-high)]">{categoria.nome}</p>
          <p className="text-[11px] text-[var(--text-faint)]">{servicos.length} serviço{servicos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onNovoServico}
          className={cn(
            'flex items-center gap-1.5 px-3 h-8 rounded-sm text-[12px] font-semibold',
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors',
          )}
        >
          <Plus size={12} />
          Novo Serviço
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-faint)]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Carregando...
          </div>
        ) : servicos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-faint)]">
            <p className="text-sm mb-3">Nenhum serviço nesta categoria</p>
            <button onClick={onNovoServico} className="text-[var(--accent)] text-sm hover:underline">
              + Adicionar primeiro serviço
            </button>
          </div>
        ) : (
          <div>
            {servicos.map(s => (
              <ServicoCard
                key={s.id}
                servico={s}
                onClonar={onClonar}
                onEditar={onEditar}
                onExcluir={onExcluir}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
