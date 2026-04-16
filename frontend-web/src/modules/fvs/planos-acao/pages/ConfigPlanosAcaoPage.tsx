// frontend-web/src/modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx
import { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  useCiclos, useCreateCiclo, useDeleteCiclo,
  useEtapas, useCreateEtapa, useDeleteEtapa,
  useCreateCampo, useDeleteCampo,
  useGatilhos, useCreateGatilho, useDeleteGatilho,
} from '../hooks/useConfigPlanosAcao';
import type {
  PaConfigCiclo, PaConfigEtapa,
  PaCampoTipo, PaCondicao,
} from '../../../../services/planos-acao.service';

// ── Ciclo Row ──────────────────────────────────────────────────────────────────

function CicloRow({ ciclo }: { ciclo: PaConfigCiclo }) {
  const [open, setOpen] = useState(false);
  const deleteCiclo = useDeleteCiclo();

  return (
    <div className="rounded-lg border border-[var(--border-dim)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left flex-1"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="text-[14px] font-semibold text-[var(--text-high)]">{ciclo.nome}</span>
          <span className="text-[11px] text-[var(--text-faint)] ml-1">{ciclo.modulo}</span>
          {!ciclo.ativo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
              Inativo
            </span>
          )}
        </button>
        <button
          onClick={() => {
            if (confirm(`Desativar ciclo "${ciclo.nome}"?`)) deleteCiclo.mutate(ciclo.id);
          }}
          className="text-[var(--text-faint)] hover:text-red-500 p-1"
          title="Desativar ciclo"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded: stages */}
      {open && <EtapasEditor cicloId={ciclo.id} />}
    </div>
  );
}

// ── Etapas Editor ──────────────────────────────────────────────────────────────

function EtapasEditor({ cicloId }: { cicloId: number }) {
  const { data: etapas } = useEtapas(cicloId);
  const createEtapa = useCreateEtapa(cicloId);
  const deleteEtapa = useDeleteEtapa(cicloId);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome]         = useState('');
  const [cor, setCor]           = useState('#6B7280');
  const [isInicial, setIsInicial] = useState(false);
  const [isFinal, setIsFinal]   = useState(false);
  const [prazoDias, setPrazoDias] = useState('');

  const handleAddEtapa = async () => {
    if (!nome.trim()) return;
    await createEtapa.mutateAsync({
      nome: nome.trim(),
      ordem: (etapas?.length ?? 0),
      cor,
      isInicial,
      isFinal,
      prazoDias: prazoDias ? Number(prazoDias) : undefined,
    });
    setNome(''); setCor('#6B7280'); setIsInicial(false); setIsFinal(false); setPrazoDias('');
    setShowForm(false);
  };

  return (
    <div className="px-4 pb-4 pt-2 border-t border-[var(--border-dim)] bg-[var(--bg-subtle)]">
      <div className="flex flex-col gap-2 mb-3">
        {(etapas ?? []).sort((a, b) => a.ordem - b.ordem).map((etapa) => (
          <EtapaRow key={etapa.id} etapa={etapa} cicloId={cicloId} onDelete={() => {
            if (confirm(`Remover etapa "${etapa.nome}"?`)) deleteEtapa.mutate(etapa.id);
          }} />
        ))}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              className="input-base text-[12px]"
              placeholder="Nome da etapa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-[var(--text-faint)]">Cor</label>
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-7 w-14 cursor-pointer rounded border-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isInicial} onChange={(e) => setIsInicial(e.target.checked)} />
              Etapa inicial
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />
              Etapa final
            </label>
            <div className="flex items-center gap-1 ml-auto">
              <label className="text-[var(--text-faint)]">Prazo (dias)</label>
              <input
                type="number"
                className="input-base text-[12px] w-16"
                value={prazoDias}
                onChange={(e) => setPrazoDias(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1 text-[12px] rounded border border-[var(--border-dim)] text-[var(--text-faint)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddEtapa}
              disabled={!nome.trim()}
              className="px-3 py-1 text-[12px] rounded bg-[var(--accent)] text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
        >
          <Plus size={12} /> Adicionar etapa
        </button>
      )}
    </div>
  );
}

// ── Etapa Row ─────────────────────────────────────────────────────────────────

