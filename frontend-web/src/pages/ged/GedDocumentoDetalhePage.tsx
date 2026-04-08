import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  QrCode,
  ChevronDown,
} from 'lucide-react';
import { obrasService } from '../../services/obras.service';
import {
  gedService,
  type GedStatus,
  type GedAprovarPayload,
} from '../../services/ged.service';
import { useAuthStore } from '../../store/auth.store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<GedStatus, string> = {
  RASCUNHO: 'Rascunho',
  IFA: 'Em Revisão',
  IFC: 'IFC — Vigente',
  IFP: 'IFP — Vigente',
  AS_BUILT: 'As Built',
  REJEITADO: 'Rejeitado',
  OBSOLETO: 'Obsoleto',
  CANCELADO: 'Cancelado',
};

function getStatusStyle(status: GedStatus): React.CSSProperties {
  switch (status) {
    case 'IFC':
    case 'IFP':
    case 'AS_BUILT':
      return { color: 'var(--ok)', background: 'var(--ok-bg)', borderColor: 'var(--ok-border)' };
    case 'IFA':
      return { color: 'var(--warn)', background: 'var(--warn-bg)', borderColor: 'var(--warn)' };
    case 'REJEITADO':
      return { color: 'var(--nc)', background: 'var(--nc-bg)', borderColor: 'var(--nc)' };
    case 'OBSOLETO':
    case 'CANCELADO':
      return { color: 'var(--text-faint)', background: 'var(--bg-raised)', borderColor: 'var(--border-dim)' };
    default:
      return { color: 'var(--off)', background: 'var(--off-bg)', borderColor: 'var(--off)' };
  }
}

const ROLE_ORDEM = { VISITANTE: 0, TECNICO: 1, ENGENHEIRO: 2, ADMIN_TENANT: 3 };

