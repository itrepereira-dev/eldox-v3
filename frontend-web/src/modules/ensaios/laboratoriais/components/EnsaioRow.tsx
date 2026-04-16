// frontend-web/src/modules/ensaios/laboratoriais/components/EnsaioRow.tsx
// Linha da tabela de Ensaios Laboratoriais — SPEC 2

import { Eye } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EnsaioLaboratorial, ResultadoEnsaio } from '@/services/ensaios.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatarData(iso: string): string {
  const d = new Date(iso);
  // Usar UTC para evitar offset de fuso horário
  const dia  = String(d.getUTCDate()).padStart(2, '0');
  const mes  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano  = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

// ── Próximo Cupom Badge ───────────────────────────────────────────────────────

function ProximoCupomBadge({ dias }: { dias: number | null | undefined }) {
  if (dias === null || dias === undefined) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]">
        Sem data
      </span>
    );
  }

  if (dias < 7) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]">
        {dias}d
      </span>
    );
  }

  if (dias <= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]">
        {dias}d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]">
      {dias}d
    </span>
  );
}

// ── Aprovado Auto Chip ────────────────────────────────────────────────────────

function AprovadoAutoChip({ resultados }: { resultados?: ResultadoEnsaio[] }) {
  if (!resultados || resultados.length === 0) {
    return <span className="text-[var(--text-faint)] text-xs">—</span>;
  }

  const temNull = resultados.some((r) => r.aprovado_auto === null);
  if (temNull) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]">
        Manual
      </span>
    );
  }

  const todosOk = resultados.every((r) => r.aprovado_auto === true);
  if (todosOk) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]">
        Auto OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]">
      Auto NOK
    </span>
  );
}

// ── Tipos Badges ──────────────────────────────────────────────────────────────

function TiposBadges({ resultados }: { resultados?: ResultadoEnsaio[] }) {
  if (!resultados || resultados.length === 0) {
    return <span className="text-[var(--text-faint)] text-xs">—</span>;
  }

  const MAX_SHOW = 3;
  const visible = resultados.slice(0, MAX_SHOW);
  const resto = resultados.length - MAX_SHOW;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)] whitespace-nowrap"
        >
          {r.tipo_nome ?? `#${r.ensaio_tipo_id}`}
        </span>
      ))}
      {resto > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-raised)] text-[var(--accent)] border border-[var(--border-dim)]">
          +{resto}
        </span>
      )}
    </div>
  );
}

// ── Revisão Badge ─────────────────────────────────────────────────────────────

function RevisaoBadge({
  situacao,
}: {
  situacao?: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
}) {
  if (!situacao) {
    return <span className="text-[var(--text-faint)] text-xs">—</span>;
  }

  const cls = {
    PENDENTE:  'bg-[var(--warn-bg)] text-[var(--warn-text)] border-[var(--warn-border)]',
    APROVADO:  'bg-[var(--ok-bg)] text-[var(--ok-text)] border-[var(--ok-border)]',
    REPROVADO: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border-[var(--nc-border)]',
  }[situacao];

  const label = {
    PENDENTE:  'Pendente',
    APROVADO:  'Aprovado',
    REPROVADO: 'Reprovado',
  }[situacao];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border',
        cls,
      )}
    >
      {label}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  ensaio: EnsaioLaboratorial;
  index: number;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EnsaioRow({ ensaio, index }: Props) {
  return (
    <tr
      className={cn(
        'border-b border-[var(--border-dim)] last:border-0 transition-colors',
        index % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-surface)]',
        'hover:bg-[var(--bg-hover)]',
      )}
    >
      {/* Data Ensaio */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-sm text-[var(--text-high)]">
          {formatarData(ensaio.data_ensaio)}
        </span>
      </td>

      {/* Laboratório */}
      <td className="px-4 py-3">
        <span className="text-sm text-[var(--text-high)]">
          {ensaio.laboratorio_nome ?? `Lab #${ensaio.laboratorio_id}`}
        </span>
      </td>

      {/* Tipos ensaiados */}
      <td className="px-4 py-3">
        <TiposBadges resultados={ensaio.resultados} />
      </td>

      {/* Resultados (aprovado_auto) */}
      <td className="px-4 py-3">
        <AprovadoAutoChip resultados={ensaio.resultados} />
      </td>

      {/* Próximo Cupom */}
      <td className="px-4 py-3">
        <ProximoCupomBadge dias={ensaio.dias_para_proximo_cupom} />
      </td>

      {/* Revisão */}
      <td className="px-4 py-3">
        <RevisaoBadge situacao={ensaio.revisao?.situacao} />
      </td>

      {/* Ações */}
      <td className="px-4 py-3">
        <button
          type="button"
          title="Ver detalhes"
          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-[var(--text-faint)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
        >
          <Eye size={13} />
          Ver detalhes
        </button>
      </td>
    </tr>
  );
}
