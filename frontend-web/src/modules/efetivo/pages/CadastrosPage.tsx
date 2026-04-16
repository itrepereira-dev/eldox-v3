// frontend-web/src/modules/efetivo/pages/CadastrosPage.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  efetivoService,
  type EmpresaEfetivo,
  type FuncaoEfetivo,
  type TipoEmpresa,
} from '../../../services/efetivo.service';

type Tab = 'empresas' | 'funcoes';

const TIPO_LABELS: Record<TipoEmpresa, string> = {
  PROPRIA: 'Própria',
  SUBCONTRATADA: 'Subcontratada',
};

export function CadastrosEfetivoPage() {
  const [tab, setTab] = useState<Tab>('empresas');

  // ── Empresas state ──────────────────────────────────────────────────────────
  const [empresas, setEmpresas] = useState<EmpresaEfetivo[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [showFormEmpresa, setShowFormEmpresa] = useState(false);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaTipo, setNovaEmpresaTipo] = useState<TipoEmpresa>('PROPRIA');
  const [novaEmpresaCnpj, setNovaEmpresaCnpj] = useState('');
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [erroEmpresa, setErroEmpresa] = useState<string | null>(null);

  // ── Funções state ───────────────────────────────────────────────────────────
  const [funcoes, setFuncoes] = useState<FuncaoEfetivo[]>([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(false);
  const [showFormFuncao, setShowFormFuncao] = useState(false);
  const [novaFuncaoNome, setNovaFuncaoNome] = useState('');
  const [salvandoFuncao, setSalvandoFuncao] = useState(false);
  const [erroFuncao, setErroFuncao] = useState<string | null>(null);

  const fetchEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      setEmpresas(await efetivoService.getEmpresas());
    } catch { /* silent */ } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  const fetchFuncoes = useCallback(async () => {
    setLoadingFuncoes(true);
    try {
      setFuncoes(await efetivoService.getFuncoes());
    } catch { /* silent */ } finally {
      setLoadingFuncoes(false);
    }
  }, []);

  useEffect(() => { fetchEmpresas(); fetchFuncoes(); }, [fetchEmpresas, fetchFuncoes]);

  // ── Empresas actions ────────────────────────────────────────────────────────
  async function handleCriarEmpresa() {
    if (!novaEmpresaNome.trim()) { setErroEmpresa('Informe o nome da empresa.'); return; }
    setSalvandoEmpresa(true);
    setErroEmpresa(null);
    try {
      await efetivoService.createEmpresa({
        nome: novaEmpresaNome.trim(),
        tipo: novaEmpresaTipo,
        ...(novaEmpresaCnpj.trim() ? { cnpj: novaEmpresaCnpj.trim() } : {}),
      });
      setNovaEmpresaNome('');
      setNovaEmpresaCnpj('');
      setNovaEmpresaTipo('PROPRIA');
      setShowFormEmpresa(false);
      fetchEmpresas();
    } catch {
      setErroEmpresa('Erro ao criar empresa.');
    } finally {
      setSalvandoEmpresa(false);
    }
  }

  async function handleToggleEmpresa(emp: EmpresaEfetivo) {
    try {
      const updated = await efetivoService.updateEmpresa(emp.id, { ativa: !emp.ativa });
      setEmpresas(prev => prev.map(e => e.id === emp.id ? updated : e));
    } catch { /* silent */ }
  }

  // ── Funções actions ─────────────────────────────────────────────────────────
  async function handleCriarFuncao() {
    if (!novaFuncaoNome.trim()) { setErroFuncao('Informe o nome da função.'); return; }
    setSalvandoFuncao(true);
    setErroFuncao(null);
    try {
      await efetivoService.createFuncao({ nome: novaFuncaoNome.trim() });
      setNovaFuncaoNome('');
      setShowFormFuncao(false);
      fetchFuncoes();
    } catch {
      setErroFuncao('Erro ao criar função.');
    } finally {
      setSalvandoFuncao(false);
    }
  }

  async function handleToggleFuncao(func: FuncaoEfetivo) {
    try {
      const updated = await efetivoService.updateFuncao(func.id, { ativa: !func.ativa });
      setFuncoes(prev => prev.map(f => f.id === func.id ? updated : f));
    } catch { /* silent */ }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-high)',
    borderRadius: '8px',
    padding: '7px 12px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'inherit',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--bg-raised)',
    color: active ? '#fff' : 'var(--text-mid)',
    cursor: 'pointer',
    transition: 'all .15s',
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-high)' }}>
            Cadastros — Efetivo
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-low)' }}>
            Gerencie empresas e funções utilizadas nos registros de efetivo
          </p>
        </div>
        <div className="flex gap-2">
          <button style={tabBtnStyle(tab === 'empresas')} onClick={() => setTab('empresas')}>
            Empresas
          </button>
          <button style={tabBtnStyle(tab === 'funcoes')} onClick={() => setTab('funcoes')}>
            Funções
          </button>
        </div>
      </div>

      {/* ─── Tab: Empresas ─────────────────────────────────────────────────────── */}
      {tab === 'empresas' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
              {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => { setShowFormEmpresa(s => !s); setErroEmpresa(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {showFormEmpresa ? 'Cancelar' : '+ Nova Empresa'}
            </button>
          </div>

          {/* Inline form */}
          {showFormEmpresa && (
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
                    Nome *
                  </label>
                  <input
                    style={{ ...inputStyle, width: '100%' }}
                    placeholder="Nome da empresa"
                    value={novaEmpresaNome}
                    onChange={e => setNovaEmpresaNome(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
                    Tipo
                  </label>
                  <select
                    style={{ ...inputStyle, width: '100%' }}
                    value={novaEmpresaTipo}
                    onChange={e => setNovaEmpresaTipo(e.target.value as TipoEmpresa)}
                  >
                    <option value="PROPRIA">Própria</option>
                    <option value="SUBCONTRATADA">Subcontratada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
                    CNPJ
                  </label>
                  <input
                    style={{ ...inputStyle, width: '100%' }}
                    placeholder="00.000.000/0000-00"
                    value={novaEmpresaCnpj}
                    onChange={e => setNovaEmpresaCnpj(e.target.value)}
                  />
                </div>
              </div>
              {erroEmpresa && (
                <div className="text-[12px] mb-3" style={{ color: 'var(--warn)' }}>{erroEmpresa}</div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleCriarEmpresa}
                  disabled={salvandoEmpresa}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {salvandoEmpresa ? 'Salvando...' : 'Salvar Empresa'}
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
            <div
              className="grid text-[11px] font-bold uppercase tracking-wider"
              style={{
                gridTemplateColumns: '1fr 160px 110px 140px',
                background: 'var(--bg-void)',
                borderBottom: '1px solid var(--border-dim)',
                color: 'var(--text-faint)',
              }}
            >
              <span className="px-4 py-3">Nome</span>
              <span className="px-4 py-3">Tipo</span>
              <span className="px-4 py-3 text-center">Status</span>
              <span className="px-4 py-3 text-center">Ações</span>
            </div>

            {loadingEmpresas && (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--text-low)' }}>
                Carregando...
              </div>
            )}
            {!loadingEmpresas && empresas.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                Nenhuma empresa cadastrada.
              </div>
            )}
            {empresas.map((emp, i) => (
              <div
                key={emp.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: '1fr 160px 110px 140px',
                  borderBottom: '1px solid var(--border-dim)',
                  background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent',
                }}
              >
                <span className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-high)' }}>
                  {emp.nome}
                </span>
                <span className="px-4 py-3 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{
                      background: emp.tipo === 'PROPRIA' ? 'rgba(59,130,246,.12)' : 'rgba(139,92,246,.12)',
                      color: emp.tipo === 'PROPRIA' ? '#60a5fa' : '#a78bfa',
                      border: `1px solid ${emp.tipo === 'PROPRIA' ? 'rgba(59,130,246,.3)' : 'rgba(139,92,246,.3)'}`,
                    }}
                  >
                    {TIPO_LABELS[emp.tipo]}
                  </span>
                </span>
                <span className="px-4 py-3 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{
                      background: emp.ativa ? 'var(--ok-bg)' : 'var(--bg-surface)',
                      color: emp.ativa ? 'var(--ok)' : 'var(--text-faint)',
                      border: `1px solid ${emp.ativa ? 'var(--ok)' : 'var(--border)'}`,
                    }}
                  >
                    {emp.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </span>
                <span className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleEmpresa(emp)}
                    className="text-[12px] font-medium px-3 py-1 rounded transition-all"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-mid)',
                    }}
                  >
                    {emp.ativa ? 'Desativar' : 'Ativar'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tab: Funções ──────────────────────────────────────────────────────── */}
      {tab === 'funcoes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
              {funcoes.length} função{funcoes.length !== 1 ? 'ões' : ''} cadastrada{funcoes.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => { setShowFormFuncao(s => !s); setErroFuncao(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {showFormFuncao ? 'Cancelar' : '+ Nova Função'}
            </button>
          </div>

          {/* Inline form */}
          {showFormFuncao && (
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
                    Nome *
                  </label>
                  <input
                    style={{ ...inputStyle, width: '100%' }}
                    placeholder="Nome da função (ex: Pedreiro, Mestre de obras)"
                    value={novaFuncaoNome}
                    onChange={e => setNovaFuncaoNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCriarFuncao(); }}
                  />
                </div>
                <button
                  onClick={handleCriarFuncao}
                  disabled={salvandoFuncao}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60 flex-shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {salvandoFuncao ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              {erroFuncao && (
                <div className="text-[12px] mt-2" style={{ color: 'var(--warn)' }}>{erroFuncao}</div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
            <div
              className="grid text-[11px] font-bold uppercase tracking-wider"
              style={{
                gridTemplateColumns: '1fr 110px 140px',
                background: 'var(--bg-void)',
                borderBottom: '1px solid var(--border-dim)',
                color: 'var(--text-faint)',
              }}
            >
              <span className="px-4 py-3">Nome</span>
              <span className="px-4 py-3 text-center">Status</span>
              <span className="px-4 py-3 text-center">Ações</span>
            </div>

            {loadingFuncoes && (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--text-low)' }}>
                Carregando...
              </div>
            )}
            {!loadingFuncoes && funcoes.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                Nenhuma função cadastrada.
              </div>
            )}
            {funcoes.map((func, i) => (
              <div
                key={func.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: '1fr 110px 140px',
                  borderBottom: '1px solid var(--border-dim)',
                  background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent',
                }}
              >
                <span className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-high)' }}>
                  {func.nome}
                </span>
                <span className="px-4 py-3 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{
                      background: func.ativa ? 'var(--ok-bg)' : 'var(--bg-surface)',
                      color: func.ativa ? 'var(--ok)' : 'var(--text-faint)',
                      border: `1px solid ${func.ativa ? 'var(--ok)' : 'var(--border)'}`,
                    }}
                  >
                    {func.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </span>
                <span className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleFuncao(func)}
                    className="text-[12px] font-medium px-3 py-1 rounded transition-all"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-mid)',
                    }}
                  >
                    {func.ativa ? 'Desativar' : 'Ativar'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
