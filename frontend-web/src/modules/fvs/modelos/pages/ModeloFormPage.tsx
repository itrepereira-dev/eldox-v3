// frontend-web/src/modules/fvs/modelos/pages/ModeloFormPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateModelo, useUpdateModelo, useModelo } from '../hooks/useModelos';
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
  const [exigeRo,         setExigeRo]         = useState(modeloExistente?.exige_ro ?? true);
  const [exigeReinspecao, setExigeReinspecao] = useState(modeloExistente?.exige_reinspecao ?? true);
  const [exigeParecer,    setExigeParecer]    = useState(modeloExistente?.exige_parecer ?? true);
  const [erro,            setErro]            = useState('');

  const isPbqph = regime === 'pbqph';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const payload = {
      nome, descricao: descricao || undefined, escopo, regime,
      exigeRo:          isPbqph ? true : exigeRo,
      exigeReinspecao:  isPbqph ? true : exigeReinspecao,
      exigeParecer:     isPbqph ? true : exigeParecer,
    };
    try {
      if (isEdit) {
        await updateModelo.mutateAsync({ id: modeloId!, ...payload });
        navigate(`/fvs/modelos/${modeloId}`);
      } else {
        const novo = await createModelo.mutateAsync(payload);
        navigate(`/fvs/modelos/${novo.id}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar template');
    }
  }

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
