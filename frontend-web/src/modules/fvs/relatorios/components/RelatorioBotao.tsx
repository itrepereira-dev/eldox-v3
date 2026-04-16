// frontend-web/src/modules/fvs/relatorios/components/RelatorioBotao.tsx
import { useState } from 'react';
import { FileDown, Loader2, ChevronDown } from 'lucide-react';
import { useRelatorioFvs } from '../hooks/useRelatorioFvs';
import { FiltrosModal } from './FiltrosModal';
import type { RelatorioBotaoProps, ReportFiltros, ReportFormato } from '../types';
import { cn } from '@/lib/cn';

// Fields that must be present before generation can proceed without a modal
const REQUIRED_NO_MODAL: Record<string, (keyof ReportFiltros)[]> = {
  R1_FICHA: ['fichaId'],
  R2_CONFORMIDADE: ['obraId', 'dataInicio', 'dataFim'],
  R3_PENDENCIAS: ['obraId', 'dataInicio'],
  R4_NCS: ['obraId'],
  R5_PA: ['obraId'],
};

export function RelatorioBotao({
  tipo,
  filtros,
  formatos = ['pdf'],
  label,
}: RelatorioBotaoProps) {
  const { loading, error, triggerDownload } = useRelatorioFvs();
  const [showModal, setShowModal] = useState(false);
  const [pendingFormato, setPendingFormato] = useState<ReportFormato>('pdf');
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  function filtrosCompletos(f: ReportFiltros): boolean {
    const required = REQUIRED_NO_MODAL[tipo] ?? [];
    return required.every((field) => !!f[field]);
  }

  async function handleClick(formato: ReportFormato) {
    setShowFormatMenu(false);
    if (!filtrosCompletos(filtros)) {
      setPendingFormato(formato);
      setShowModal(true);
      return;
    }
    await triggerDownload(tipo, filtros, formato);
  }

  async function handleModalConfirm(filtrosCompletos: ReportFiltros) {
    setShowModal(false);
    await triggerDownload(tipo, filtrosCompletos, pendingFormato);
  }

  const btnLabel = label ?? (formatos.length > 1 ? 'Exportar' : formatos[0] === 'excel' ? 'Exportar Excel' : 'Exportar PDF');

  return (
    <>
      {showModal && (
        <FiltrosModal
          tipo={tipo}
          filtrosIniciais={filtros}
          onConfirm={handleModalConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="relative inline-flex">
        {formatos.length === 1 ? (
          <button
            onClick={() => handleClick(formatos[0])}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors font-medium',
              'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
              loading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {btnLabel}
          </button>
        ) : (
          <>
            <button
              onClick={() => handleClick('pdf')}
              disabled={loading}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-l border-y border-l transition-colors font-medium',
                'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              PDF
            </button>
            <button
              onClick={() => setShowFormatMenu((v) => !v)}
              disabled={loading}
              className={cn(
                'inline-flex items-center px-1.5 py-1.5 text-sm rounded-r border transition-colors',
                'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              <ChevronDown size={12} />
            </button>
            {showFormatMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--bg-base)] border border-[var(--border-dim)] rounded shadow-lg z-20 min-w-[120px]">
                <button
                  onClick={() => handleClick('pdf')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Exportar PDF
                </button>
                <button
                  onClick={() => handleClick('excel')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Exportar Excel
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </>
  );
}