function EtapaRow({
  etapa, cicloId, onDelete,
}: { etapa: PaConfigEtapa; cicloId: number; onDelete: () => void }) {
  const [openCampos, setOpenCampos] = useState(false);

  return (
    <div className="rounded-md border border-[var(--border-dim)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.cor }} />
        <span className="text-[13px] text-[var(--text-high)] flex-1">{etapa.nome}</span>
        {etapa.is_inicial && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">Inicial</span>}
        {etapa.is_final   && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Final</span>}
        {etapa.prazo_dias && <span className="text-[10px] text-[var(--text-faint)]">{etapa.prazo_dias}d</span>}
        <button
          onClick={() => setOpenCampos((v) => !v)}
          className="text-[11px] text-[var(--accent)] hover:underline ml-auto"
        >
          Campos ({etapa.campos?.length ?? 0})
        </button>
        <button onClick={onDelete} className="text-[var(--text-faint)] hover:text-red-500 p-0.5">
          <Trash2 size={12} />
        </button>
      </div>
      {openCampos && <CamposEditor etapa={etapa} cicloId={cicloId} />}
    </div>
  );
}

// ── Campos Editor ─────────────────────────────────────────────────────────────

const TIPOS: PaCampoTipo[] = ['texto', 'numero', 'data', 'select', 'usuario', 'arquivo'];

function CamposEditor({ etapa, cicloId }: { etapa: PaConfigEtapa; cicloId: number }) {
  const createCampo = useCreateCampo(cicloId);
  const deleteCampo = useDeleteCampo(cicloId);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome]         = useState('');
  const [chave, setChave]       = useState('');
  const [tipo, setTipo]         = useState<PaCampoTipo>('texto');
  const [obrigatorio, setObrigatorio] = useState(false);
  const [opcoesStr, setOpcoesStr] = useState('');

  const handleAdd = async () => {
    if (!nome.trim() || !chave.trim()) return;
    const opcoes = tipo === 'select' && opcoesStr.trim()
      ? opcoesStr.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    await createCampo.mutateAsync({
      etapaId: etapa.id,
      data: { nome: nome.trim(), chave: chave.trim(), tipo, obrigatorio, opcoes },
    });
    setNome(''); setChave(''); setTipo('texto'); setObrigatorio(false); setOpcoesStr('');
    setShowForm(false);
  };

  return (
    <div className="px-3 pb-3 border-t border-[var(--border-dim)] bg-[var(--bg-subtle)]">
      <div className="flex flex-col gap-1 my-2">
        {(etapa.campos ?? []).map((campo) => (
          <div key={campo.id} className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
            <span className="font-mono">{campo.chave}</span>
            <span>{campo.nome}</span>
            <span className="px-1 py-0.5 rounded bg-[var(--bg-subtle)] capitalize">{campo.tipo}</span>
            {campo.obrigatorio && <span className="text-red-400 font-semibold">*</span>}
            <button
              onClick={() => { if (confirm(`Remover campo "${campo.nome}"?`)) deleteCampo.mutate(campo.id); }}
              className="ml-auto hover:text-red-500"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 rounded border border-[var(--border-dim)] bg-[var(--bg-surface)] p-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-base text-[11px]"
              placeholder="Nome do campo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="input-base text-[11px] font-mono"
              placeholder="chave_snake_case"
              value={chave}
              onChange={(e) => setChave(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              className="input-base text-[11px] flex-1"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as PaCampoTipo)}
            >
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px]">
              <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
              Obrigatório
            </label>
          </div>
          {tipo === 'select' && (
            <input
              className="input-base text-[11px]"
              placeholder="Opções separadas por vírgula: Op1, Op2, Op3"
              value={opcoesStr}
              onChange={(e) => setOpcoesStr(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-2 py-1 text-[11px] rounded border border-[var(--border-dim)] text-[var(--text-faint)]">
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!nome.trim() || !chave.trim()}
              className="px-2 py-1 text-[11px] rounded bg-[var(--accent)] text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
        >
          <Plus size={11} /> Campo
        </button>
      )}
    </div>
  );
}

// ── Gatilhos Tab ──────────────────────────────────────────────────────────────

function GatilhosTab({ ciclos }: { ciclos: PaConfigCiclo[] }) {
  const [selectedCiclo, setSelectedCiclo] = useState<number | null>(ciclos[0]?.id ?? null);
  const { data: gatilhos } = useGatilhos(selectedCiclo ?? 0);
  const createGatilho = useCreateGatilho(selectedCiclo ?? 0);
  const deleteGatilho = useDeleteGatilho(selectedCiclo ?? 0);

  const [condicao, setCondicao]     = useState<PaCondicao>('TAXA_CONFORMIDADE_ABAIXO');
  const [valorLimiar, setValorLimiar] = useState('');
  const [criticidadeMin, setCriticidadeMin] = useState('');
  const [formError, setFormError]   = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedCiclo) return;
    setFormError(null);
    try {
      await createGatilho.mutateAsync({
        condicao,
        valorLimiar: valorLimiar ? Number(valorLimiar) : undefined,
        criticidadeMin: criticidadeMin || undefined,
      });
      setValorLimiar(''); setCriticidadeMin('');
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Erro ao criar gatilho');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ciclo selector */}
      <div className="flex items-center gap-2">
        <label className="text-[12px] font-medium text-[var(--text-medium)]">Ciclo:</label>
        <select
          className="input-base text-[13px] min-w-[180px]"
          value={selectedCiclo ?? ''}
          onChange={(e) => setSelectedCiclo(Number(e.target.value))}
        >
          {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {/* Existing triggers */}
      {(gatilhos ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          {gatilhos!.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] px-3 py-2 text-[12px]">
              <span className="font-semibold text-[var(--text-high)]">{g.condicao}</span>
              {g.valor_limiar !== null && (
                <span className="text-[var(--text-faint)]">limiar: {g.valor_limiar}%</span>
              )}
              {g.criticidade_min && (
                <span className="text-[var(--text-faint)]">criticidade: {g.criticidade_min}</span>
              )}
              <span
                className={cn(
                  'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase',
                  g.ativo
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500',
                )}
              >
                {g.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button
                onClick={() => { if (confirm('Remover gatilho?')) deleteGatilho.mutate(g.id); }}
                className="text-[var(--text-faint)] hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-faint)]">Nenhum gatilho configurado para este ciclo.</p>
      )}

      {/* New trigger form */}
      <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4 flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-high)]">Adicionar Gatilho</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            className="input-base text-[13px]"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value as PaCondicao)}
          >
            <option value="TAXA_CONFORMIDADE_ABAIXO">Taxa Conformidade Abaixo</option>
            <option value="ITEM_CRITICO_NC">Item Crítico NC</option>
            <option value="NC_ABERTA">NC Aberta</option>
          </select>

          {condicao === 'TAXA_CONFORMIDADE_ABAIXO' && (
            <input
              type="number"
              className="input-base text-[13px]"
              placeholder="Limiar % (ex: 80)"
              min="0"
              max="100"
              value={valorLimiar}
              onChange={(e) => setValorLimiar(e.target.value)}
            />
          )}

          {condicao === 'ITEM_CRITICO_NC' && (
            <select
              className="input-base text-[13px]"
              value={criticidadeMin}
              onChange={(e) => setCriticidadeMin(e.target.value)}
            >
              <option value="">Criticidade mínima…</option>
              <option value="critico">Crítico</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          )}
        </div>

        {formError && (
          <p className="text-[12px] text-red-500">{formError}</p>
        )}

        <button
          onClick={handleCreate}
          disabled={!selectedCiclo}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 hover:opacity-90"
        >
          <Plus size={13} /> Criar Gatilho
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'ciclos' | 'gatilhos';

export function ConfigPlanosAcaoPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ciclos');
  const { data: ciclos } = useCiclos('FVS');
  const createCiclo = useCreateCiclo();
  const [showNovoCiclo, setShowNovoCiclo] = useState(false);
  const [novoCicloNome, setNovoCicloNome] = useState('');
  const [cicloError, setCicloError]       = useState<string | null>(null);

  const handleCreateCiclo = async () => {
    if (!novoCicloNome.trim()) return;
    setCicloError(null);
    try {
      await createCiclo.mutateAsync({ modulo: 'FVS', nome: novoCicloNome.trim() });
      setNovoCicloNome(''); setShowNovoCiclo(false);
    } catch (err: any) {
      setCicloError(err?.response?.data?.message ?? 'Erro ao criar ciclo');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text-high)]">Configuração — Planos de Ação</h1>
        <p className="text-[13px] text-[var(--text-faint)] mt-0.5">
          Gerencie ciclos de vida, etapas, campos e gatilhos de abertura automática.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-dim)]">
        {(['ciclos', 'gatilhos'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
            )}
          >
            {tab === 'ciclos' ? 'Ciclos' : 'Gatilhos'}
          </button>
        ))}
      </div>

      {/* Tab: Ciclos */}
      {activeTab === 'ciclos' && (
        <div className="flex flex-col gap-4">
          {/* Create ciclo */}
          {showNovoCiclo ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="input-base text-[13px] flex-1 min-w-[200px]"
                placeholder="Nome do ciclo (ex: Ciclo FVS Padrão)"
                value={novoCicloNome}
                onChange={(e) => setNovoCicloNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCiclo()}
                autoFocus
              />
              <button
                onClick={handleCreateCiclo}
                disabled={!novoCicloNome.trim()}
                className="px-3 py-1.5 text-[13px] rounded-lg bg-[var(--accent)] text-white disabled:opacity-40"
              >
                Criar
              </button>
              <button
                onClick={() => setShowNovoCiclo(false)}
                className="px-3 py-1.5 text-[13px] rounded-lg border border-[var(--border-dim)] text-[var(--text-faint)]"
              >
                Cancelar
              </button>
              {cicloError && <p className="w-full text-[12px] text-red-500">{cicloError}</p>}
            </div>
          ) : (
            <button
              onClick={() => setShowNovoCiclo(true)}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-lg bg-[var(--accent)] text-white hover:opacity-90"
            >
              <Plus size={14} /> Novo Ciclo
            </button>
          )}

          {/* Ciclo list */}
          {(!ciclos || ciclos.length === 0) ? (
            <p className="text-[13px] text-[var(--text-faint)]">
              Nenhum ciclo FVS criado. Crie o primeiro ciclo acima.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {ciclos.map((ciclo) => <CicloRow key={ciclo.id} ciclo={ciclo} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Gatilhos */}
      {activeTab === 'gatilhos' && (
        ciclos && ciclos.length > 0
          ? <GatilhosTab ciclos={ciclos} />
          : <p className="text-[13px] text-[var(--text-faint)]">Crie um ciclo primeiro para configurar gatilhos.</p>
      )}
    </div>
  );
}
