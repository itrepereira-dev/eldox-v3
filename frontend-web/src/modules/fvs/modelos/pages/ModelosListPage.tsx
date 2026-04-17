// frontend-web/src/modules/fvs/modelos/pages/ModelosListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useModelos, useDeleteModelo, useConcluirModelo,
  useReabrirModelo, useDuplicarModelo,
} from '../hooks/useModelos';
import type { FvsModelo } from '../../../../services/fvs.service';
import { VincularObraModal } from '../components/VincularObraModal';
import { cn } from '@/lib/cn';
import { Plus, Building2 } from 'lucide-react';
import { SkeletonList } from '@/components/ui';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho:  { label: 'Rascunho',  cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  concluido: { label: 'Concluído', cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
};

const REGIME_LABEL: Record<string, string> = {
  livre:  'Inspeção Interna',
  pbqph:  'PBQP-H',
};

export function ModelosListPage() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>(undefined);
  const { data: modelos = [], isLoading } = useModelos({ status: filtroStatus });
  const deletar  = useDeleteModelo();
  const concluir = useConcluirModelo();
  const reabrir  = useReabrirModelo();
  const duplicar = useDuplicarModelo();
  const [erro, setErro] = useState('');

  // Modal de vincular obra
  const [modeloObra, setModeloObra] = useState<FvsModelo | null>(null);

  async function handleAcao(acao: 'concluir' | 'reabrir' | 'duplicar' | 'excluir', modelo: FvsModelo) {
    setErro('');
    try {
      if (acao === 'excluir') {
        if (!confirm(`Excluir template "${modelo.nome}"?`)) return;
        await deletar.mutateAsync(modelo.id);
      } else if (acao === 'concluir') {
        await concluir.mutateAsync(modelo.id);
      } else if (acao === 'reabrir') {
        await reabrir.mutateAsync(modelo.id);
      } else if (acao === 'duplicar') {
        const novo = await duplicar.mutateAsync(modelo.id);
        navigate(`/fvs/modelos/${novo.id}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? `Erro ao ${acao} template`);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <SkeletonList rows={5} cols={3} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Templates de Inspeção</h1>
        <div className="flex items-center gap-3">
          <select
            value={filtroStatus ?? ''}
            onChange={e => setFiltroStatus(e.target.value || undefined)}
            className="text-sm px-3 py-1.5 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-mid)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="concluido">Concluído</option>
          </select>
          <button
            onClick={() => navigate('/fvs/modelos/novo')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Novo Template
          </button>
        </div>
      </div>

      {erro && (
        <p className="text-sm text-[var(--nc-text)] mb-4 px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)]">
          {erro}
        </p>
      )}

      {modelos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--text-faint)] text-sm">Nenhum template encontrado. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {['Nome', 'Regime', 'Escopo', 'Status', 'Bloqueado', 'Versão', ''].map(col => (
                  <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelos.map((m, i) => {
                const st = STATUS_LABEL[m.status] ?? { label: m.status, cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)]' };
                return (
                  <tr
                    key={m.id}
                    className={cn(
                      'border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors',
                      i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                    )}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/fvs/modelos/${m.id}`)}
                          className="text-[var(--accent)] hover:underline text-left"
                        >
                          {m.nome}
                        </button>
                        {m.is_sistema && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wide">
                            Sistema
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-mid)]">{REGIME_LABEL[m.regime] ?? m.regime}</td>
                    <td className="px-4 py-3 text-[var(--text-mid)] capitalize">{m.escopo}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', st.cls)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold', m.bloqueado ? 'text-[var(--nc-text)]' : 'text-[var(--ok-text)]')}>
                        {m.bloqueado ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-faint)]">v{m.versao}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!m.is_sistema && m.status === 'rascunho' && !m.bloqueado && (
                          <button
                            onClick={() => handleAcao('concluir', m)}
                            className="text-xs px-2.5 py-1 rounded border border-[var(--ok-border)] text-[var(--ok-text)] hover:bg-[var(--ok-bg)] transition-colors"
                          >
                            Concluir
                          </button>
                        )}
                        {/* Botão Obra — antes de Reabrir */}
                        <button
                          onClick={() => setModeloObra(m)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <Building2 size={11} /> Obra
                          {(m.obras_count ?? 0) > 0 && (
                            <span className="bg-[var(--accent)] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                              {m.obras_count}
                            </span>
                          )}
                        </button>
                        {!m.is_sistema && m.status === 'concluido' && !m.bloqueado && (
                          <button
                            onClick={() => handleAcao('reabrir', m)}
                            className="text-xs px-2.5 py-1 rounded border border-[var(--warn-border)] text-[var(--warn-text)] hover:bg-[var(--warn-bg)] transition-colors"
                          >
                            Reabrir
                          </button>
                        )}
                        <button
                          onClick={() => handleAcao('duplicar', m)}
                          className="text-xs px-2.5 py-1 rounded border border-[var(--border-dim)] text-[var(--text-faint)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          Duplicar
                        </button>
                        {!m.is_sistema && !m.bloqueado && (
                          <button
                            onClick={() => handleAcao('excluir', m)}
                            className="text-xs px-2.5 py-1 rounded border border-[var(--nc-border)] text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de vincular obra */}
      {modeloObra && (
        <VincularObraModal
          modeloId={modeloObra.id}
          modeloNome={modeloObra.nome}
          onClose={() => setModeloObra(null)}
        />
      )}
    </div>
  );
}
