// frontend-web/src/modules/fvs/relatorios/components/FiltrosModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import type { ReportFiltros, ReportTipo } from '../types';

interface FiltrosModalProps {
  tipo: ReportTipo;
  filtrosIniciais: ReportFiltros;
  onConfirm: (filtros: ReportFiltros) => void;
  onCancel: () => void;
}

// Which fields are required per report type
const REQUIRED: Record<ReportTipo, (keyof ReportFiltros)[]> = {
  R1_FICHA: ['fichaId'],
  R2_CONFORMIDADE: ['obraId', 'dataInicio', 'dataFim'],
  R3_PENDENCIAS: ['obraId', 'dataInicio'],
  R4_NCS: ['obraId'],
  R5_PA: ['obraId'],
  R6_USO: ['obraId', 'dataInicio', 'dataFim'],
};

export function FiltrosModal({ tipo, filtrosIniciais, onConfirm, onCancel }: FiltrosModalProps) {
  const [filtros, setFiltros] = useState<ReportFiltros>(filtrosIniciais);
  const [touched, setTouched] = useState<Partial<Record<keyof ReportFiltros, boolean>>>({});

  const required = REQUIRED[tipo];
  const missingFields = required.filter((field) => !filtros[field]);

  function handleSubmit() {
    const newTouched: Partial<Record<keyof ReportFiltros, boolean>> = {};
    required.forEach((f) => { newTouched[f] = true; });
    setTouched(newTouched);
    if (missingFields.length > 0) return;
    onConfirm(filtros);
  }

  function field(name: keyof ReportFiltros, label: string, type: string = 'text') {
    const isRequired = required.includes(name);
    const hasError = touched[name] && !filtros[name];
    return (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--text-mid)]">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <input
          type={type}
          value={(filtros[name] as string | number | undefined) ?? ''}
          onChange={(e) =>
            setFiltros((prev) => ({ ...prev, [name]: e.target.value || undefined }))
          }
          onBlur={() => setTouched((prev) => ({ ...prev, [name]: true }))}
          className={`px-3 py-2 rounded border text-sm bg-[var(--bg-base)] text-[var(--text-main)] outline-none transition-colors focus:ring-2 focus:ring-[var(--accent)] ${
            hasError
              ? 'border-red-500 bg-red-50'
              : 'border-[var(--border-dim)]'
          }`}
        />
        {hasError && (
          <span className="text-xs text-red-500">Campo obrigatório</span>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--bg-base)] rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-main)]">Parâmetros do Relatório</h2>
          <button onClick={onCancel} className="text-[var(--text-faint)] hover:text-[var(--text-main)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {required.includes('dataInicio') && field('dataInicio', 'Data início', 'date')}
          {required.includes('dataFim') && field('dataFim', 'Data fim', 'date')}
          {required.includes('servicoId') && field('servicoId', 'ID do Serviço', 'number')}
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-medium"
          >
            Gerar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
