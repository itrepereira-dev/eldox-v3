import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, FileText, Image as ImageIcon, Check } from 'lucide-react';
import { obrasService, type RelatorioConfig, type RelatorioConfigSecoes } from '../../services/obras.service';
import { useToast } from '../../components/ui';

/**
 * Modal para personalizar o PDF do RDO por obra (G8).
 * Permite configurar: logomarca cliente (URL), título customizado e
 * habilitação por seção (clima, mão-de-obra, equipamentos, atividades,
 * ocorrências, checklist, fotos, assinaturas).
 */

const SECAO_LABELS: Array<{ key: keyof RelatorioConfigSecoes; label: string; desc: string }> = [
  { key: 'clima',        label: 'Clima',        desc: 'Condições climáticas do dia (manhã/tarde/noite).' },
  { key: 'mao_obra',     label: 'Mão de obra',  desc: 'Tabela de funções, quantidade e horas trabalhadas.' },
  { key: 'equipamentos', label: 'Equipamentos', desc: 'Equipamentos mobilizados na obra.' },
  { key: 'atividades',   label: 'Atividades',   desc: 'Atividades executadas e percentual de avanço.' },
  { key: 'ocorrencias',  label: 'Ocorrências',  desc: 'Eventos relevantes do dia (acidentes, visitas, greve).' },
  { key: 'checklist',    label: 'Checklist',    desc: 'Itens de verificação recorrentes.' },
  { key: 'fotos',        label: 'Registro fotográfico', desc: 'Lista de fotos anexadas.' },
  { key: 'assinaturas',  label: 'Assinaturas',  desc: 'Assinaturas digitais dos responsáveis.' },
];

interface Props {
  obraId: number;
  obraNome: string;
  onClose: () => void;
}

export function RelatorioConfigModal({ obraId, obraNome, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: config, isLoading } = useQuery({
    queryKey: ['obra-relatorio-config', obraId],
    queryFn: () => obrasService.getRelatorioConfig(obraId),
  });

  const [form, setForm] = useState<RelatorioConfig | null>(null);

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config, form]);

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: (patch: Partial<RelatorioConfig>) => obrasService.patchRelatorioConfig(obraId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obra-relatorio-config', obraId] });
      toast.success('Configuração do relatório salva');
      onClose();
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  function updateSecao(key: keyof RelatorioConfigSecoes, value: boolean) {
    if (!form) return;
    setForm({ ...form, secoes: { ...form.secoes, [key]: value } });
  }

  function handleSalvar() {
    if (!form) return;
    salvar({
      logo_cliente_url: form.logo_cliente_url,
      titulo: form.titulo,
      secoes: form.secoes,
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 540,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FileText size={18} color="var(--accent)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-high)' }}>
                Personalizar relatório PDF
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-low)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {obraNome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', color: 'var(--text-low)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {isLoading || !form ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-low)' }}>
            Carregando…
          </div>
        ) : (
          <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Título customizado */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                Título do relatório
              </label>
              <input
                type="text"
                placeholder="DIÁRIO DE OBRA (padrão)"
                maxLength={80}
                value={form.titulo ?? ''}
                onChange={e => setForm({ ...form, titulo: e.target.value || null })}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg-raised)',
                  color: 'var(--text-high)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-faint)' }}>
                Substitui o texto que aparece no topo do PDF.
              </p>
            </div>

            {/* Logomarca cliente URL */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                <ImageIcon size={12} />
                Logomarca do cliente (URL)
              </label>
              <input
                type="url"
                placeholder="https://.../logo-cliente.png"
                value={form.logo_cliente_url ?? ''}
                onChange={e => setForm({ ...form, logo_cliente_url: e.target.value || null })}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg-raised)',
                  color: 'var(--text-high)', fontSize: 13, fontFamily: 'var(--font-mono)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-faint)' }}>
                Recomendado PNG com fundo transparente, largura ≤ 400px. Upload direto em breve.
              </p>
            </div>

            {/* Seções habilitadas */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Seções no PDF
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SECAO_LABELS.map(({ key, label, desc }) => {
                  const ativo = form.secoes[key];
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 12px', borderRadius: 'var(--r-sm)',
                        border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-dim)'}`,
                        background: ativo ? 'var(--accent-dim)' : 'var(--bg-raised)',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ativo}
                        onChange={e => updateSecao(key, e.target.checked)}
                        style={{ accentColor: 'var(--accent)', width: 15, height: 15, marginTop: 2, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-high)' }}>
                          {label}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-low)' }}>
                          {desc}
                        </p>
                      </div>
                      {ativo && <Check size={14} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border-dim)',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: 'pointer',
              opacity: isPending ? .5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={isPending || !form}
            style={{
              padding: '8px 22px', borderRadius: 'var(--r-sm)',
              border: '1px solid transparent', background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: isPending || !form ? 'not-allowed' : 'pointer',
              opacity: isPending || !form ? .7 : 1,
            }}
          >
            {isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
