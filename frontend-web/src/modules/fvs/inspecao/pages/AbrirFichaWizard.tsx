// frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCreateFicha } from '../hooks/useFichas';
import { useServicos } from '../../catalogo/hooks/useCatalogo';
import { useModelosByObra } from '../../modelos/hooks/useModelos';
import type { RegimeFicha } from '../../../../services/fvs.service';
import { obrasService } from '../../../../services/obras.service';
import { cn } from '@/lib/cn';
import { Hash } from 'lucide-react';

interface ServicoComLocais {
  servicoId: number;
  localIds: number[];
}

interface Props {
  obras?: { id: number; nome: string }[];
  locaisPorObra?: Record<number, { id: number; nome: string; pavimento_nome?: string }[]>;
}

function gerarCodigo(obraNome: string, modeloNome?: string): string {
  const sigla = (str: string, max: number) =>
    str.split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, max);
  const now = new Date();
  const data = [
    now.getDate().toString().padStart(2, '0'),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getFullYear(),
  ].join('');
  const siglaObra  = sigla(obraNome, 4);
  const siglaModel = modeloNome ? sigla(modeloNome, 3) : 'MAN';
  return `FVS-${siglaObra}-${siglaModel}-${data}`;
}

export function AbrirFichaWizard({ obras: obrasProp = [], locaisPorObra = {} }: Props) {
  const navigate = useNavigate();
  const createFicha = useCreateFicha();
  const { data: servicos = [] } = useServicos();

  const { data: obrasData = [] } = useQuery({
    queryKey: ['obras-wizard'],
    queryFn: () => obrasService.getAll(),
    enabled: obrasProp.length === 0,
  });
  const obras: { id: number; nome: string }[] =
    obrasProp.length > 0 ? obrasProp : ((obrasData as any)?.items ?? obrasData ?? []);

  const [step, setStep]           = useState(1);
  const [obraId, setObraId]       = useState<number | null>(null);
  const [regime, setRegime]       = useState<RegimeFicha>('livre');
  const [modeloId, setModeloId]   = useState<number | null>(null);
  const [localIdsSelecionados, setLocalIdsSelecionados] = useState<number[]>([]);
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoComLocais[]>([]);
  const [error, setError]         = useState('');

  const { data: modelosDisponiveis = [] } = useModelosByObra(obraId ?? 0);

  const { data: locaisData = [] } = useQuery({
    queryKey: ['obra-locais-wizard', obraId],
    queryFn: () => obrasService.getLocais(obraId!, { nivel: 2 }),
    enabled: !!obraId && Object.keys(locaisPorObra).length === 0,
  });
  const locais = obraId
    ? (locaisPorObra[obraId] ?? locaisData.map(l => ({ id: l.id, nome: l.nomeCompleto })))
    : [];

  const obraSelecionada  = obras.find(o => o.id === obraId);
  const modeloSelecionado = modelosDisponiveis.find(m => m.modelo_id === modeloId);
  const codigoGerado = obraSelecionada
    ? gerarCodigo(obraSelecionada.nome, modeloSelecionado?.modelo_nome)
    : '';

  function toggleServico(servicoId: number) {
    setServicosSelecionados(prev => {
      const exists = prev.find(s => s.servicoId === servicoId);
      return exists ? prev.filter(s => s.servicoId !== servicoId) : [...prev, { servicoId, localIds: [] }];
    });
  }

  function toggleLocal(servicoId: number, localId: number) {
    setServicosSelecionados(prev =>
      prev.map(s => {
        if (s.servicoId !== servicoId) return s;
        const ids = s.localIds.includes(localId)
          ? s.localIds.filter(id => id !== localId)
          : [...s.localIds, localId];
        return { ...s, localIds: ids };
      }),
    );
  }

  function handleSelecionarModelo(mId: number | null) {
    setModeloId(mId);
    if (!mId) setServicosSelecionados([]);
    setLocalIdsSelecionados([]);
  }

  function toggleLocalTemplate(localId: number) {
    setLocalIdsSelecionados(prev =>
      prev.includes(localId) ? prev.filter(id => id !== localId) : [...prev, localId],
    );
  }

  async function handleConfirmar() {
    setError('');
    if (!obraId) { setError('Obra é obrigatória.'); return; }

    const nome = codigoGerado;

    if (modeloId) {
      if (!localIdsSelecionados.length) {
        setError('Selecione ao menos um local para inspecionar.');
        return;
      }
      try {
        const ficha = await createFicha.mutateAsync({ obraId, nome, modeloId, localIds: localIdsSelecionados });
        navigate(`/fvs/fichas/${ficha.id}`);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Erro ao criar inspeção');
      }
      return;
    }

    const servicosComLocais = servicosSelecionados.filter(s => s.localIds.length > 0);
    if (!servicosComLocais.length) {
      setError('Selecione ao menos um serviço com um local para inspecionar.');
      return;
    }
    try {
      const ficha = await createFicha.mutateAsync({ obraId, nome, regime, servicos: servicosComLocais });
      navigate(`/fvs/fichas/${ficha.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao criar inspeção');
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] transition-colors';

  // ── Step 1: Obra ─────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-5">Nova Inspeção — Selecionar Obra</h2>

        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--text-mid)] mb-1.5">Obra *</label>
          <select
            className={inputCls}
            value={obraId ?? ''}
            onChange={e => setObraId(parseInt(e.target.value) || null)}
          >
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>

        {error && (
          <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">
            {error}
          </p>
        )}

        <button
          onClick={() => {
            if (!obraId) { setError('Selecione uma obra.'); return; }
            setError(''); setStep(2);
          }}
          className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Próximo →
        </button>
      </div>
    );
  }

  // ── Step 2: Template ──────────────────────────────────────────────────────────
  if (step === 2) {
    const temModelos = modelosDisponiveis.length > 0;
    return (
      <div className="p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-2">Usar Template?</h2>

        {/* Código gerado */}
        {codigoGerado && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-raised)] border border-[var(--border-dim)] mb-4">
            <Hash size={13} className="text-[var(--text-faint)] flex-shrink-0" />
            <span className="text-xs text-[var(--text-faint)]">Código gerado:</span>
            <span className="text-xs font-mono font-semibold text-[var(--accent)]">{codigoGerado}</span>
          </div>
        )}

        {temModelos ? (
          <>
            <p className="text-sm text-[var(--text-faint)] mb-4">
              Há {modelosDisponiveis.length} template(s) vinculado(s) a esta obra. Selecione um ou prossiga sem template.
            </p>
            <div className="flex flex-col gap-2.5 mb-5">
              <label className={cn(
                'flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-colors',
                modeloId === null ? 'border-[var(--accent)] bg-[var(--accent-subtle,#eff6ff)]' : 'border-[var(--border-dim)] bg-[var(--bg-raised)]',
              )}>
                <input type="radio" checked={modeloId === null} onChange={() => handleSelecionarModelo(null)} className="accent-[var(--accent)]" />
                <div>
                  <p className={cn('text-sm font-semibold m-0', modeloId === null ? 'text-[var(--accent)]' : 'text-[var(--text-high)]')}>Criar manualmente</p>
                  <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">Selecionar serviços e locais individualmente</p>
                </div>
              </label>
              {modelosDisponiveis.map(m => (
                <label key={m.modelo_id} className={cn(
                  'flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-colors',
                  modeloId === m.modelo_id ? 'border-[var(--accent)] bg-[var(--accent-subtle,#eff6ff)]' : 'border-[var(--border-dim)] bg-[var(--bg-raised)]',
                )}>
                  <input type="radio" checked={modeloId === m.modelo_id} onChange={() => handleSelecionarModelo(m.modelo_id)} className="accent-[var(--accent)]" />
                  <div>
                    <p className={cn('text-sm font-semibold m-0', modeloId === m.modelo_id ? 'text-[var(--accent)]' : 'text-[var(--text-high)]')}>{m.modelo_nome}</p>
                    <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">Criadas nesta obra: {m.fichas_count} inspeções</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--text-faint)] mb-5">
            Nenhum template vinculado a esta obra. A inspeção será criada manualmente.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-md text-sm border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={() => setStep(3)}
            className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Próximo →
          </button>
        </div>
        {error && (
          <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mt-3">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Step 3 com template: selecionar locais ────────────────────────────────────
  if (step === 3 && modeloId) {
    const modeloNome = modelosDisponiveis.find(m => m.modelo_id === modeloId)?.modelo_nome ?? 'Template';
    return (
      <div className="p-6 max-w-xl">
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-1">Selecionar Locais</h2>
        <p className="text-sm text-[var(--text-faint)] mb-4">
          Template: <span className="font-medium text-[var(--text-high)]">{modeloNome}</span>
          {' — '}os locais abaixo serão inspecionados para todos os serviços do template.
        </p>

        {codigoGerado && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-raised)] border border-[var(--border-dim)] mb-4">
            <Hash size={13} className="text-[var(--text-faint)] flex-shrink-0" />
            <span className="text-xs text-[var(--text-faint)]">Código gerado:</span>
            <span className="text-xs font-mono font-semibold text-[var(--accent)]">{codigoGerado}</span>
          </div>
        )}

        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Locais da obra:</p>
          <label className="flex items-center gap-1.5 text-xs text-[var(--accent)] cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={locais.length > 0 && localIdsSelecionados.length === locais.length}
              onChange={() => {
                const allSel = localIdsSelecionados.length === locais.length;
                setLocalIdsSelecionados(allSel ? [] : locais.map(l => l.id));
              }}
              className="accent-[var(--accent)] w-3.5 h-3.5"
            />
            Todos ({locais.length})
          </label>
        </div>

        {locais.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] py-4 text-center border border-dashed border-[var(--border-dim)] rounded-lg">
            Nenhum local cadastrado nesta obra. Cadastre locais na obra antes de criar a inspeção.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-5 max-h-60 overflow-y-auto pr-1 py-2">
            {locais.map(local => (
              <label
                key={local.id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors',
                  localIdsSelecionados.includes(local.id)
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle,#eff6ff)] text-[var(--accent)]'
                    : 'border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <input
                  type="checkbox"
                  checked={localIdsSelecionados.includes(local.id)}
                  onChange={() => toggleLocalTemplate(local.id)}
                  className="accent-[var(--accent)] w-3.5 h-3.5"
                />
                {local.nome}
              </label>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setStep(2)}
            className="px-4 py-2 rounded-md text-sm border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={createFicha.isPending || localIdsSelecionados.length === 0}
            className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {createFicha.isPending ? 'Criando...' : `Criar Inspeção (${localIdsSelecionados.length} local${localIdsSelecionados.length !== 1 ? 'is' : ''})`}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3 manual: Serviços e Locais ─────────────────────────────────────────
  if (step === 3 && !modeloId) {
    return (
      <div className="p-6 max-w-xl">
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-1">Selecionar Serviços e Locais</h2>

        {/* Código gerado */}
        {codigoGerado && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-raised)] border border-[var(--border-dim)] mb-4">
            <Hash size={13} className="text-[var(--text-faint)] flex-shrink-0" />
            <span className="text-xs text-[var(--text-faint)]">Código gerado:</span>
            <span className="text-xs font-mono font-semibold text-[var(--accent)]">{codigoGerado}</span>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-mid)] mb-1.5">Regime</label>
          <select
            className={inputCls}
            value={regime}
            onChange={e => setRegime(e.target.value as RegimeFicha)}
          >
            <option value="livre">Livre</option>
            <option value="pbqph">PBQP-H</option>
            <option value="norma_tecnica">Norma Técnica</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 mb-5">
          {servicos.map(svc => {
            const sel = servicosSelecionados.find(s => s.servicoId === svc.id);
            return (
              <div key={svc.id} className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
                <label className={cn(
                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                  sel ? 'bg-[var(--accent-subtle,#eff6ff)]' : 'bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]',
                )}>
                  <input type="checkbox" checked={!!sel} onChange={() => toggleServico(svc.id)} className="accent-[var(--accent)] w-4 h-4 flex-shrink-0" />
                  <span className={cn('text-sm font-medium', sel ? 'text-[var(--accent)]' : 'text-[var(--text-high)]')}>{svc.nome}</span>
                </label>
                {sel && locais.length > 0 && (
                  <div className="px-4 py-3 border-t border-[var(--border-dim)] bg-[var(--bg-raised)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                        Locais para este serviço:
                      </p>
                      <label className="flex items-center gap-1.5 text-xs text-[var(--accent)] cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={sel.localIds.length === locais.length}
                          onChange={() => {
                            const allIds = locais.map(l => l.id);
                            const allSel = sel.localIds.length === locais.length;
                            setServicosSelecionados(prev =>
                              prev.map(s => s.servicoId === svc.id
                                ? { ...s, localIds: allSel ? [] : allIds }
                                : s
                              )
                            );
                          }}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                        Todos ({locais.length})
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-3 max-h-40 overflow-y-auto pr-1">
                      {locais.map(local => (
                        <label key={local.id} className="flex items-center gap-1.5 text-sm text-[var(--text-mid)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sel.localIds.includes(local.id)}
                            onChange={() => toggleLocal(svc.id, local.id)}
                            className="accent-[var(--accent)] w-3.5 h-3.5"
                          />
                          {local.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setStep(2)}
            className="px-4 py-2 rounded-md text-sm border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            ← Voltar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={createFicha.isPending}
            className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {createFicha.isPending ? 'Criando...' : 'Criar Inspeção'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
