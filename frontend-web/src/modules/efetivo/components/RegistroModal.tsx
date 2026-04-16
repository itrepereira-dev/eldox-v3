// frontend-web/src/modules/efetivo/components/RegistroModal.tsx
import { useState, useEffect } from 'react';
import type { TurnoEfetivo, EmpresaEfetivo, FuncaoEfetivo } from '../../../services/efetivo.service';
import { efetivoService } from '../../../services/efetivo.service';
import { useCreateRegistro } from '../hooks/useEfetivo';
import { useSugestaoIA } from '../hooks/useSugestaoIA';
import { SugestaoIABanner } from './SugestaoIABanner';
import { EquipeGrid, type LinhaEquipe } from './EquipeGrid';

interface Props {
  obraId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const today = new Date().toISOString().split('T')[0];

export function RegistroModal({ obraId, onClose, onSuccess }: Props) {
  const [data, setData] = useState(today);
  const [turno, setTurno] = useState<TurnoEfetivo>('INTEGRAL');
  const [linhas, setLinhas] = useState<LinhaEquipe[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaEfetivo[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoEfetivo[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const { create, isLoading: salvando } = useCreateRegistro(obraId);
  const { sugestao } = useSugestaoIA(obraId);

  useEffect(() => {
    Promise.all([efetivoService.getEmpresas(), efetivoService.getFuncoes()])
      .then(([emp, func]) => {
        setEmpresas(emp);
        setFuncoes(func);
      })
      .catch(() => {
        // catalogos nao bloqueantes
      })
      .finally(() => setLoadingCatalogos(false));
  }, []);

  function handleAplicarSugestao(itens: NonNullable<typeof sugestao>['itens']) {
    const mapeadas: LinhaEquipe[] = itens.map(it => ({
      empresaId: it.empresa_id,
      funcaoId: it.funcao_id,
      quantidade: it.quantidade,
    }));
    setLinhas(mapeadas);
  }

  async function handleSalvar() {
    setErroSalvar(null);
    if (!data) {
      setErroSalvar('Informe a data do registro.');
      return;
    }
    if (linhas.length === 0) {
      setErroSalvar('Adicione ao menos uma linha na grade de equipe.');
      return;
    }
    const linhasInvalidas = linhas.some(l => l.empresaId === 0 || l.funcaoId === 0);
    if (linhasInvalidas) {
      setErroSalvar('Selecione empresa e função em todas as linhas.');
      return;
    }

    try {
      await create({
        data,
        turno,
        itens: linhas.map(l => ({
          empresaId: l.empresaId,
          funcaoId: l.funcaoId,
          quantidade: l.quantidade,
          ...(l.observacao ? { observacao: l.observacao } : {}),
        })),
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar registro';
      setErroSalvar(msg);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-high)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div
        className="w-full rounded-xl shadow-lg flex flex-col"
        style={{
          maxWidth: '800px',
          maxHeight: '90vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-dim)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-high)' }}>
            Novo Registro de Efetivo
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-lg transition-all"
            style={{ color: 'var(--text-faint)', background: 'none', border: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Data + Turno */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>
                Turno
              </label>
              <select
                value={turno}
                onChange={e => setTurno(e.target.value as TurnoEfetivo)}
                style={inputStyle}
              >
                <option value="INTEGRAL">Integral</option>
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
                <option value="NOITE">Noite</option>
              </select>
            </div>
          </div>

          {/* Sugestão IA */}
          {sugestao && (
            <SugestaoIABanner
              sugestao={sugestao}
              onAplicar={handleAplicarSugestao}
            />
          )}

          {/* Grade de equipe */}
          <div className="mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
              Grade de Equipe
            </div>
            {loadingCatalogos ? (
              <div className="text-[13px] py-4" style={{ color: 'var(--text-low)' }}>
                Carregando empresas e funções...
              </div>
            ) : (
              <EquipeGrid
                linhas={linhas}
                empresas={empresas}
                funcoes={funcoes}
                onChange={setLinhas}
              />
            )}
          </div>

          {/* Erro salvar */}
          {erroSalvar && (
            <div
              className="mt-4 rounded-lg px-4 py-2.5 text-[13px]"
              style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn-text)' }}
            >
              {erroSalvar}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-dim)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-mid)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{
              background: salvando ? 'var(--accent-dim)' : 'var(--accent)',
              color: '#fff',
            }}
            onMouseEnter={e => { if (!salvando) e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={e => { if (!salvando) e.currentTarget.style.background = 'var(--accent)'; }}
          >
            {salvando ? 'Salvando...' : 'Salvar Registro'}
          </button>
        </div>
      </div>
    </div>
  );
}
