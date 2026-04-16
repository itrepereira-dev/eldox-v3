// frontend-web/src/modules/efetivo/components/RdoVinculacaoChip.tsx

interface Props {
  rdoId:    number | null;
  isLoading?: boolean;
}

export function RdoVinculacaoChip({ rdoId, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-dim)',
        color: 'var(--text-faint)',
      }}>
        <span>📋</span>
        <span>Verificando RDO do dia...</span>
      </div>
    );
  }

  if (!rdoId) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-dim)',
        color: 'var(--text-faint)',
      }}>
        <span>📋</span>
        <span>Nenhum RDO encontrado para esta data — registro salvo sem vinculação</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{
      background: 'var(--accent-dim)',
      border: '1px solid rgba(47,129,247,.3)',
    }}>
      <span className="text-lg">📋</span>
      <div className="flex-1">
        <strong className="text-[13px] block" style={{ color: 'var(--accent)' }}>
          RDO #{rdoId} encontrado
        </strong>
        <span className="text-[11px]" style={{ color: 'var(--text-mid)' }}>
          Este registro será vinculado automaticamente ao Diário de Obra do dia
        </span>
      </div>
      <span className="text-base" style={{ color: 'var(--ok)' }}>✓</span>
    </div>
  );
}
