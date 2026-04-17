import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obrasService, type ObraLocal } from '../../services/obras.service';
import { FileText, BookOpenCheck } from 'lucide-react';
import { EditarObraModal } from './EditarObraModal';
import { useModelosByObra, useDesvincularModeloObra, useVincularModeloObra, useModelos } from '../../modules/fvs/modelos/hooks/useModelos';
import { useAppShell } from '../../components/layout/useAppShell';

const STATUS_OBRA_LABEL: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_EXECUCAO: 'Em Execução',
  PARALISADA: 'Paralisada',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
};

const STATUS_OBRA_COLOR: Record<string, string> = {
  PLANEJAMENTO: '#6b7280',
  EM_EXECUCAO:  '#22c55e',
  PARALISADA:   '#f59e0b',
  CONCLUIDA:    '#a78bfa',
  ENTREGUE:     '#38bdf8',
};

export function ObraDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id!);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setObraAtivaId } = useAppShell();

  useEffect(() => {
    setObraAtivaId(obraId);
    return () => setObraAtivaId(null);
  }, [obraId]);

  const [parentIdAtivo, setParentIdAtivo] = useState<number | null | undefined>(null);
  const [breadcrumb, setBreadcrumb] = useState<ObraLocal[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [gerandoMassa, setGerandoMassa] = useState(false);
  const [prefixoMassa, setPrefixoMassa] = useState('');
  const [quantidadeMassa, setQuantidadeMassa] = useState(5);
  const [busca, setBusca] = useState('');

  const { data: obra, isLoading: obraCarregando } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => obrasService.getById(obraId),
  });

  const buscaAtiva = busca.trim().length >= 2;
  const { data: locais = [], isLoading: locaisCarregando } = useQuery({
    queryKey: ['obra-locais', obraId, buscaAtiva ? null : parentIdAtivo, busca],
    queryFn: () => buscaAtiva
      ? obrasService.getLocais(obraId, { search: busca.trim() })
      : obrasService.getLocais(obraId, { parentId: parentIdAtivo }),
    enabled: !!obra,
  });

  const { data: qualityConfig, refetch: refetchQuality } = useQuery({
    queryKey: ['obra-quality-config', obraId],
    queryFn: () => obrasService.getQualityConfig(obraId),
    enabled: !!obra,
  });

  const nivelAtual = breadcrumb.length + 1;
  const totalNiveis = (obra?.obraTipo as { id: number; nome: string; slug: string; totalNiveis?: number } | undefined)?.totalNiveis ?? 3;
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

  const duplicarLocalMutation = useMutation({
    mutationFn: (localId: number) => obrasService.duplicarLocal(obraId, localId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
    },
  });

  const renomearLocalMutation = useMutation({
    mutationFn: ({ localId, nome }: { localId: number; nome: string }) =>
      obrasService.updateLocal(obraId, localId, { nome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
    },
  });

  const reordenarLocalMutation = useMutation({
    mutationFn: (updates: { localId: number; ordem: number }[]) =>
      Promise.all(updates.map(({ localId, ordem }) => obrasService.updateLocal(obraId, localId, { ordem }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
    },
  });

  const atualizarLocalMutation = useMutation({
    mutationFn: ({ localId, ...payload }: { localId: number; status?: string; dataInicioPrevista?: string; dataFimPrevista?: string }) =>
      obrasService.updateLocal(obraId, localId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
    },
  });

  const [abaAtiva, setAbaAtiva] = useState<'locais' | 'templates' | 'qualidade'>('locais');
  const [editandoObra, setEditandoObra] = useState(false);
  const [modeloParaVincular, setModeloParaVincular] = useState<number | null>(null);

  const [editandoHierarquia, setEditandoHierarquia] = useState(false);
  const [niveisEditados, setNiveisEditados] = useState<
    { nivel: number; labelSingular: string; labelPlural: string }[]
  >([]);

  const [qualityForm, setQualityForm] = useState<{
    modoQualidade: 'SIMPLES' | 'PBQPH';
    slaAprovacaoHoras: number;
    exigeAssinaturaFVS: boolean;
    exigeAssinaturaDiario: boolean;
  } | null>(null);

  const salvarQualityMutation = useMutation({
    mutationFn: () => obrasService.upsertQualityConfig(obraId, qualityForm!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra-quality-config', obraId] });
      refetchQuality();
    },
  });

  const salvarHierarquiaMutation = useMutation({
    mutationFn: () => obrasService.saveNiveisConfig(obraId, niveisEditados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
      setEditandoHierarquia(false);
    },
  });

  const abrirEditarHierarquia = () => {
    setNiveisEditados(
      (obra?.niveisConfig ?? []).map((n) => ({
        nivel: n.nivel,
        labelSingular: n.labelSingular,
        labelPlural: n.labelPlural,
      })),
    );
    setEditandoHierarquia(true);
  };

  const { data: modelosVinculados = [] } = useModelosByObra(obraId);
  const { data: todosModelos = [] } = useModelos({ status: 'concluido' });
  const vincularModelo = useVincularModeloObra();
  const desvincularModelo = useDesvincularModeloObra();

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
          background: 'var(--accent)',
          border: 'none',
          color: 'var(--accent-fg)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          padding: '7px 14px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
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
            <span style={{ fontSize: '12px', color: STATUS_OBRA_COLOR[obra.status] ?? 'var(--text-60)' }}>
              ● {STATUS_OBRA_LABEL[obra.status] ?? obra.status}
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{obra.nome}</h1>
          <p style={{ color: 'var(--text-60)', fontSize: '14px', marginTop: '4px' }}>
            {obra.obraTipo.nome}
            {obra.cidade && ` · ${obra.cidade}${obra.estado ? `/${obra.estado}` : ''}`}
          </p>
        </div>
        <button
          onClick={() => setEditandoObra(true)}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
            padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Editar
        </button>
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

      {/* Card Diário de Obra */}
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
        onClick={() => navigate(`/obras/${obraId}/diario`)}
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
            <BookOpenCheck size={18} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-100)', margin: 0 }}>
              Diário de Obra (RDO)
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-60)', margin: 0, marginTop: '2px' }}>
              Relatórios diários, clima, equipe, atividades e aprovações
            </p>
          </div>
        </div>
        <span style={{ fontSize: '18px', color: 'var(--text-40)' }}>›</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid var(--bg-border)' }}>
        {([
          { key: 'locais', label: 'Locais de Inspeção' },
          { key: 'templates', label: 'Templates FVS' },
          { key: 'qualidade', label: 'Qualidade' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAbaAtiva(key)}
            style={{
              background: 'none', border: 'none', padding: '8px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: abaAtiva === key ? 700 : 400,
              color: abaAtiva === key ? 'var(--accent)' : 'var(--text-60)',
              borderBottom: abaAtiva === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Hierarquia de locais */}
      {abaAtiva === 'locais' && <div
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

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar local..."
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)', padding: '7px 12px',
                color: 'var(--text-100)', fontSize: '13px', outline: 'none',
                width: '180px',
              }}
            />
            <button
              onClick={abrirEditarHierarquia}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
                padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
              }}
              title="Renomear níveis de hierarquia"
            >
              Hierarquia
            </button>
            {nivelAtual <= totalNiveis && (
              <>
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
                    color: 'var(--accent-fg)', borderRadius: 'var(--radius-md)',
                    padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  }}
                >
                  + {labelNivel}
                </button>
              </>
            )}
          </div>
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
                  background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)',
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
                  background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)',
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
                onRenomear={(nome) => renomearLocalMutation.mutate({ localId: local.id, nome })}
                onAlterarStatus={(status) => atualizarLocalMutation.mutate({ localId: local.id, status })}
                onAlterarDatas={(datas) => atualizarLocalMutation.mutate({ localId: local.id, ...datas })}
                podeSubir={i > 0}
                podeDescer={i < locais.length - 1}
                onSubir={() => {
                  const acima = locais[i - 1];
                  reordenarLocalMutation.mutate([
                    { localId: local.id, ordem: acima.ordem },
                    { localId: acima.id, ordem: local.ordem },
                  ]);
                }}
                onDescer={() => {
                  const abaixo = locais[i + 1];
                  reordenarLocalMutation.mutate([
                    { localId: local.id, ordem: abaixo.ordem },
                    { localId: abaixo.id, ordem: local.ordem },
                  ]);
                }}
                podeDuplicar={nivelAtual === 1}
                onDuplicar={() => duplicarLocalMutation.mutate(local.id)}
              />
            ))}
          </div>
        )}
      </div>}

      {editandoObra && (
        <EditarObraModal obra={obra} onClose={() => setEditandoObra(false)} />
      )}

      {editandoHierarquia && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditandoHierarquia(false); }}
        >
          <div
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)', padding: '28px',
              width: '480px', maxWidth: '95vw',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
              Configurar Hierarquia de Locais
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-60)', marginBottom: '20px' }}>
              Renomeie os rótulos dos níveis de hierarquia desta obra.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {niveisEditados.map((n, i) => (
                <div key={n.nivel} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 600, color: 'var(--text-60)',
                  }}>
                    {n.nivel}
                  </span>
                  <input
                    value={n.labelSingular}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNiveisEditados((prev) =>
                        prev.map((x, j) => j === i ? { ...x, labelSingular: val, labelPlural: val } : x),
                      );
                    }}
                    placeholder={`Nome do nível ${n.nivel} — ex: Torre, Pavimento, Apartamento`}
                    style={{
                      flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)', padding: '9px 12px',
                      color: 'var(--text-100)', fontSize: '14px', outline: 'none',
                    }}
                    autoFocus={i === 0}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditandoHierarquia(false)}
                style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                  color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
                  padding: '9px 18px', cursor: 'pointer', fontSize: '14px',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => salvarHierarquiaMutation.mutate()}
                disabled={
                  salvarHierarquiaMutation.isPending ||
                  niveisEditados.some((n) => !n.labelSingular.trim())
                }
                style={{
                  background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
                  borderRadius: 'var(--radius-md)', padding: '9px 20px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                }}
              >
                {salvarHierarquiaMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'qualidade' && (
        <QualityConfigSection
          config={qualityConfig}
          form={qualityForm}
          onFormChange={setQualityForm}
          onSalvar={() => salvarQualityMutation.mutate()}
          salvando={salvarQualityMutation.isPending}
        />
      )}

      {abaAtiva === 'templates' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select
              value={modeloParaVincular ?? ''}
              onChange={e => setModeloParaVincular(parseInt(e.target.value) || null)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--bg-border)', fontSize: 13, flex: 1 }}
            >
              <option value="">Selecionar template para vincular...</option>
              {todosModelos
                .filter(m => !modelosVinculados.find(mv => mv.modelo_id === m.id))
                .map(m => <option key={m.id} value={m.id}>{m.nome} (v{m.versao})</option>)}
            </select>
            <button
              onClick={async () => {
                if (!modeloParaVincular) return;
                await vincularModelo.mutateAsync({ obraId, modeloId: modeloParaVincular });
                setModeloParaVincular(null);
              }}
              disabled={!modeloParaVincular}
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
            >
              Vincular
            </button>
          </div>

          {modelosVinculados.length === 0 ? (
            <p style={{ color: 'var(--text-60)', fontSize: 13 }}>Nenhum template vinculado a esta obra.</p>
          ) : (
            <div style={{ border: '1px solid var(--bg-border)', borderRadius: 8, overflow: 'hidden' }}>
              {modelosVinculados.map((mv, i) => (
                <div key={mv.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px', borderBottom: i < modelosVinculados.length - 1 ? '1px solid var(--bg-surface)' : undefined,
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{mv.modelo_nome}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-60)' }}>
                      {mv.fichas_count} ficha(s) criada(s) com este template nesta obra
                    </p>
                  </div>
                  <button
                    onClick={() => desvincularModelo.mutateAsync({ obraId, modeloId: mv.modelo_id })}
                    style={{ background: 'transparent', color: 'var(--status-error)', border: '1px solid var(--status-error)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                  >
                    Desvincular
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LOCAL_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente', EM_EXECUCAO: 'Em Execução', CONCLUIDO: 'Concluído',
  ENTREGUE: 'Entregue', SUSPENSO: 'Suspenso',
};
const STATUS_LOCAL_COLOR: Record<string, string> = {
  PENDENTE:    'var(--text-40)',
  EM_EXECUCAO: 'var(--ok)',
  CONCLUIDO:   'var(--accent)',
  ENTREGUE:    'var(--run)',
  SUSPENSO:    'var(--warn)',
};


function QualityConfigSection({ config, form, onFormChange, onSalvar, salvando }: {
  config: any;
  form: { modoQualidade: 'SIMPLES' | 'PBQPH'; slaAprovacaoHoras: number; exigeAssinaturaFVS: boolean; exigeAssinaturaDiario: boolean } | null;
  onFormChange: (f: any) => void;
  onSalvar: () => void;
  salvando: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
    borderRadius: 'var(--radius-md)', padding: '8px 10px',
    color: 'var(--text-100)', fontSize: '13px', outline: 'none', width: '100%',
  };

  const current = form ?? {
    modoQualidade: config?.modoQualidade ?? 'SIMPLES',
    slaAprovacaoHoras: config?.slaAprovacaoHoras ?? 48,
    exigeAssinaturaFVS: config?.exigeAssinaturaFVS ?? false,
    exigeAssinaturaDiario: config?.exigeAssinaturaDiario ?? false,
  };

  const set = (key: string, val: any) => onFormChange({ ...current, [key]: val });

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
      borderRadius: 'var(--radius-lg)', padding: '28px', maxWidth: '560px',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Configurações de Qualidade</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>
            Modo de qualidade
          </label>
          <select value={current.modoQualidade} onChange={(e) => set('modoQualidade', e.target.value)} style={inputStyle}>
            <option value="SIMPLES">Simples</option>
            <option value="PBQPH">PBQP-H</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>
            SLA de aprovação (horas)
          </label>
          <input
            type="number" min={1} max={720}
            value={current.slaAprovacaoHoras}
            onChange={(e) => set('slaAprovacaoHoras', parseInt(e.target.value) || 48)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={current.exigeAssinaturaFVS}
              onChange={(e) => set('exigeAssinaturaFVS', e.target.checked)}
            />
            Exige assinatura nas FVS
          </label>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={current.exigeAssinaturaDiario}
              onChange={(e) => set('exigeAssinaturaDiario', e.target.checked)}
            />
            Exige assinatura no Diário de Obra
          </label>
        </div>

        <button
          onClick={onSalvar}
          disabled={salvando}
          style={{
            background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)',
            borderRadius: 'var(--radius-md)', padding: '10px 20px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            alignSelf: 'flex-start', marginTop: '4px',
          }}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
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
  onRenomear,
  onAlterarStatus,
  onAlterarDatas,
  podeSubir,
  podeDescer,
  onSubir,
  onDescer,
  podeDuplicar,
  onDuplicar,
}: {
  local: ObraLocal;
  isLast: boolean;
  podeEntrar: boolean;
  onEntrar: () => void;
  onRemover: () => void;
  onRenomear: (nome: string) => void;
  onAlterarStatus: (status: string) => void;
  onAlterarDatas: (datas: { dataInicioPrevista?: string; dataFimPrevista?: string }) => void;
  podeSubir: boolean;
  podeDescer: boolean;
  onSubir: () => void;
  onDescer: () => void;
  podeDuplicar?: boolean;
  onDuplicar?: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(local.nome);
  const [expandDatas, setExpandDatas] = useState(false);
  const [dataInicio, setDataInicio] = useState(local.dataInicioPrevista?.slice(0, 10) ?? '');
  const [dataFim, setDataFim] = useState(local.dataFimPrevista?.slice(0, 10) ?? '');

  const confirmarRename = () => {
    const trimmed = nomeEdit.trim();
    if (trimmed && trimmed !== local.nome) onRenomear(trimmed);
    setEditando(false);
  };

  if (editando) {
    return (
      <div
        style={{
          padding: '10px 20px',
          borderBottom: isLast ? 'none' : '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-surface)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-40)', minWidth: '100px' }}>
          {local.codigo}
        </span>
        <input
          autoFocus
          value={nomeEdit}
          onChange={(e) => setNomeEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarRename();
            if (e.key === 'Escape') { setNomeEdit(local.nome); setEditando(false); }
          }}
          style={{
            flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px',
            color: 'var(--text-100)', fontSize: '14px', outline: 'none',
          }}
        />
        <button onClick={confirmarRename}
          style={{
            background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)',
            borderRadius: 'var(--radius-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '13px',
          }}>
          OK
        </button>
        <button onClick={() => { setNomeEdit(local.nome); setEditando(false); }}
          style={{
            background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-60)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', fontSize: '13px',
          }}>
          ✕
        </button>
      </div>
    );
  }

  const temDatas = !!(local.dataInicioPrevista || local.dataFimPrevista);

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--bg-border)' }}>
      {/* Linha principal */}
      <div
        style={{
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: podeEntrar ? 'pointer' : 'default',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => { if (podeEntrar) e.currentTarget.style.background = 'var(--bg-surface)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        onClick={podeEntrar ? onEntrar : undefined}
      >
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-40)', minWidth: '96px' }}>
          {local.codigo}
        </span>
        <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-100)' }}>
          {local.nome}
        </span>

        {/* Selector de status */}
        <select
          value={local.status ?? 'PENDENTE'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onAlterarStatus(e.target.value); }}
          style={{
            fontSize: '11px', padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${STATUS_LOCAL_COLOR[local.status ?? 'PENDENTE']}40`,
            background: 'var(--bg-surface)',
            color: STATUS_LOCAL_COLOR[local.status ?? 'PENDENTE'] ?? 'var(--text-60)',
            cursor: 'pointer', outline: 'none',
            fontWeight: 600,
          }}
        >
          {Object.entries(STATUS_LOCAL_LABEL).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>

        {/* Datas toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpandDatas((v) => !v); }}
          title={temDatas ? 'Ver/editar datas' : 'Definir datas'}
          style={{
            background: 'transparent', border: 'none',
            color: temDatas ? 'var(--accent)' : 'var(--text-40)',
            cursor: 'pointer', fontSize: '13px', padding: '0 3px', opacity: temDatas ? 1 : 0.5,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = temDatas ? '1' : '0.5')}
        >
          📅
        </button>

        {/* Bloquear/desbloquear */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAlterarStatus(local.status === 'bloqueado' ? 'PENDENTE' : 'bloqueado');
          }}
          title={local.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear inspeções neste local'}
          style={{
            background: local.status === 'bloqueado' ? 'var(--nc-bg)' : 'transparent',
            border: local.status === 'bloqueado' ? '1px solid var(--nc-border)' : 'none',
            color: local.status === 'bloqueado' ? 'var(--nc-text)' : 'var(--text-40)',
            cursor: 'pointer', fontSize: '13px', padding: '2px 5px',
            borderRadius: 'var(--radius-sm)',
            opacity: local.status === 'bloqueado' ? 1 : 0.5,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = local.status === 'bloqueado' ? '1' : '0.5';
          }}
        >
          {local.status === 'bloqueado' ? '🔒' : '🔓'}
        </button>

        {/* Duplicar (nível 1 = torre) */}
        {podeDuplicar && (
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicar?.(); }}
            title="Duplicar (copia este nível com todos os subitens)"
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-40)', cursor: 'pointer',
              fontSize: '13px', padding: '0 4px', opacity: 0.5,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
          >
            ⊕
          </button>
        )}

        {local.totalFilhos > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-60)' }}>
            {local.totalFilhos} sub{local.totalFilhos !== 1 ? 'itens' : 'item'}
          </span>
        )}
        {podeEntrar && <span style={{ fontSize: '14px', color: 'var(--text-40)' }}>›</span>}

        {/* Reordenar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <button onClick={(e) => { e.stopPropagation(); if (podeSubir) onSubir(); }} disabled={!podeSubir}
            style={{ background: 'none', border: 'none', padding: '1px 4px', cursor: podeSubir ? 'pointer' : 'default', color: podeSubir ? 'var(--text-40)' : 'transparent', fontSize: '10px', lineHeight: 1 }} title="Mover para cima">▲</button>
          <button onClick={(e) => { e.stopPropagation(); if (podeDescer) onDescer(); }} disabled={!podeDescer}
            style={{ background: 'none', border: 'none', padding: '1px 4px', cursor: podeDescer ? 'pointer' : 'default', color: podeDescer ? 'var(--text-40)' : 'transparent', fontSize: '10px', lineHeight: 1 }} title="Mover para baixo">▼</button>
        </div>

        {/* Renomear */}
        <button onClick={(e) => { e.stopPropagation(); setEditando(true); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-40)', cursor: 'pointer', fontSize: '13px', padding: '0 4px', opacity: 0.5 }}
          title="Renomear"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}>✎</button>

        {/* Remover */}
        <button onClick={(e) => { e.stopPropagation(); onRemover(); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-40)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', opacity: 0.5 }}
          title="Remover"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}>×</button>
      </div>

      {/* Painel de datas (expansível) */}
      {expandDatas && (
        <div style={{
          padding: '10px 20px 12px 116px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <label style={{ fontSize: '12px', color: 'var(--text-60)' }}>Início:</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 8px',
              color: 'var(--text-100)', fontSize: '13px', outline: 'none',
            }}
          />
          <label style={{ fontSize: '12px', color: 'var(--text-60)' }}>Término:</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 8px',
              color: 'var(--text-100)', fontSize: '13px', outline: 'none',
            }}
          />
          <button
            onClick={() => {
              onAlterarDatas({
                dataInicioPrevista: dataInicio || undefined,
                dataFimPrevista: dataFim || undefined,
              });
              setExpandDatas(false);
            }}
            style={{
              background: 'var(--accent)', border: 'none', color: 'var(--accent-fg)',
              borderRadius: 'var(--radius-sm)', padding: '4px 12px',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            Salvar
          </button>
          <button
            onClick={() => { setDataInicio(local.dataInicioPrevista?.slice(0,10) ?? ''); setDataFim(local.dataFimPrevista?.slice(0,10) ?? ''); setExpandDatas(false); }}
            style={{
              background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-60)',
              borderRadius: 'var(--radius-sm)', padding: '4px 10px',
              cursor: 'pointer', fontSize: '12px',
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