function temPermissao(role: string | undefined, minRole: keyof typeof ROLE_ORDEM): boolean {
  if (!role) return false;
  return (ROLE_ORDEM[role as keyof typeof ROLE_ORDEM] ?? -1) >= ROLE_ORDEM[minRole];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function GedDocumentoDetalhePage() {
  const { id, documentoId } = useParams<{ id: string; documentoId: string }>();
  const obraId = parseInt(id!);
  const docId = parseInt(documentoId!);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [aprovarOpen, setAprovarOpen] = useState(false);
  const [aprovarDropdown, setAprovarDropdown] = useState(false);
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [comentarioAprovar, setComentarioAprovar] = useState('');
  const [comentarioRejeitar, setComentarioRejeitar] = useState('');
  const [statusSelecionado, setStatusSelecionado] = useState<'IFC' | 'IFP' | 'AS_BUILT'>('IFC');

  // Busca documento via lista para obter versaoId
  const { data: listaResult, isLoading: listLoading } = useQuery({
    queryKey: ['ged-doc-lista', obraId, docId],
    queryFn: () => gedService.listar(obraId, { limit: 1000 }),
  });

  const documento = listaResult?.items.find((d) => d.id === docId);
  const versaoId = documento?.versaoAtual?.id;

  const { data: versao, isLoading: versaoLoading } = useQuery({
    queryKey: ['ged-versao', versaoId],
    queryFn: () => gedService.getVersaoDetalhe(versaoId!),
    enabled: !!versaoId,
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery({
    queryKey: ['ged-audit', versaoId],
    queryFn: () => gedService.getAuditLog(versaoId!),
    enabled: !!versaoId,
  });

  const { data: obra } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => obrasService.getById(obraId),
  });

  const submeterMutation = useMutation({
    mutationFn: () => gedService.submeter(versaoId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ged-doc-lista', obraId] });
      queryClient.invalidateQueries({ queryKey: ['ged-versao', versaoId] });
      queryClient.invalidateQueries({ queryKey: ['ged-audit', versaoId] });
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: (payload: GedAprovarPayload) => gedService.aprovar(versaoId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ged-doc-lista', obraId] });
      queryClient.invalidateQueries({ queryKey: ['ged-versao', versaoId] });
      queryClient.invalidateQueries({ queryKey: ['ged-audit', versaoId] });
      setAprovarOpen(false);
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: () =>
      gedService.rejeitar(versaoId!, { comentario: comentarioRejeitar }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ged-doc-lista', obraId] });
      queryClient.invalidateQueries({ queryKey: ['ged-versao', versaoId] });
      queryClient.invalidateQueries({ queryKey: ['ged-audit', versaoId] });
      setRejeitarOpen(false);
      setComentarioRejeitar('');
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => gedService.download(versaoId!),
    onSuccess: (res) => {
      window.open(res.presignedUrl, '_blank');
    },
  });

  const isLoading = listLoading || versaoLoading;

  if (isLoading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>
        Carregando documento...
      </div>
    );
  }

  if (!documento || !versao) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--nc)' }}>
        <AlertTriangle size={32} style={{ marginBottom: '12px' }} />
        <p>Documento não encontrado.</p>
        <button
          onClick={() => navigate(`/obras/${obraId}/ged/documentos`)}
          style={{
            marginTop: '16px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            color: 'var(--text-mid)',
          }}
        >
          Voltar
        </button>
      </div>
    );
  }

  const status = versao.status;
  const podeSubmeter = status === 'RASCUNHO' && temPermissao(user?.role, 'TECNICO');
  const podeAprovar = status === 'IFA' && temPermissao(user?.role, 'ENGENHEIRO');
  const isVigente = ['IFC', 'IFP', 'AS_BUILT'].includes(status);
  const statusStyle = getStatusStyle(status);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-mid)',
          marginBottom: '20px',
        }}
      >
        <Link to="/obras" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          Obras
        </Link>
        <ChevronRight size={14} />
        <Link to={`/obras/${obraId}`} style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          {obra?.nome ?? `Obra ${obraId}`}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/obras/${obraId}/ged/documentos`} style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          Documentos
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-high)', fontWeight: 600 }}>{documento.codigo}</span>
      </div>

      {/* Layout duas colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card principal */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span
                  style={{
                    ...statusStyle,
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '99px',
                    border: '1px solid',
                    fontWeight: 600,
                  }}
                >
                  {STATUS_LABELS[status]}
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: 'var(--text-faint)',
                    background: 'var(--bg-raised)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {documento.codigo}
                </span>
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-high)' }}>
                {documento.titulo}
              </h1>
              {documento.categoria && (
                <p style={{ color: 'var(--text-mid)', fontSize: '13px', marginTop: '4px' }}>
                  {documento.categoria.nome}
                  {documento.disciplina && ` · ${documento.disciplina}`}
                </p>
              )}
            </div>

            {/* Metadados */}
            <div style={{ padding: '20px 24px' }}>
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-mid)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '16px',
                }}
              >
                Versão Atual
              </h3>
              <MetaGrid>
                <MetaItem label="Revisão" value={`Rev. ${versao.numeroRevisao}`} />
                <MetaItem label="Versão" value={String(versao.version)} />
                <MetaItem label="Arquivo" value={versao.nomeOriginal} />
                <MetaItem label="Tamanho" value={formatBytes(versao.tamanhoBytes)} />
                <MetaItem label="Tipo" value={versao.mimeType} />
                {versao.aprovadoEm && (
                  <MetaItem
                    label="Aprovado em"
                    value={new Date(versao.aprovadoEm).toLocaleDateString('pt-BR')}
                  />
                )}
                {versao.dataValidade && (
                  <MetaItem
                    label="Validade"
                    value={new Date(versao.dataValidade).toLocaleDateString('pt-BR')}
                    warn={new Date(versao.dataValidade) < new Date()}
                  />
                )}
              </MetaGrid>

              {/* Rejeição */}
              {status === 'REJEITADO' && versao.comentarioRejeicao && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    background: 'var(--nc-bg)',
                    border: '1px solid var(--nc)',
                    borderRadius: '8px',
                  }}
                >
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--nc)', marginBottom: '4px' }}>
                    Motivo da rejeição
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-high)' }}>
                    {versao.comentarioRejeicao}
                  </p>
                </div>
              )}

              {/* IA */}
              {versao.aiCategorias && versao.aiCategorias.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px' }}>
                    Categorias sugeridas pela IA
                    {versao.aiConfianca !== undefined && (
                      <span style={{ color: 'var(--text-faint)', marginLeft: '6px' }}>
                        ({Math.round(versao.aiConfianca * 100)}% confiança)
                      </span>
                    )}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {versao.aiCategorias.map((cat) => (
                      <span
                        key={cat}
                        style={{
                          fontSize: '12px',
                          padding: '3px 8px',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          borderRadius: '4px',
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* QR Token (vigente) */}
              {isVigente && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    background: 'var(--bg-raised)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <QrCode size={20} color="var(--accent)" />
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-mid)', marginBottom: '2px' }}>
                      QR Token
                    </p>
                    <p
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        color: 'var(--text-high)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {versao.qrToken}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {documento.tags && documento.tags.length > 0 && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px 20px',
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '10px' }}>
                Tags
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {documento.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      background: 'var(--bg-raised)',
                      color: 'var(--text-mid)',
                      borderRadius: '99px',
                      border: '1px solid var(--border-dim)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Ações */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-high)', marginBottom: '14px' }}>
              Ações
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Download */}
              <button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  color: 'var(--text-high)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <Download size={16} color="var(--accent)" />
                {downloadMutation.isPending ? 'Gerando link...' : 'Download'}
              </button>

              {/* Submeter */}
              {podeSubmeter && (
                <button
                  onClick={() => submeterMutation.mutate()}
                  disabled={submeterMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    background: 'var(--warn-bg)',
                    border: '1px solid var(--warn)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    color: 'var(--warn)',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <Clock size={16} />
                  {submeterMutation.isPending ? 'Submetendo...' : 'Submeter para Revisão'}
                </button>
              )}

              {/* Aprovar */}
              {podeAprovar && (
                <>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setAprovarDropdown((v) => !v)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'var(--ok-bg)',
                        border: '1px solid var(--ok)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        color: 'var(--ok)',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={16} />
                        Aprovar como...
                      </span>
                      <ChevronDown size={15} />
                    </button>
                    {aprovarDropdown && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          zIndex: 10,
                          marginTop: '4px',
                          overflow: 'hidden',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {(['IFC', 'IFP', 'AS_BUILT'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setStatusSelecionado(s);
                              setAprovarOpen(true);
                              setAprovarDropdown(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 14px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'var(--text-high)',
                              fontSize: '14px',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = 'var(--bg-hover)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = 'none')
                            }
                          >
                            {s === 'IFC'
                              ? 'IFC — Informação para Construção'
                              : s === 'IFP'
                              ? 'IFP — Informação para Projeto'
                              : 'As Built'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rejeitar */}
                  <button
                    onClick={() => setRejeitarOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      background: 'var(--nc-bg)',
                      border: '1px solid var(--nc)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      color: 'var(--nc)',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    <XCircle size={16} />
                    Rejeitar
                  </button>
                </>
              )}
            </div>

            {/* Erros de mutations */}
            {submeterMutation.isError && (
              <p style={{ fontSize: '12px', color: 'var(--nc)', marginTop: '8px' }}>
                Erro ao submeter. Tente novamente.
              </p>
            )}
          </div>

          {/* Audit Log */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileText size={16} color="var(--accent)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-high)' }}>
                Histórico
              </h3>
            </div>

            {auditLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-mid)', fontSize: '13px' }}>
                Carregando...
              </div>
            ) : auditLog.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
                Sem registros
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {[...auditLog].reverse().map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '12px 20px',
                      borderBottom:
                        i === auditLog.length - 1 ? 'none' : '1px solid var(--border-dim)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--text-high)', fontWeight: 500 }}>
                        {entry.acao}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                        {new Date(entry.criadoEm).toLocaleDateString('pt-BR')}{' '}
                        {new Date(entry.criadoEm).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {entry.statusDe && entry.statusPara && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                          {STATUS_LABELS[entry.statusDe as GedStatus] ?? entry.statusDe}
                        </span>
                        <ChevronRight size={11} color="var(--text-faint)" />
                        <span style={{ fontSize: '11px', color: 'var(--text-mid)', fontWeight: 600 }}>
                          {STATUS_LABELS[entry.statusPara as GedStatus] ?? entry.statusPara}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Aprovar */}
      {aprovarOpen && (
        <ModalConfirm
          title={`Aprovar como ${statusSelecionado}`}
          onCancel={() => setAprovarOpen(false)}
          onConfirm={() =>
            aprovarMutation.mutate({
              statusAprovado: statusSelecionado,
              ...(comentarioAprovar && { comentario: comentarioAprovar }),
            })
          }
          isPending={aprovarMutation.isPending}
          confirmLabel="Confirmar Aprovação"
          confirmColor="var(--ok)"
        >
          <p style={{ fontSize: '14px', color: 'var(--text-mid)', marginBottom: '12px' }}>
            O documento será marcado como <strong>{statusSelecionado}</strong>. Deseja adicionar um
            comentário?
          </p>
          <textarea
            value={comentarioAprovar}
            onChange={(e) => setComentarioAprovar(e.target.value)}
            placeholder="Comentário (opcional)..."
            rows={3}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--text-high)',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </ModalConfirm>
      )}

      {/* Modal Rejeitar */}
      {rejeitarOpen && (
        <ModalConfirm
          title="Rejeitar Documento"
          onCancel={() => { setRejeitarOpen(false); setComentarioRejeitar(''); }}
          onConfirm={() => rejeitarMutation.mutate()}
          isPending={rejeitarMutation.isPending}
          confirmLabel="Confirmar Rejeição"
          confirmColor="var(--nc)"
          disabled={comentarioRejeitar.trim().length < 10}
        >
          <p style={{ fontSize: '14px', color: 'var(--text-mid)', marginBottom: '12px' }}>
            Informe o motivo da rejeição (mínimo 10 caracteres):
          </p>
          <textarea
            value={comentarioRejeitar}
            onChange={(e) => setComentarioRejeitar(e.target.value)}
            placeholder="Descreva o motivo da rejeição..."
            rows={4}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: `1px solid ${comentarioRejeitar.trim().length > 0 && comentarioRejeitar.trim().length < 10 ? 'var(--nc)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--text-high)',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          {comentarioRejeitar.trim().length > 0 && comentarioRejeitar.trim().length < 10 && (
            <p style={{ fontSize: '12px', color: 'var(--nc)', marginTop: '4px' }}>
              Mínimo de 10 caracteres ({comentarioRejeitar.trim().length}/10)
            </p>
          )}
        </ModalConfirm>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function MetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}
    >
      {children}
    </div>
  );
}

function MetaItem({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', color: warn ? 'var(--nc)' : 'var(--text-high)', fontWeight: 500 }}>
        {value}
      </p>
    </div>
  );
}

function ModalConfirm({
  title,
  children,
  onCancel,
  onConfirm,
  isPending,
  confirmLabel,
  confirmColor,
  disabled = false,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
  confirmLabel: string;
  confirmColor: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onCancel();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-high)',
          }}
        >
          {title}
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '9px 18px',
              cursor: isPending ? 'not-allowed' : 'pointer',
              color: 'var(--text-mid)',
              fontSize: '14px',
              opacity: isPending ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || disabled}
            style={{
              background: confirmColor,
              border: 'none',
              borderRadius: '8px',
              padding: '9px 20px',
              cursor: isPending || disabled ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              opacity: isPending || disabled ? 0.6 : 1,
            }}
          >
            {isPending ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
