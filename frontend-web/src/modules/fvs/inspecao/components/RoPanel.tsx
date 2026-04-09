// frontend-web/src/modules/fvs/inspecao/components/RoPanel.tsx
import { useRef, useState, useCallback } from 'react';
import { api } from '../../../../services/api';
import {
  useRo,
  usePatchRo,
  usePatchServicoNc,
  useCreateRoEvidencia,
  useDeleteRoEvidencia,
} from '../hooks/useRo';
import type { RoServicoNc } from '../../../../services/fvs.service';

const CAUSA_6M_OPTIONS = [
  { value: '', label: '— Selecione —' },
  { value: 'mao_obra', label: 'Mão de Obra' },
  { value: 'maquina', label: 'Máquina / Equipamento' },
  { value: 'material', label: 'Material' },
  { value: 'metodo', label: 'Método' },
  { value: 'medida', label: 'Medição / Medida' },
  { value: 'meio_ambiente', label: 'Meio Ambiente' },
  { value: 'gestao', label: 'Gestão' },
];

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pendente:     { label: 'Pendente',    bg: '#fef3c7', color: '#92400e' },
  desbloqueado: { label: 'Desbloqueado', bg: '#dbeafe', color: '#1e40af' },
  verificado:   { label: 'Verificado',  bg: '#dcfce7', color: '#166534' },
};

const CRIT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  critico: { label: 'Crítico', bg: '#fee2e2', color: '#991b1b' },
  maior:   { label: 'Maior',   bg: '#fef3c7', color: '#92400e' },
  menor:   { label: 'Menor',   bg: '#f3f4f6', color: '#6b7280' },
};

interface RoPanelProps {
  fichaId: number;
  regime: string;
}

interface ServicoAccordionProps {
  servico: RoServicoNc;
  fichaId: number;
}

