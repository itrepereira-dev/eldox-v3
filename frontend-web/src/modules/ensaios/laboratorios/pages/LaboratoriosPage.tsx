// frontend-web/src/modules/ensaios/laboratorios/pages/LaboratoriosPage.tsx
// Página de gestão de Laboratórios — SPEC 2

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Laboratorio } from '@/services/ensaios.service';
import {
  useListarLaboratorios,
  useCriarLaboratorio,
  useToggleLaboratorioAtivo,
} from '../hooks/useLaboratorios';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome:    z.string().min(1, 'Nome obrigatório').max(120, 'Máximo 120 caracteres'),
  cnpj:    z.string().max(18).optional().or(z.literal('')),
  contato: z.string().max(200).optional().or(z.literal('')),
  ativo:   z.boolean(),
});

type FormData = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

const LABEL_CLS = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

const ERROR_CLS = 'text-xs text-[var(--nc-text)] mt-1';

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  ativo,
  onToggle,
  isPending,
}: {
  ativo: boolean;
  onToggle: () => void;
  isPending: boolean;
}) {
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[200, 130, 180, 50].map((w, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded animate-pulse bg-[var(--bg-raised)]" style={{ width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mb-4">
        <Building2 size={28} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        Nenhum laboratório cadastrado
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Cadastre os laboratórios parceiros para vincular aos ensaios laboratoriais.
      </p>
      <button
        type="button"
        onClick={onNovo}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        Novo Laboratório
      </button>
    </div>
  );
}

// ── Formulário inline ─────────────────────────────────────────────────────────

function NovoLaboratorioForm({ onClose }: { onClose: () => void }) {
  const criar = useCriarLaboratorio();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', cnpj: '', contato: '', ativo: true },
  });

  const onSubmit = (data: FormData) => {
    criar.mutate(
      { nome: data.nome, cnpj: data.cnpj || undefined, contato: data.contato || undefined, ativo: data.ativo },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="border border-[var(--accent)] rounded-lg bg-[var(--bg-surface)] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-high)]">Novo Laboratório</h3>
        <button type="button" onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className={LABEL_CLS}>
            Nome <span className="text-[var(--nc-text)]">*</span>
          </label>
          <input {...register('nome')} placeholder="Laboratório ABC Ltda." className={INPUT_CLS} />
          {errors.nome && <p className={ERROR_CLS}>{errors.nome.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>CNPJ</label>
            <input {...register('cnpj')} placeholder="00.000.000/0001-00" className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Contato</label>
            <input {...register('contato')} placeholder="(11) 99999-0000 | email@lab.com" className={INPUT_CLS} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={criar.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {criar.isPending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando…
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Row de laboratório ────────────────────────────────────────────────────────

function LaboratorioRow({
  lab,
  index,
}: {
  lab: Laboratorio;
  index: number;
}) {
  const toggle = useToggleLaboratorioAtivo();

  return (
    <tr
      className={cn(
        'border-b border-[var(--border-dim)] last:border-0 transition-colors',
        index % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-surface)]',
        'hover:bg-[var(--bg-hover)]',
      )}
    >
      {/* Nome */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'font-medium text-sm',
            lab.ativo ? 'text-[var(--text-high)]' : 'text-[var(--text-faint)] line-through',
          )}
        >
          {lab.nome}
        </span>
      </td>

      {/* CNPJ */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-[var(--text-faint)]">{lab.cnpj ?? '—'}</span>
      </td>

      {/* Contato */}
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--text-faint)]">{lab.contato ?? '—'}</span>
      </td>

      {/* Toggle ativo */}
      <td className="px-4 py-3">
        <ToggleSwitch
          ativo={lab.ativo}
          onToggle={() => toggle.mutate(lab.id)}
          isPending={toggle.isPending}
        />
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function LaboratoriosPage() {
  const [formAberto, setFormAberto] = useState(false);
  const { data: laboratorios = [], isLoading, isError } = useListarLaboratorios();

  return (
    <div className="p-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
            Laboratórios
          </h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            Laboratórios parceiros vinculados aos ensaios
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormAberto(true)}
          disabled={formAberto}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
        >
          <Plus size={15} />
          Novo Laboratório
        </button>
      </div>

      {/* ── Formulário inline ─────────────────────────────────────────── */}
      {formAberto && (
        <NovoLaboratorioForm onClose={() => setFormAberto(false)} />
      )}

      {/* ── Contador ─────────────────────────────────────────────────── */}
      {!isLoading && laboratorios.length > 0 && (
        <p className="text-xs text-[var(--text-faint)] mb-2">
          {laboratorios.length} {laboratorios.length === 1 ? 'laboratório' : 'laboratórios'}
        </p>
      )}

      {/* ── Tabela ───────────────────────────────────────────────────── */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
        {isError ? (
          <div className="flex items-center justify-center py-12 text-center px-6">
            <div>
              <p className="text-sm text-[var(--nc-text)] font-medium">Erro ao carregar laboratórios</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Tente recarregar a página</p>
            </div>
          </div>
        ) : isLoading || laboratorios.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {['Nome', 'CNPJ', 'Contato', 'Ativo'].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : (
                laboratorios.map((lab, i) => (
                  <LaboratorioRow key={lab.id} lab={lab} index={i} />
                ))
              )}
            </tbody>
          </table>
        ) : (
          !formAberto && <EmptyState onNovo={() => setFormAberto(true)} />
        )}
      </div>
    </div>
  );
}
