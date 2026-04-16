import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type {
  WorkflowTemplate,
  WorkflowTemplateEtapa,
  AprovacaoModulo,
  TipoAprovador,
  AcaoVencimento,
  AcaoRejeicao,
} from '../../../services/aprovacoes.service';

const MODULO_OPTS: { value: AprovacaoModulo; label: string }[] = [
  { value: 'FVS',          label: 'FVS' },
  { value: 'FVM',          label: 'FVM' },
  { value: 'RDO',          label: 'RDO' },
  { value: 'NC',           label: 'NC' },
  { value: 'GED',          label: 'GED' },
  { value: 'ENSAIO',       label: 'Ensaio' },
  { value: 'CONCRETAGEM',  label: 'Concretagem' },
  { value: 'ALMOXARIFADO', label: 'Almoxarifado' },
];

const TIPO_APROVADOR_OPTS: { value: TipoAprovador; label: string }[] = [
  { value: 'RESPONSAVEL_OBRA', label: 'Responsável da Obra' },
  { value: 'ROLE',             label: 'Por Perfil (Role)' },
  { value: 'USUARIO_FIXO',     label: 'Usuário Fixo' },
];

const ACAO_VENCIMENTO_OPTS: { value: AcaoVencimento; label: string }[] = [
  { value: 'ESCALAR',  label: 'Escalar para Admin' },
  { value: 'AVANCAR',  label: 'Aprovação tácita (avançar)' },
  { value: 'BLOQUEAR', label: 'Bloquear instância' },
];

const ACAO_REJEICAO_OPTS: { value: AcaoRejeicao; label: string }[] = [
  { value: 'RETORNAR_SOLICITANTE',    label: 'Retornar ao Solicitante' },
  { value: 'RETORNAR_ETAPA_1',        label: 'Retornar à Etapa 1' },
  { value: 'RETORNAR_ETAPA_ANTERIOR', label: 'Retornar à Etapa Anterior' },
  { value: 'BLOQUEAR',                label: 'Bloquear (exige intervenção)' },
];

type EtapaRascunho = Partial<WorkflowTemplateEtapa> & { _key: string };

interface Props {
  template?: WorkflowTemplate;
  onSalvar: (data: Partial<WorkflowTemplate>) => void;
  salvando?: boolean;
  onCancelar: () => void;
}

const etapaVazia = (ordem: number): EtapaRascunho => ({
  _key: `${Date.now()}-${ordem}`,
  ordem,
  nome: '',
  tipoAprovador: 'RESPONSAVEL_OBRA',
  acaoVencimento: 'ESCALAR',
  acaoRejeicao: 'RETORNAR_SOLICITANTE',
});

export function TemplateEditor({ template, onSalvar, salvando, onCancelar }: Props) {
  const [nome, setNome] = useState(template?.nome ?? '');
  const [modulo, setModulo] = useState<AprovacaoModulo>(template?.modulo ?? 'FVS');
  const [descricao, setDescricao] = useState(template?.descricao ?? '');
  const [etapas, setEtapas] = useState<EtapaRascunho[]>(
    template?.etapas?.length
      ? template.etapas.map(e => ({ ...e, _key: String(e.id) }))
      : [etapaVazia(1)],
  );

  const addEtapa = () => {
    setEtapas(prev => [...prev, etapaVazia(prev.length + 1)]);
  };

  const removeEtapa = (key: string) => {
    setEtapas(prev =>
      prev
        .filter(e => e._key !== key)
        .map((e, i) => ({ ...e, ordem: i + 1 })),
    );
  };

  const updateEtapa = (key: string, field: keyof EtapaRascunho, value: unknown) => {
    setEtapas(prev =>
      prev.map(e => (e._key === key ? { ...e, [field]: value } : e)),
    );
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar({
      nome,
      modulo,
      descricao: descricao || undefined,
      etapas: etapas.map(({ _key, ...rest }) => rest) as WorkflowTemplateEtapa[],
    });
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
  const labelCls = 'block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1';

  return (
    <form onSubmit={handleSalvar} className="space-y-5">
      {/* Campos do template */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Nome *</label>
          <input
            required
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: FVS — Padrão da Obra"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Módulo *</label>
          <select
            required
            value={modulo}
            onChange={e => setModulo(e.target.value as AprovacaoModulo)}
            className={inputCls}
          >
            {MODULO_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Descrição</label>
          <textarea
            rows={2}
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva quando este template é utilizado..."
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* Etapas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Etapas ({etapas.length})
          </span>
          <button
            type="button"
            onClick={addEtapa}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            <Plus size={12} />
            Adicionar Etapa
          </button>
        </div>

        <div className="space-y-3">
          {etapas.map((etapa, idx) => (
            <div
              key={etapa._key}
              className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-base)] p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <GripVertical size={14} className="text-[var(--text-faint)] flex-shrink-0" />
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--run-bg)',
                    color: 'var(--run-text)',
                    border: '1px solid var(--run-border)',
                  }}
                >
                  Etapa {idx + 1}
                </span>
                <div className="flex-1" />
                {etapas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEtapa(etapa._key)}
                    className="text-[var(--nc)] opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Nome da Etapa *</label>
                  <input
                    required
                    value={etapa.nome ?? ''}
                    onChange={e => updateEtapa(etapa._key, 'nome', e.target.value)}
                    placeholder="Ex: Aprovação do Engenheiro"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tipo de Aprovador</label>
                  <select
                    value={etapa.tipoAprovador ?? 'RESPONSAVEL_OBRA'}
                    onChange={e => updateEtapa(etapa._key, 'tipoAprovador', e.target.value)}
                    className={inputCls}
                  >
                    {TIPO_APROVADOR_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {etapa.tipoAprovador === 'ROLE' && (
                  <div>
                    <label className={labelCls}>Role (perfil)</label>
                    <input
                      value={etapa.role ?? ''}
                      onChange={e => updateEtapa(etapa._key, 'role', e.target.value)}
                      placeholder="Ex: ENGENHEIRO"
                      className={inputCls}
                    />
                  </div>
                )}

                {etapa.tipoAprovador === 'USUARIO_FIXO' && (
                  <div>
                    <label className={labelCls}>ID do Usuário</label>
                    <input
                      type="number"
                      value={etapa.usuarioFixoId ?? ''}
                      onChange={e => updateEtapa(etapa._key, 'usuarioFixoId', Number(e.target.value))}
                      placeholder="ID numérico"
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Condição (opcional)</label>
                  <input
                    value={etapa.condicao ?? ''}
                    onChange={e => updateEtapa(etapa._key, 'condicao', e.target.value)}
                    placeholder="Ex: ncs_abertas > 3"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Prazo (horas)</label>
                  <input
                    type="number"
                    min={1}
                    value={etapa.prazoHoras ?? ''}
                    onChange={e => updateEtapa(etapa._key, 'prazoHoras', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Ex: 48"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Ao vencer prazo</label>
                  <select
                    value={etapa.acaoVencimento ?? 'ESCALAR'}
                    onChange={e => updateEtapa(etapa._key, 'acaoVencimento', e.target.value)}
                    className={inputCls}
                  >
                    {ACAO_VENCIMENTO_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Ao rejeitar</label>
                  <select
                    value={etapa.acaoRejeicao ?? 'RETORNAR_SOLICITANTE'}
                    onChange={e => updateEtapa(etapa._key, 'acaoRejeicao', e.target.value)}
                    className={inputCls}
                  >
                    {ACAO_REJEICAO_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {salvando ? 'Salvando...' : 'Salvar Template'}
        </button>
      </div>
    </form>
  );
}
