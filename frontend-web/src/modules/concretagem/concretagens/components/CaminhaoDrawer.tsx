// frontend-web/src/modules/concretagem/concretagens/components/CaminhaoDrawer.tsx
import { X, Truck } from 'lucide-react';
import { CpTabela } from './CpTabela';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  caminhao_nf?: string;
  idade_dias: number;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  resistencia: number | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
}

interface CaminhaoInfo {
  id: number;
  numero: string;
  numero_nf: string | null;
  volume: number | null;
  hora_chegada: string | null;
  fornecedor_nome?: string;
  cps: CpItem[];
}

interface CaminhaoDrawerProps {
  caminhao: CaminhaoInfo;
  fck: number;
  onClose: () => void;
}

export function CaminhaoDrawer({ caminhao, fck, onClose }: CaminhaoDrawerProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] max-w-full bg-[var(--bg-base)] border-l border-[var(--border-dim)] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-high)]">{caminhao.numero}</h3>
              {caminhao.numero_nf && (
                <p className="text-xs text-[var(--text-faint)]">NF {caminhao.numero_nf}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-raised)] text-[var(--text-faint)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 py-4 border-b border-[var(--border-dim)] grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--text-faint)] mb-0.5">Volume</p>
            <p className="font-medium text-[var(--text-high)]">
              {caminhao.volume != null ? `${caminhao.volume} m³` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-faint)] mb-0.5">Chegada</p>
            <p className="font-medium text-[var(--text-high)]">
              {caminhao.hora_chegada
                ? new Date(caminhao.hora_chegada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </p>
          </div>
          {caminhao.fornecedor_nome && (
            <div className="col-span-2">
              <p className="text-xs text-[var(--text-faint)] mb-0.5">Fornecedor</p>
              <p className="font-medium text-[var(--text-high)]">{caminhao.fornecedor_nome}</p>
            </div>
          )}
        </div>

        {/* CPs */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h4 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">
            Corpos de Prova
          </h4>
          <CpTabela cps={caminhao.cps} fck={fck} />
        </div>
      </div>
    </>
  );
}
