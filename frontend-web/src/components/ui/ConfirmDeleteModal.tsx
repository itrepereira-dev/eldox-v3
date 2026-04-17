import { type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** Item-alvo da exclusão (ex.: "RDO nº 0042", "Concretagem C-001"). */
  target: string
  /** Título opcional — default "Excluir X?". */
  title?: string
  /** Mensagem adicional acima do aviso padrão. */
  description?: ReactNode
  /** Label do botão de confirmação (default "Excluir"). */
  confirmLabel?: string
  /** Bloqueia botões durante request. */
  loading?: boolean
  /** Mensagem de erro vinda da mutation, exibida inline. */
  error?: string | null
}

/**
 * Modal de confirmação padronizado para exclusões destrutivas.
 * Usa `Modal` base + `Button` variants (danger). Sempre mostra
 * "Esta ação não pode ser desfeita" como aviso fixo.
 *
 * Exemplo:
 *   <ConfirmDeleteModal
 *     open={!!target}
 *     target={`RDO nº ${target?.numero}`}
 *     onClose={() => setTarget(null)}
 *     onConfirm={() => mutExcluir.mutate(target!.id)}
 *     loading={mutExcluir.isPending}
 *     error={err}
 *   />
 */
export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  target,
  title,
  description,
  confirmLabel = 'Excluir',
  loading = false,
  error = null,
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => { /* noop while loading */ } : onClose}
      title={title ?? `Excluir ${target}?`}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="nc" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--nc)' }} />
        </div>
        <div className="flex-1 text-sm text-[var(--text-low)] leading-relaxed">
          {description && <p className="mb-2">{description}</p>}
          <p className="m-0">
            Esta ação <strong className="text-[var(--text-high)]">não pode ser desfeita</strong>.
            O registro e seus vínculos relacionados serão permanentemente removidos.
          </p>
        </div>
      </div>

      {error && (
        <p
          className="mt-4 text-sm rounded px-3 py-2"
          style={{
            color: 'var(--nc)',
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.3)',
          }}
        >
          {error}
        </p>
      )}
    </Modal>
  )
}
