// frontend-web/src/modules/fvm/grade/pages/FichaLotePage.tsx
// Página de inspeção item a item de um lote — equivalente ao FichaLocalPage do FVS
// Fluxo: almoxarife/técnico marca cada item do checklist como Conforme / NC / N/A
// Ao concluir, o sistema calcula o status final e abre o modal de decisão

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLote, usePutRegistro, useConcluirInspecao } from '../hooks/useGradeFvm';
import { cn } from '@/lib/cn';
import { ArrowLeft, Check, X, Minus, FlaskConical, ClipboardList, FileDown } from 'lucide-react';
import { EvidenciasSection } from '../components/EvidenciasSection';
import { LiberarQuarentenaModal } from '../components/LiberarQuarentenaModal';
import { EnsaiosTab } from '../components/EnsaiosTab';
import { downloadFichaRecebimento } from '../../relatorios/pdf/FichaRecebimentoPdf';

// ── Tipos ─────────────────────────────────────────────────────────────────

type StatusItem = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'nao_aplicavel';
type TipoItem   = 'visual' | 'documental' | 'dimensional' | 'ensaio';

const TIPO_LABEL: Record<TipoItem, string> = {
  visual:      'Visual',
  documental:  'Doc',
  dimensional: 'Dim',
  ensaio:      'Ensaio',
};

