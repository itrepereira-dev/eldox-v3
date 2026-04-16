import type { AprovacaoStatus } from '../../../services/aprovacoes.service';

interface StatusConfig {
  label: string;
  cor: string;
  bgCor: string;
  textCor: string;
  borderCor: string;
}

const STATUS_CONFIG: Record<AprovacaoStatus, StatusConfig> = {
  PENDENTE:     { label: 'Pendente',     cor: 'var(--warn)',  bgCor: 'var(--warn-bg)',  textCor: 'var(--warn-text)',  borderCor: 'var(--warn-border)' },
  EM_APROVACAO: { label: 'Em Aprovação', cor: 'var(--run)',   bgCor: 'var(--run-bg)',   textCor: 'var(--run-text)',   borderCor: 'var(--run-border)' },
  APROVADO:     { label: 'Aprovado',     cor: 'var(--ok)',    bgCor: 'var(--ok-bg)',    textCor: 'var(--ok-text)',    borderCor: 'var(--ok-border)' },
  REPROVADO:    { label: 'Reprovado',    cor: 'var(--nc)',    bgCor: 'var(--nc-bg)',    textCor: 'var(--nc-text)',    borderCor: 'var(--nc-border)' },
  CANCELADO:    { label: 'Cancelado',    cor: 'var(--off)',   bgCor: 'var(--off-bg)',   textCor: 'var(--off-text)',   borderCor: 'var(--off-border)' },
};

interface Props {
  status: AprovacaoStatus;
  size?: 'sm' | 'md';
}

export function AprovacaoStatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDENTE;
  const px = size === 'sm' ? '6px' : '10px';
  const py = size === 'sm' ? '2px' : '2px';
  const fontSize = size === 'sm' ? '10px' : '11px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: `${py} ${px}`,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 600,
        background: cfg.bgCor,
        color: cfg.textCor,
        border: `1px solid ${cfg.borderCor}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.cor,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

export { STATUS_CONFIG };
