// frontend-web/src/modules/ensaios/tipos/components/TipoEnsaioRow.tsx
// Linha da tabela de Tipos de Ensaio com toggle e ações

import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TipoEnsaio, MaterialTipo } from '@/services/ensaios.service';
import { useToggleAtivo, useDeletarTipo } from '../hooks/useTiposEnsaio';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MATERIAL_LABEL: Record<MaterialTipo, string> = {
  bloco_concreto: 'Bloco',
  concreto:       'Concreto',
  argamassa:      'Argamassa',
  aco:            'Aço',
  ceramica:       'Cerâmica',
  outro:          'Outro',
};

const MATERIAL_CLS: Record<MaterialTipo, string> = {
  bloco_concreto: 'bg-blue-500/10 text-blue-400 border border-blue-500/25',
  concreto:       'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
  argamassa:      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25',
  aco:            'bg-purple-500/10 text-purple-400 border border-purple-500/25',
  ceramica:       'bg-orange-500/10 text-orange-400 border border-orange-500/25',
  outro:          'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

function ReferenciaBadge({ tipo }: { tipo: TipoEnsaio }) {
  const { valor_ref_min: min, valor_ref_max: max, unidade } = tipo;

  if (min !== null && max !== null) {
    return (
      <span className="font-mono text-xs text-[var(--text-high)]">
        {min.toLocaleString('pt-BR')} – {max.toLocaleString('pt-BR')}{' '}
        <span className="text-[var(--text-faint)]">{unidade}</span>
      </span>
    );
  }
  if (min !== null) {
    return (
      <span className="font-mono text-xs text-[var(--text-high)]">
        ≥ {min.toLocaleString('pt-BR')}{' '}
        <span className="text-[var(--text-faint)]">{unidade}</span>
      </span>
    );
  }
  if (max !== null) {
    return (
      <span className="font-mono text-xs text-[var(--text-high)]">
        ≤ {max.toLocaleString('pt-BR')}{' '}
        <span className="text-[var(--text-faint)]">{unidade}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]">
      Aprovação Manual
    </span>
  );
}

function FrequenciaCell({ tipo }: { tipo: TipoEnsaio }) {
  if (!tipo.frequencia_valor || !tipo.frequencia_unidade) {
    return <span className="text-[var(--text-faint)]">—</span>;
  }
  const labelUnidade: Record<string, string> = { dias: 'dias', m3: 'm³', lotes: 'lotes' };
  return (
    <span className="text-xs text-[var(--text-high)]">
      {tipo.frequencia_valor} {labelUnidade[tipo.frequencia_unidade]}
    </span>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ ativo, onToggle, isPending }: { ativo: boolean; onToggle: () => void; isPending: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={onToggle}
      disabled={isPending}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60',
        ativo ? 'bg-[var(--ok)]' : 'bg-[var(--border)]',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          ativo ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  tipo: TipoEnsaio;
  index: number;
  onEditar: (tipo: TipoEnsaio) => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TipoEnsaioRow({ tipo, index, onEditar }: Props) {
  const toggle = useToggleAtivo(tipo.id);
  const deletar = useDeletarTipo();

  const handleDeletar = () => {
    if (window.confirm(`Excluir o tipo "${tipo.nome}"? Esta ação não pode ser desfeita.`)) {
      deletar.mutate(tipo.id);
    }
  };

  return (
    <tr
      className={cn(
        'border-b border-[var(--border-dim)] last:border-0 transition-colors',
        index % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-surface)]',
        'hover:bg-[var(--bg-hover)]',
      )}
    >
      {/* Nome + badge material */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              'font-medium text-sm',
              tipo.ativo ? 'text-[var(--text-high)]' : 'text-[var(--text-faint)] line-through',
            )}
          >
            {tipo.nome}
          </span>
          {tipo.material_tipo && (
            <span
              className={cn(
                'inline-flex w-fit text-[10px] font-medium px-1.5 py-0.5 rounded',
                MATERIAL_CLS[tipo.material_tipo],
              )}
            >
              {MATERIAL_LABEL[tipo.material_tipo]}
            </span>
          )}
        </div>
      </td>

      {/* Unidade */}
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-[var(--text-high)]">{tipo.unidade}</span>
      </td>

      {/* Referência NBR */}
      <td className="px-4 py-3">
        <ReferenciaBadge tipo={tipo} />
      </td>

      {/* Norma */}
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--text-faint)]">{tipo.norma_tecnica ?? '—'}</span>
      </td>

      {/* Frequência */}
      <td className="px-4 py-3">
        <FrequenciaCell tipo={tipo} />
      </td>

      {/* Status toggle */}
      <td className="px-4 py-3">
        <ToggleSwitch
          ativo={tipo.ativo}
          onToggle={() => toggle.mutate()}
          isPending={toggle.isPending}
        />
      </td>

      {/* Ações */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEditar(tipo)}
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
            aria-label="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={handleDeletar}
            disabled={deletar.isPending}
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors disabled:opacity-50"
            aria-label="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
