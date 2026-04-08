import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obrasService, type ObraLocal } from '../../services/obras.service';
import { FileText } from 'lucide-react';

const STATUS_OBRA_LABEL: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_EXECUCAO: 'Em Execução',
  PARALISADA: 'Paralisada',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
};

export function ObraDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id!);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [parentIdAtivo, setParentIdAtivo] = useState<number | null | undefined>(null);
  const [breadcrumb, setBreadcrumb] = useState<ObraLocal[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [gerandoMassa, setGerandoMassa] = useState(false);
  const [prefixoMassa, setPrefixoMassa] = useState('');
  const [quantidadeMassa, setQuantidadeMassa] = useState(5);

  const { data: obra, isLoading: obraCarregando } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => obrasService.getById(obraId),
  });

  const { data: locais = [], isLoading: locaisCarregando } = useQuery({
    queryKey: ['obra-locais', obraId, parentIdAtivo],
    queryFn: () => obrasService.getLocais(obraId, { parentId: parentIdAtivo }),
    enabled: !!obra,
  });

  const nivelAtual = breadcrumb.length + 1;
  const totalNiveis = obra?.obraTipo?.totalNiveis ?? 3;
  const labelNivel = obra?.niveisConfig?.find((n) => n.nivel === nivelAtual)?.labelSingular ?? `Nível ${nivelAtual}`;

  const criarLocalMutation = useMutation({
    mutationFn: () =>
      obrasService.createLocal(obraId, {
        parentId: parentIdAtivo ?? undefined,
        nivel: nivelAtual,
        nome: novoNome,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
      setNovoNome('');
      setAdicionando(false);
    },
  });

  const gerarMassaMutation = useMutation({
    mutationFn: () =>
      obrasService.gerarMassa(obraId, {
        parentId: parentIdAtivo ?? undefined,
        nivel: nivelAtual,
        prefixo: prefixoMassa,
        quantidade: quantidadeMassa,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
      setGerandoMassa(false);
      setPrefixoMassa('');
    },
  });

  const removerLocalMutation = useMutation({
    mutationFn: (localId: number) => obrasService.removeLocal(obraId, localId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
    },
  });

  const entrarLocal = (local: ObraLocal) => {
    setBreadcrumb((prev) => [...prev, local]);
    setParentIdAtivo(local.id);
  };

  const voltarBreadcrumb = (idx: number) => {
    const novoBread = breadcrumb.slice(0, idx);
    setBreadcrumb(novoBread);
    setParentIdAtivo(novoBread.length > 0 ? novoBread[novoBread.length - 1].id : null);
  };

  if (obraCarregando) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-60)' }}>
        Carregando obra...
      </div>
    );
  }

  if (!obra) return null;

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Cabeçalho */}
      <button
        onClick={() => navigate('/obras')}
        style={{
          background: 'none', border: 'none', color: 'var(--text-60)',
          cursor: 'pointer', fontSize: '14px', marginBottom: '20px',
        }}
      >
        ← Obras
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--text-40)' }}>
              {obra.codigo}
            </span>
            {obra.modoQualidade === 'PBQPH' && (
              <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)' }}>
                PBQP-H
              </span>
            )}
            <span style={{ fontSize: '12px', color: 'var(--status-success)' }}>
              ● {STATUS_OBRA_LABEL[obra.status] ?? obra.status}
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{obra.nome}</h1>
          <p style={{ color: 'var(--text-60)', fontSize: '14px', marginTop: '4px' }}>
            {obra.obraTipo.nome}
            {obra.cidade && ` · ${obra.cidade}${obra.estado ? `/${obra.estado}` : ''}`}
          </p>
        </div>
      </div>

      {/* Card GED */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => navigate(`/obras/${obraId}/ged`)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileText size={18} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-100)', margin: 0 }}>
              GED — Gestão Eletrônica de Documentos
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-60)', margin: 0, marginTop: '2px' }}>
              Documentos, lista mestra, workflows de aprovação
            </p>
          </div>
        </div>
        <span style={{ fontSize: '18px', color: 'var(--text-40)' }}>›</span>
      </div>

      {/* Hierarquia de locais */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header da seção */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
              {labelNivel}s
            </h2>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '13px' }}>
              <button
                onClick={() => voltarBreadcrumb(0)}
                style={{ background: 'none', border: 'none', color: 'var(--text-60)', cursor: 'pointer', padding: 0 }}
              >
                {obra.nome}
              </button>
              {breadcrumb.map((b, i) => (
                <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: 'var(--text-40)' }}>/</span>
                  <button
                    onClick={() => voltarBreadcrumb(i + 1)}
                    style={{ background: 'none', border: 'none', color: i === breadcrumb.length - 1 ? 'var(--accent)' : 'var(--text-60)', cursor: 'pointer', padding: 0 }}
                  >
                    {b.nome}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {nivelAtual <= totalNiveis && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setGerandoMassa(true)}
                style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                  color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
                  padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
                }}
              >
                Gerar em massa
              </button>
              <button
                onClick={() => setAdicionando(true)}
                style={{
                  background: 'var(--accent)', border: 'none',
                  color: '#000', borderRadius: 'var(--radius-md)',
                  padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                }}
              >
                + {labelNivel}
              </button>
            </div>
          )}
        </div>

        {/* Formulário inline para adicionar */}
        {adicionando && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                autoFocus
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && novoNome.trim() && criarLocalMutation.mutate()}
                placeholder={`Nome do ${labelNivel.toLowerCase()}...`}
                style={{
                  flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius-md)', padding: '8px 12px',
                  color: 'var(--text-100)', fontSize: '14px', outline: 'none',
                }}
              />
              <button
                onClick={() => novoNome.trim() && criarLocalMutation.mutate()}
                disabled={!novoNome.trim() || criarLocalMutation.isPending}
                style={{
                  background: 'var(--accent)', border: 'none', color: '#000',
                  borderRadius: 'var(--radius-md)', padding: '8px 14px', cursor: 'pointer',
                }}
              >
                Salvar
              </button>
              <button
                onClick={() => { setAdicionando(false); setNovoNome(''); }}
                style={{
                  background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-60)',
                  borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Formulário de geração em massa */}
        {gerandoMassa && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                autoFocus
                value={prefixoMassa}
                onChange={(e) => setPrefixoMassa(e.target.value)}
                placeholder={`Prefixo (ex: ${labelNivel})`}
                style={{
                  width: '200px', background: 'var(--bg-elevated)', border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius-md)', padding: '8px 12px',
                  color: 'var(--text-100)', fontSize: '14px', outline: 'none',
                }}
              />
              <input
                type="number"
                min={1}
                max={500}
                value={quantidadeMassa}
                onChange={(e) => setQuantidadeMassa(parseInt(e.target.value) || 1)}
                style={{
                  width: '100px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius-md)', padding: '8px 12px',
                  color: 'var(--text-100)', fontSize: '14px', outline: 'none',
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-60)' }}>
                {prefixoMassa && quantidadeMassa > 0 && `→ ${prefixoMassa} 01 ... ${prefixoMassa} ${String(quantidadeMassa).padStart(2, '0')}`}
              </span>
              <button
                onClick={() => prefixoMassa.trim() && gerarMassaMutation.mutate()}
                disabled={!prefixoMassa.trim() || gerarMassaMutation.isPending}
                style={{
                  background: 'var(--accent)', border: 'none', color: '#000',
                  borderRadius: 'var(--radius-md)', padding: '8px 14px', cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                {gerarMassaMutation.isPending ? 'Gerando...' : 'Gerar'}
              </button>
              <button
                onClick={() => setGerandoMassa(false)}
                style={{
                  background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-60)',
                  borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de locais */}
        {locaisCarregando ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-60)' }}>
            Carregando...
          </div>
        ) : locais.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-60)' }}>
            <p style={{ marginBottom: '12px' }}>Nenhum {labelNivel.toLowerCase()} cadastrado</p>
            <button
              onClick={() => setAdicionando(true)}
              style={{
                background: 'transparent', border: '1px dashed var(--bg-border)',
                color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
                padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
              }}
            >
              + Adicionar {labelNivel.toLowerCase()}
            </button>
          </div>
        ) : (
          <div>
            {locais.map((local, i) => (
              <LocalRow
                key={local.id}
                local={local}
                isLast={i === locais.length - 1}
                podeEntrar={nivelAtual < totalNiveis}
                onEntrar={() => entrarLocal(local)}
                onRemover={() => removerLocalMutation.mutate(local.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LocalRow({
  local,
  isLast,
  podeEntrar,
  onEntrar,
  onRemover,
}: {
  local: ObraLocal;
  isLast: boolean;
  podeEntrar: boolean;
  onEntrar: () => void;
  onRemover: () => void;
}) {
  return (
    <div
      style={{
        padding: '14px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--bg-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: podeEntrar ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (podeEntrar) e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={podeEntrar ? onEntrar : undefined}
    >
      <span
        style={{
          fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-40)',
          minWidth: '100px',
        }}
      >
        {local.codigo}
      </span>
      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-100)' }}>
        {local.nome}
      </span>
      {local.totalFilhos > 0 && (
        <span style={{ fontSize: '12px', color: 'var(--text-60)' }}>
          {local.totalFilhos} sub{local.totalFilhos !== 1 ? 'itens' : 'item'}
        </span>
      )}
      {podeEntrar && (
        <span style={{ fontSize: '14px', color: 'var(--text-40)' }}>›</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemover(); }}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-40)',
          cursor: 'pointer', fontSize: '16px', padding: '0 4px',
          opacity: 0.5,
        }}
        title="Remover"
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
      >
        ×
      </button>
    </div>
  );
}