function ServicoAccordion({ servico, fichaId }: ServicoAccordionProps) {
  const [open, setOpen] = useState(false);
  const [desbloqueioErro, setDesbloqueioErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchServico = usePatchServicoNc(fichaId);
  const createEvidencia = useCreateRoEvidencia(fichaId);
  const deleteEvidencia = useDeleteRoEvidencia(fichaId);

  const statusInfo = STATUS_BADGE[servico.status] ?? { label: servico.status, bg: '#f3f4f6', color: '#6b7280' };

  async function handleAcaoCorretiva(value: string) {
    await patchServico.mutateAsync({ servicoNcId: servico.id, payload: { acao_corretiva: value || null } });
  }

  async function handleDesbloquear() {
    setDesbloqueioErro(null);
    try {
      await patchServico.mutateAsync({ servicoNcId: servico.id, payload: { desbloquear: true } });
    } catch (e: any) {
      setDesbloqueioErro(e?.response?.data?.message ?? 'Erro ao desbloquear para reinspeção');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await createEvidencia.mutateAsync({ servicoNcId: servico.id, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteEvidencia(evidenciaId: number) {
    await deleteEvidencia.mutateAsync({ servicoNcId: servico.id, evidenciaId });
  }

  const handleDownloadEvidencia = useCallback(async (versaoGedId: number) => {
    const { data } = await api.get<{ presignedUrl: string }>(`/ged/versoes/${versaoGedId}/download`);
    window.open(data.presignedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      {/* Header do accordion */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: 'pointer',
          background: open ? '#fffbeb' : '#ffffff',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', fontFamily: 'DM Sans, sans-serif' }}>
            {servico.servico_nome}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: statusInfo.bg, color: statusInfo.color,
          }}>
            {statusInfo.label}
          </span>
        </div>
        <span style={{ fontSize: 16, color: '#9ca3af', userSelect: 'none' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '14px', borderTop: '1px solid #f3f4f6', background: '#fffbeb' }}>
          {/* Itens NC */}
          {servico.itens && servico.itens.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#7A96B2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Itens Não Conformes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {servico.itens.map(item => {
                  const critInfo = CRIT_BADGE[item.item_criticidade] ?? { label: item.item_criticidade, bg: '#f3f4f6', color: '#6b7280' };
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: critInfo.bg, color: critInfo.color, whiteSpace: 'nowrap',
                      }}>
                        {critInfo.label}
                      </span>
                      <span style={{ fontSize: 13, color: '#374151' }}>{item.item_descricao}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ação Corretiva */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A96B2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Ação Corretiva
            </label>
            <textarea
              defaultValue={servico.acao_corretiva ?? ''}
              onBlur={e => handleAcaoCorretiva(e.target.value)}
              rows={3}
              placeholder="Descreva a ação corretiva tomada..."
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid #d1d5db', borderRadius: 6,
                padding: '8px 10px', fontSize: 13, resize: 'vertical',
                fontFamily: 'DM Sans, sans-serif', color: '#1f2937',
                background: '#fff',
              }}
            />
          </div>

          {/* Evidências */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A96B2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Evidências
            </label>
            {servico.evidencias && servico.evidencias.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {servico.evidencias.map(ev => (
                  <div key={ev.id} style={{
                    position: 'relative', border: '1px solid #e5e7eb', borderRadius: 6,
                    padding: '6px 10px', background: '#fff', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <button
                      onClick={() => handleDownloadEvidencia(ev.versao_ged_id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#3b82f6', textDecoration: 'underline' }}
                    >
                      {ev.nome_original ?? `Evidência ${ev.id}`}
                    </button>
                    <button
                      onClick={() => handleDeleteEvidencia(ev.id)}
                      disabled={deleteEvidencia.isPending}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#ef4444', fontSize: 14, lineHeight: 1, padding: 0,
                      }}
                      title="Remover evidência"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                style={{ display: 'none' }}
                accept="image/*,application/pdf"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={createEvidencia.isPending}
                style={{
                  background: '#fff', border: '1px dashed #d1d5db', borderRadius: 6,
                  padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#6b7280',
                }}
              >
                {createEvidencia.isPending ? 'Enviando...' : '+ Adicionar Evidência'}
              </button>
            </div>
          </div>

          {/* Botão desbloquear */}
          {servico.status === 'pendente' && (
            <div>
              {desbloqueioErro && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 13, color: '#ef4444' }}>
                  {desbloqueioErro}
                </div>
              )}
              <button
                onClick={handleDesbloquear}
                disabled={patchServico.isPending}
                style={{
                  background: '#1d4ed8', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                }}
              >
                {patchServico.isPending ? 'Processando...' : 'Desbloquear para Reinspeção'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RoPanel({ fichaId, regime }: RoPanelProps) {
  const { data: ro, isError, error } = useRo(fichaId);
  const patchRo = usePatchRo(fichaId);

  // 404 ou sem RO = sem NCs = não exibe
  const isNotFound = (error as any)?.response?.status === 404;
  if (isError && isNotFound) return null;
  if (isError) return null;
  if (!ro) return null;

  const servicos = ro.servicos ?? [];
  const verificados = servicos.filter(s => s.status === 'verificado').length;
  const total = servicos.length;

  async function handleTipoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await patchRo.mutateAsync({ tipo: e.target.value as 'real' | 'potencial' });
  }

  async function handleCausa6MChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await patchRo.mutateAsync({ causa_6m: e.target.value || null });
  }

  async function handleBlurField(field: 'o_que_aconteceu' | 'acao_imediata', value: string) {
    await patchRo.mutateAsync({ [field]: value || null });
  }

  return (
    <div style={{
      border: '2px solid #fbbf24', borderRadius: 10, padding: 20,
      background: '#fffbeb', marginTop: 20,
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
            Registro de Ocorrência — RO {ro.numero}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: ro.status === 'concluido' ? '#dcfce7' : '#fef3c7',
            color: ro.status === 'concluido' ? '#166534' : '#92400e',
          }}>
            {ro.status === 'concluido' ? 'Concluído' : 'Aberto'}
          </span>
        </div>
        <span style={{ fontSize: 13, color: '#92400e' }}>
          {verificados}/{total} serviços verificados
        </span>
      </div>

      {/* Campos do cabeçalho */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Tipo */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Tipo
          </label>
          <select
            value={ro.tipo}
            onChange={handleTipoChange}
            style={{
              width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
              padding: '7px 10px', fontSize: 13, background: '#fff', color: '#1f2937',
            }}
          >
            <option value="real">Real</option>
            <option value="potencial">Potencial</option>
          </select>
        </div>

        {/* Causa 6M */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Causa (6M)
          </label>
          <select
            value={ro.causa_6m ?? ''}
            onChange={handleCausa6MChange}
            style={{
              width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
              padding: '7px 10px', fontSize: 13, background: '#fff', color: '#1f2937',
            }}
          >
            {CAUSA_6M_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* O que aconteceu */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            O que aconteceu
          </label>
          <textarea
            key={`oqa-${ro.id}`}
            defaultValue={ro.o_que_aconteceu ?? ''}
            onBlur={e => handleBlurField('o_que_aconteceu', e.target.value)}
            rows={3}
            placeholder="Descreva o ocorrido..."
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #d1d5db', borderRadius: 6,
              padding: '8px 10px', fontSize: 13, resize: 'vertical',
              fontFamily: 'DM Sans, sans-serif', color: '#1f2937', background: '#fff',
            }}
          />
        </div>

        {/* Ação imediata */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Ação Imediata
          </label>
          <textarea
            key={`ai-${ro.id}`}
            defaultValue={ro.acao_imediata ?? ''}
            onBlur={e => handleBlurField('acao_imediata', e.target.value)}
            rows={3}
            placeholder="Descreva a ação imediata tomada..."
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #d1d5db', borderRadius: 6,
              padding: '8px 10px', fontSize: 13, resize: 'vertical',
              fontFamily: 'DM Sans, sans-serif', color: '#1f2937', background: '#fff',
            }}
          />
        </div>
      </div>

      {/* Lista de serviços NC */}
      {servicos.length === 0 ? (
        <p style={{ color: '#92400e', fontSize: 13, margin: 0 }}>Nenhum serviço não conforme registrado.</p>
      ) : (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Serviços Não Conformes
          </p>
          {servicos.map(servico => (
            <ServicoAccordion key={servico.id} servico={servico} fichaId={fichaId} />
          ))}
        </div>
      )}
    </div>
  );
}
