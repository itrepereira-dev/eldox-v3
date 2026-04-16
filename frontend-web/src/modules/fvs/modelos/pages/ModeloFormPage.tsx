// frontend-web/src/modules/fvs/modelos/pages/ModeloFormPage.tsx
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useCreateModelo, useUpdateModelo, useModelo } from '../hooks/useModelos';
import { fvsService } from '../../../../services/fvs.service';
import type { EscopoModelo, RegimeModelo } from '../../../../services/fvs.service';
import { Info } from 'lucide-react';

export function ModeloFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const modeloId = id ? parseInt(id) : undefined;
  const isEdit = !!modeloId;

  const { data: modeloExistente } = useModelo(modeloId ?? 0);
  const createModelo = useCreateModelo();
  const updateModelo = useUpdateModelo();

  const [nome,            setNome]            = useState(modeloExistente?.nome ?? '');
  const [descricao,       setDescricao]       = useState(modeloExistente?.descricao ?? '');
  const [escopo,          setEscopo]          = useState<EscopoModelo>(modeloExistente?.escopo ?? 'empresa');
  const [regime,          setRegime]          = useState<RegimeModelo>(modeloExistente?.regime ?? 'livre');
  const [exigeRo,            setExigeRo]            = useState(modeloExistente?.exige_ro ?? true);
  const [exigeReinspecao,    setExigeReinspecao]    = useState(modeloExistente?.exige_reinspecao ?? true);
  const [exigeParecer,       setExigeParecer]       = useState(modeloExistente?.exige_parecer ?? true);
  const [fotosObrigatorias,  setFotosObrigatorias]  = useState<'todas' | 'apenas_nc' | 'nenhuma' | 'itens_selecionados'>(
    modeloExistente?.fotos_obrigatorias ?? 'apenas_nc'
  );
  const [erro,               setErro]               = useState('');

  // Two-step state for item selection
  const [step,           setStep]           = useState<'form' | 'selecting-fotos'>('form');
  const [savedModeloId,  setSavedModeloId]  = useState<number | null>(null);
  const [savedServicos,  setSavedServicos]  = useState<{ servico_id: number }[]>([]);
  const [fotosItensSel,  setFotosItensSel]  = useState<Set<number>>(new Set());

  const isPbqph = regime === 'pbqph';

  // Load items for all services in the saved model (step 2)
  const servicoIds = useMemo(() => savedServicos.map(s => s.servico_id), [savedServicos]);
  const servicoQueries = useQueries({
    queries: servicoIds.map(sid => ({
      queryKey: ['fvs-servico', sid],
      queryFn: () => fvsService.getServico(sid),
      enabled: step === 'selecting-fotos' && servicoIds.length > 0,
    })),
  });

  const todosItens = useMemo(() => {
    return servicoQueries.flatMap(q =>
      q.data?.itens?.map(item => ({
        ...item,
        servico_nome: q.data.nome,
      })) ?? []
    );
  }, [servicoQueries]);

  const itensLoading = servicoQueries.some(q => q.isLoading);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const payload = {
      nome, descricao: descricao || undefined, escopo, regime,
      exigeRo:           isPbqph ? true : exigeRo,
      exigeReinspecao:   isPbqph ? true : exigeReinspecao,
      exigeParecer:      isPbqph ? true : exigeParecer,
      fotosObrigatorias,
    };
    try {
      let resultId: number;
      if (isEdit) {
        await updateModelo.mutateAsync({ id: modeloId!, ...payload });
        resultId = modeloId!;
      } else {
        const novo = await createModelo.mutateAsync(payload);
        resultId = novo.id;
      }

      if (fotosObrigatorias === 'itens_selecionados') {
        // Step 2: load items for selection
        const savedModelo = isEdit ? modeloExistente : await fvsService.getModelo(resultId);
        setSavedModeloId(resultId);
        setSavedServicos(savedModelo?.servicos ?? []);
        // Pre-populate from existing fotos_itens_ids
        const existingIds = (isEdit ? modeloExistente?.fotos_itens_ids : null) ?? [];
        setFotosItensSel(new Set(existingIds));
        setStep('selecting-fotos');
      } else {
        navigate(isEdit ? `/fvs/modelos/${modeloId}` : `/fvs/modelos/${resultId}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar template');
    }
  }

  async function handleConfirmarFotos() {
    if (!savedModeloId) return;
    setErro('');
    try {
      await updateModelo.mutateAsync({
        id: savedModeloId,
        fotosItensIds: [...fotosItensSel],
      });
      navigate(`/fvs/modelos/${savedModeloId}`);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar itens de fotos');
    }
  }

  function toggleItem(itemId: number) {
    setFotosItensSel(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // ── Step 2: Item selection ──────────────────────────────────────────────
  if (step === 'selecting-fotos') {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold text-[var(--text-high)] mt-0 mb-1">
          Itens com foto obrigatória
        </h1>
        <p className="text-sm text-[var(--text-faint)] mb-6">
          Selecione em quais itens de inspeção a foto será obrigatória.
        </p>

        {itensLoading && (
          <p className="text-sm text-[var(--text-faint)]">Carregando itens…</p>
        )}

        {!itensLoading && todosItens.length === 0 && (
          <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] p-4 text-sm text-[var(--text-faint)]">
            Este template ainda não possui serviços/itens. Você pode adicionar serviços na página do template e depois configurar os itens com foto obrigatória.
          </div>
        )}

        {!itensLoading && todosItens.length > 0 && (
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setFotosItensSel(new Set(todosItens.map(i => i.id)))}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => setFotosItensSel(new Set())}
                className="text-xs text-[var(--text-faint)] hover:underline"
              >
                Limpar
              </button>
              <span className="text-xs text-[var(--text-faint)] ml-auto">
                {fotosItensSel.size} selecionado{fotosItensSel.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Group by service */}
            {servicoQueries
              .filter(q => q.data && (q.data.itens?.length ?? 0) > 0)
              .map(q => (
                <div key={q.data!.id} className="mb-3">
                  <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                    {q.data!.nome}
                  </p>
                  <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] divide-y divide-[var(--border-dim)]">
                    {q.data!.itens!.map(item => (
                      <label
                        key={item.id}
                        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={fotosItensSel.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="accent-[var(--accent)] w-4 h-4 mt-0.5 flex-shrink-0"
                        />
                        <span className="text-sm text-[var(--text-mid)]">{item.descricao}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {erro && (
          <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-3">
            {erro}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirmarFotos}
            disabled={updateModelo.isPending}
            className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {updateModelo.isPending ? 'Salvando…' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={() => savedModeloId && navigate(`/fvs/modelos/${savedModeloId}`)}
            className="px-4 py-2 rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
          >
            Pular
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Form ────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-[var(--text-high)] mt-0 mb-6">
        {isEdit ? 'Editar Template' : 'Novo Template de Inspeção'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Nome */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-mid)]">Nome *</label>
          <input
            className="px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            value={nome}
            onChange={e => setNome(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex.: Alvenaria Estrutural — PBQP-H"
          />
        </div>

        {/* Descrição */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-mid)]">Descrição</label>
          <textarea
            className="px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-y min-h-[64px]"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
          />
        </div>

        {/* Regime */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-mid)]">Processo / Regime *</label>
          <select
            className="px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            value={regime}
            onChange={e => setRegime(e.target.value as RegimeModelo)}
          >
            <option value="livre">Inspeção Interna (Livre)</option>
            <option value="pbqph">PBQP-H (todas etapas obrigatórias)</option>
          </select>
        </div>

        {/* Escopo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-mid)]">Escopo *</label>
          <select
            className="px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            value={escopo}
            onChange={e => setEscopo(e.target.value as EscopoModelo)}
          >
            <option value="empresa">Empresa (disponível para qualquer obra)</option>
            <option value="obra">Obra específica</option>
          </select>
        </div>

        {/* Workflow — só aparece se não for PBQP-H */}
        {!isPbqph && (
          <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] p-4">
            <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">
              Etapas do Workflow
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Exige Relatório de Ocorrências (RO)', value: exigeRo,         set: setExigeRo },
                { label: 'Exige Reinspeção',                    value: exigeReinspecao, set: setExigeReinspecao },
                { label: 'Exige Parecer de Qualidade',          value: exigeParecer,    set: setExigeParecer },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-2.5 text-sm text-[var(--text-mid)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={e => set(e.target.checked)}
                    className="accent-[var(--accent)] w-4 h-4 rounded"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Fotos obrigatórias */}
        <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] p-4">
          <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">
            Obrigatoriedade de Fotos
          </p>
          <div className="flex flex-col gap-2">
            {([
              { value: 'todas',              label: 'Obrigatória em todos os itens' },
              { value: 'apenas_nc',          label: 'Obrigatória apenas em Não Conformidades' },
              { value: 'itens_selecionados', label: 'Obrigatória em itens selecionados' },
              { value: 'nenhuma',            label: 'Nenhuma foto obrigatória' },
            ] as const).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2.5 text-sm text-[var(--text-mid)] cursor-pointer select-none">
                <input
                  type="radio"
                  name="fotosObrigatorias"
                  value={value}
                  checked={fotosObrigatorias === value}
                  onChange={() => setFotosObrigatorias(value)}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                {label}
              </label>
            ))}
          </div>
          {fotosObrigatorias === 'itens_selecionados' && (
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Após salvar, você poderá selecionar quais itens exigem foto.
            </p>
          )}
        </div>

        {/* Aviso PBQP-H */}
        {isPbqph && (
          <div className="flex items-start gap-2 text-xs text-[var(--text-faint)] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg p-3">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            <span>Processo PBQP-H: RO, Reinspeção e Parecer são obrigatórios e não podem ser desativados.</span>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)]">
            {erro}
          </p>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={createModelo.isPending || updateModelo.isPending}
            className="px-5 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createModelo.isPending || updateModelo.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Template'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
