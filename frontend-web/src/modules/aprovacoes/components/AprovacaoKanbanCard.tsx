import { useNavigate } from 'react-router-dom';
import { Clock, Building, User, ArrowRight, AlertTriangle } from 'lucide-react';
import type { AprovacaoInstancia, AprovacaoModulo } from '../../../services/aprovacoes.service';

const MODULO_LABEL: Record<AprovacaoModulo, string> = {
  FVS:          'FVS',
  FVM:          'FVM',
  RDO:          'RDO',
  NC:           'NC',
  GED:          'GED',
  ENSAIO:       'Ensaio',
  CONCRETAGEM:  'Concretagem',
  ALMOXARIFADO: 'Almoxarifado',
};

function tempoRelativo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function prazoInfo(prazoStr: string): { texto: string; alerta: boolean } {
  const diff = new Date(prazoStr).getTime() - Date.now();
  const h = diff / 3_600_000;
  if (h < 0) return { texto: 'Prazo vencido', alerta: true };
  if (h < 24) return { texto: `Vence em ${Math.round(h)}h`, alerta: true };
  const d = Math.floor(h / 24);
  return { texto: `Vence em ${d}d`, alerta: false };
}

interface Props {
  item: AprovacaoInstancia;
}

export function AprovacaoKanbanCard({ item }: Props) {
  const navigate = useNavigate();
  const prazo = item.prazo ? prazoInfo(item.prazo) : null;

  return (
    <div
      className="rounded-lg border border-[var(--border-dim)] p-3 cursor-pointer transition-shadow hover:shadow-md bg-[var(--bg-raised)]"
      onClick={() => navigate(`/aprovacoes/${item.id}`)}
    >
      {/* Header: badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide"
          style={{
            background: 'var(--accent-dim, rgba(240,136,62,.12))',
            color: 'var(--accent)',
          }}
        >
          {MODULO_LABEL[item.modulo] ?? item.modulo}
        </span>
        {item.template?.etapas && item.etapaAtual != null && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--run-bg)',
              color: 'var(--run-text)',
              border: '1px solid var(--run-border)',
            }}
          >
            Etapa {item.etapaAtual}
          </span>
        )}
      </div>

      {/* Título */}
      <p className="text-sm font-semibold text-[var(--text-high)] leading-snug line-clamp-2 mb-2">
        {item.titulo}
      </p>

      {/* Obra */}
      {item.obra && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-faint)] mb-1">
          <Building size={10} className="flex-shrink-0" />
          <span className="truncate">{item.obra.nome}</span>
        </div>
      )}

      {/* Solicitante + data */}
      <div className="flex items-center gap-1 text-xs text-[var(--text-faint)] mb-1">
        <User size={10} className="flex-shrink-0" />
        <span className="truncate">{item.solicitante?.nome ?? '—'}</span>
        <span className="text-[var(--border-dim)] mx-0.5">·</span>
        <Clock size={10} className="flex-shrink-0" />
        <span>{tempoRelativo(item.criadoEm)}</span>
      </div>

      {/* Prazo */}
      {prazo && (
        <div
          className="flex items-center gap-1 text-[11px] font-semibold mt-1.5"
          style={{ color: prazo.alerta ? 'var(--warn)' : 'var(--text-faint)' }}
        >
          {prazo.alerta && <AlertTriangle size={11} className="flex-shrink-0" />}
          {prazo.texto}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end mt-2.5 pt-2 border-t border-[var(--border-dim)]">
        <button
          onClick={e => { e.stopPropagation(); navigate(`/aprovacoes/${item.id}`); }}
          className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          Ver detalhes
          <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}