const TIPO_CLS: Record<TipoItem, string> = {
  visual:      'bg-blue-50 text-blue-700 border border-blue-200',
  documental:  'bg-purple-50 text-purple-700 border border-purple-200',
  dimensional: 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  ensaio:      'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

const CRIT_DOT: Record<string, string> = {
  critico: 'bg-[var(--nc-text)]',
  maior:   'bg-[var(--warn-text)]',
  menor:   'bg-[var(--text-faint)]',
};

// ── Componente principal ──────────────────────────────────────────────────

export function FichaLotePage() {
  const { loteId } = useParams<{ loteId: string }>();
  const id = Number(loteId);
  const navigate = useNavigate();

  const { data: lote, isLoading } = useLote(id);
  const putRegistro   = usePutRegistro(id);
  const concluirInsp  = useConcluirInspecao(id);

  const [abaAtiva, setAbaAtiva] = useState<'checklist' | 'ensaios'>('checklist');
  const [liberarOpen, setLiberarOpen] = useState(false);
  const [ncModal, setNcModal]         = useState<{ itemId: number; descricao: string } | null>(null);
  const [ncObs, setNcObs]             = useState('');
  const [ncErro, setNcErro]           = useState('');
  const [concluirModal, setConcluirModal] = useState(false);
  const [decisao, setDecisao]         = useState<'aprovado' | 'aprovado_com_ressalva' | 'quarentena' | 'reprovado' | null>(null);
  const [quarentenaMotivo, setQuarentenaMotivo] = useState('');
  const [quarentenaDias, setQuarentenaDias]     = useState(7);
  const [obsGeral, setObsGeral]               = useState('');
  const [erroApi, setErroApi]         = useState<string | null>(null);
  const [salvando, setSalvando]       = useState<number | null>(null); // itemId em saving
  const [exportando, setExportando]   = useState(false);

  if (isLoading || !lote) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  const registros    = lote.itens ?? [];
  const naoAvaliados = registros.filter(r => !r.registro_status || r.registro_status === 'nao_avaliado').length;
  const naoConformes = registros.filter(r => r.registro_status === 'nao_conforme').length;
  const conformes    = registros.filter(r => r.registro_status === 'conforme' || r.registro_status === 'nao_aplicavel').length;
  const total        = registros.length;
  const progresso    = total > 0 ? Math.round((conformes / total) * 100) : 0;

  const podeConcluir = lote.status === 'em_inspecao';
  const somenteLeitura = lote.status !== 'aguardando_inspecao' && lote.status !== 'em_inspecao';

  // ── Marcar item ─────────────────────────────────────────────────────────
  async function marcar(itemId: number, status: StatusItem, obs?: string) {
    setSalvando(itemId);
    try {
      await putRegistro.mutateAsync({ item_id: itemId, status, observacao: obs });
    } finally {
      setSalvando(null);
    }
  }

  async function marcarNC() {
    if (!ncObs.trim()) { setNcErro('Descreva a não conformidade encontrada'); return; }
    if (!ncModal) return;
    await marcar(ncModal.itemId, 'nao_conforme', ncObs);
    setNcModal(null);
    setNcObs('');
    setNcErro('');
  }

  // ── Concluir inspeção ────────────────────────────────────────────────────
  async function concluir() {
    if (!decisao) return;
    setErroApi(null);
    try {
      await concluirInsp.mutateAsync({
        decisao,
        observacao_geral:     obsGeral.trim() || undefined,
        quarentena_motivo:    decisao === 'quarentena' ? quarentenaMotivo : undefined,
        quarentena_prazo_dias: decisao === 'quarentena' ? quarentenaDias  : undefined,
      });
      navigate(-1);
    } catch (e: any) {
      setErroApi(e?.response?.data?.message ?? 'Erro ao concluir inspeção');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-0.5 text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-[var(--text-high)] m-0">
            {lote.material_nome}
          </h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            {lote.numero_lote} · NF {lote.numero_nf} · {lote.fornecedor_nome}
          </p>
        </div>
        <button
          onClick={async () => {
            if (!lote) return;
            setExportando(true);
            try {
              await downloadFichaRecebimento(lote);
            } finally {
              setExportando(false);
            }
          }}
          disabled={exportando}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          <FileDown size={13} />
          {exportando ? 'Gerando...' : 'Exportar Ficha PDF'}
        </button>
      </div>

      {/* ── Progresso ────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
            <div
              className="h-full bg-[var(--ok-text)] rounded-full transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <span className="text-xs text-[var(--text-faint)] font-mono">{conformes}/{total}</span>
        </div>
        <div className="flex gap-3 text-xs text-[var(--text-faint)]">
          {naoConformes > 0 && <span className="text-[var(--nc-text)] font-semibold">{naoConformes} NC</span>}
          {naoAvaliados > 0 && <span>{naoAvaliados} pendentes</span>}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--border-dim)] mb-4 -mx-6 px-6">
        <button
          type="button"
          onClick={() => setAbaAtiva('checklist')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            abaAtiva === 'checklist'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
          )}
        >
          <ClipboardList size={14} />
          Checklist
          {naoAvaliados > 0 && (
            <span className="text-[10px] font-bold bg-[var(--warn-bg)] text-[var(--warn-text)] px-1 rounded">
              {naoAvaliados}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('ensaios')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            abaAtiva === 'ensaios'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
          )}
        >
          <FlaskConical size={14} />
          Ensaios
        </button>
      </div>

      {/* ── Lista de itens do checklist ─────────────────────────────────── */}
      {abaAtiva === 'checklist' && (
      <div className="flex flex-col gap-2 mb-6">
        {registros.map((reg, i) => (
          <div
            key={reg.id}
            className={cn(
              'rounded-lg border p-3 transition-colors',
              reg.registro_status === 'conforme'      && 'border-[var(--ok-border)] bg-[var(--ok-bg)]',
              reg.registro_status === 'nao_conforme'  && 'border-[var(--nc-border)] bg-[var(--nc-bg)]',
              reg.registro_status === 'nao_aplicavel' && 'border-[var(--border-dim)] bg-[var(--bg-raised)] opacity-60',
              (!reg.registro_status || reg.registro_status === 'nao_avaliado') && 'border-[var(--border-dim)] bg-[var(--bg-base)]',
            )}
          >
            <div className="flex items-start gap-3">
              {/* Número e dot de criticidade */}
              <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0">
                <span className="text-xs text-[var(--text-faint)] font-mono w-5 text-center">{i + 1}</span>
                <span className={cn('w-1.5 h-1.5 rounded-full', CRIT_DOT[reg.criticidade])} title={reg.criticidade} />
              </div>

              {/* Descrição e tipo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('text-[10px] font-semibold px-1 py-0.5 rounded', TIPO_CLS[reg.tipo as TipoItem])}>
                    {TIPO_LABEL[reg.tipo as TipoItem]}
                  </span>
                  {reg.criticidade === 'critico' && (
                    <span className="text-[10px] font-bold text-[var(--nc-text)] uppercase">Crítico</span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-high)] m-0 leading-snug">{reg.descricao}</p>
                {reg.criterio_aceite && (
                  <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5 italic">{reg.criterio_aceite}</p>
                )}
                {reg.registro_status === 'nao_conforme' && reg.registro_observacao && (
                  <p className="text-xs text-[var(--nc-text)] m-0 mt-1 font-medium">NC: {reg.registro_observacao}</p>
                )}
              </div>

              {/* Botões de ação — padrão touch-friendly (min 44px) */}
              {!somenteLeitura && (
                <div className="flex items-center gap-1 shrink-0">
                  {salvando === reg.id ? (
                    <span className="text-xs text-[var(--text-faint)] px-2">...</span>
                  ) : (
                    <>
                      {/* Conforme */}
                      <button
                        onClick={() => marcar(reg.id, 'conforme')}
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center transition-colors',
                          reg.registro_status === 'conforme'
                            ? 'bg-[var(--ok-text)] text-white'
                            : 'bg-[var(--bg-raised)] text-[var(--text-faint)] hover:bg-[var(--ok-text)] hover:text-white border border-[var(--border-dim)]',
                        )}
                        title="Conforme"
                      >
                        <Check size={14} />
                      </button>

                      {/* Não Conforme */}
                      <button
                        onClick={() => {
                          if (reg.registro_status === 'nao_conforme') {
                            marcar(reg.id, 'nao_avaliado');
                          } else {
                            setNcModal({ itemId: reg.id, descricao: reg.descricao });
                          }
                        }}
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center transition-colors',
                          reg.registro_status === 'nao_conforme'
                            ? 'bg-[var(--nc-text)] text-white'
                            : 'bg-[var(--bg-raised)] text-[var(--text-faint)] hover:bg-[var(--nc-text)] hover:text-white border border-[var(--border-dim)]',
                        )}
                        title="Não Conforme"
                      >
                        <X size={14} />
                      </button>

                      {/* N/A */}
                      <button
                        onClick={() => marcar(reg.id, reg.registro_status === 'nao_aplicavel' ? 'nao_avaliado' : 'nao_aplicavel')}
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center transition-colors text-xs font-bold',
                          reg.registro_status === 'nao_aplicavel'
                            ? 'bg-[var(--text-faint)] text-white'
                            : 'bg-[var(--bg-raised)] text-[var(--text-faint)] hover:bg-[var(--text-faint)] hover:text-white border border-[var(--border-dim)]',
                        )}
                        title="Não Aplicável"
                      >
                        <Minus size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {abaAtiva === 'ensaios' && (
        <EnsaiosTab
          loteId={id}
          materialId={lote.material_id}
          somenteLeitura={somenteLeitura}
        />
      )}

      {/* ── Seção de Evidências (documentos vinculados) ──────────────────── */}
      <EvidenciasSection loteId={id} obraId={lote.obra_id} />

      {/* ── Botão Concluir Inspeção ──────────────────────────────────────── */}
      {podeConcluir && (
        <button
          onClick={() => setConcluirModal(true)}
          className="w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Concluir Inspeção
        </button>
      )}

      {/* ── Botão Liberar Quarentena (visível apenas quando status = quarentena) ── */}
      {lote.status === 'quarentena' && (
        <button
          onClick={() => setLiberarOpen(true)}
          className="w-full py-3 rounded-lg bg-orange-600 text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Liberar Quarentena
        </button>
      )}

      {/* ── Modal de Liberar Quarentena ──────────────────────────────────── */}
      {liberarOpen && (
        <LiberarQuarentenaModal
          lote={lote}
          onClose={() => setLiberarOpen(false)}
          onSucesso={() => { setLiberarOpen(false); navigate(-1); }}
        />
      )}

      {/* ── Modal de NC (observação obrigatória) ─────────────────────────── */}
      {ncModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-high)] mb-1">Registrar Não Conformidade</h3>
            <p className="text-xs text-[var(--text-faint)] mb-3">Item: <span className="text-[var(--text-high)]">{ncModal.descricao}</span></p>
            <textarea
              autoFocus
              value={ncObs}
              onChange={e => { setNcObs(e.target.value); setNcErro(''); }}
              placeholder="Descreva o problema encontrado..."
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--nc-border)] resize-none"
            />
            {ncErro && <p className="text-xs text-[var(--nc-text)] mt-1">{ncErro}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setNcModal(null); setNcObs(''); setNcErro(''); }}
                className="flex-1 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)]">
                Cancelar
              </button>
              <button onClick={marcarNC}
                className="flex-1 py-2 rounded-md bg-[var(--nc-text)] text-white text-sm font-medium hover:opacity-90">
                Confirmar NC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Decisão Final ────────────────────────────────────────── */}
      {concluirModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-high)] mb-1">Decisão Final</h3>
            <p className="text-xs text-[var(--text-faint)] mb-4">
              {naoConformes > 0
                ? `${naoConformes} item(s) não conforme(s) encontrado(s).`
                : 'Todos os itens avaliados. Selecione a decisão:'}
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {[
                { value: 'aprovado',              label: 'Aprovado',              cls: 'border-[var(--ok-border)] text-[var(--ok-text)]',    desc: 'Todos os itens conformes' },
                { value: 'aprovado_com_ressalva', label: 'Aprovado c/ Ressalva',  cls: 'border-yellow-300 text-yellow-700',                  desc: 'NC menor, liberado pelo engenheiro' },
                { value: 'quarentena',            label: 'Quarentena',            cls: 'border-orange-300 text-orange-700',                  desc: 'Aguardar laudo ou documento' },
                { value: 'reprovado',             label: 'Reprovado',             cls: 'border-[var(--nc-border)] text-[var(--nc-text)]',    desc: 'NC crítica — devolução obrigatória' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDecisao(opt.value as typeof decisao)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md border-2 transition-colors',
                    decisao === opt.value ? `${opt.cls} bg-[var(--bg-raised)]` : 'border-[var(--border-dim)] text-[var(--text-faint)] hover:border-[var(--accent)]',
                  )}
                >
                  <div className={cn('text-sm font-medium', decisao === opt.value ? opt.cls.split(' ')[1] : '')}>{opt.label}</div>
                  <div className="text-xs text-[var(--text-faint)]">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Campos extras para quarentena */}
            {decisao === 'quarentena' && (
              <div className="flex flex-col gap-2 mb-4">
                <textarea
                  value={quarentenaMotivo}
                  onChange={e => setQuarentenaMotivo(e.target.value)}
                  placeholder="Motivo da quarentena *"
                  rows={2}
                  className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-faint)]">Prazo (dias):</label>
                  <input
                    type="number"
                    value={quarentenaDias}
                    onChange={e => setQuarentenaDias(Number(e.target.value))}
                    min={1}
                    className="w-20 text-sm px-2 py-1 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            )}

            {/* Observação geral — obrigatória para reprovado */}
            {(decisao === 'reprovado' || decisao === 'aprovado_com_ressalva') && (
              <div className="mb-4">
                <textarea
                  value={obsGeral}
                  onChange={e => setObsGeral(e.target.value)}
                  placeholder={decisao === 'reprovado' ? 'Motivo da reprovação *' : 'Ressalva registrada pelo engenheiro (opcional)'}
                  rows={2}
                  className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>
            )}

            {erroApi && (
              <p className="text-xs text-[var(--nc-text)] mb-3">{erroApi}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setConcluirModal(false)}
                className="flex-1 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)]">
                Cancelar
              </button>
              <button
                onClick={concluir}
                disabled={!decisao || concluirInsp.isPending || (decisao === 'reprovado' && !obsGeral.trim())}
                className="flex-1 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {concluirInsp.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
