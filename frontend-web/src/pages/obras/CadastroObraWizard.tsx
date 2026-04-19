import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { obrasService, type ObraTipo, type Obra, type EstrategiaGeracao } from '../../services/obras.service';
import { EdificacaoForm, type EdificacaoPayload } from './estrategias/EdificacaoForm';
import { LinearForm, type LinearPayload } from './estrategias/LinearForm';
import { InstalacaoForm, type InstalacaoPayload } from './estrategias/InstalacaoForm';
import { GenericaForm, type GenericaPayload } from './estrategias/GenericaForm';

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────

interface NivelConfig {
  nivel: number;
  labelSingular: string;
  labelPlural: string;
}

interface WizardState {
  // Etapa 1
  nome: string;
  obraTipoId: number | null;
  modoQualidade: 'SIMPLES' | 'PBQPH';
  // Etapa 2
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  dataInicioPrevista: string;
  dataFimPrevista: string;
  // Etapa 3
  totalNiveis: number | null; // null = ainda não escolheu
  niveisConfig: NivelConfig[];
  // Etapa 4
  gerarLocais: boolean;
  nivel: number;
  prefixo: string;
  quantidade: number;
}

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

const ETAPAS = ['Identificação', 'Localização', 'Hierarquia', 'Gerar Locais'];

// ─────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────

export function CadastroObraWizard() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(0);
  const [obraCriada, setObraCriada] = useState<Obra | null>(null);
  const [erro, setErro] = useState('');
  const [fotoCapa, setFotoCapa] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [estrategia, setEstrategia] = useState<EstrategiaGeracao | null>(null);

  const [genericaPayload, setGenericaPayload] = useState<GenericaPayload>({
    niveis: [{ nivel: 1, prefixo: '', qtde: 1 }],
  });

  const [edificacaoPayload, setEdificacaoPayload] = useState<EdificacaoPayload>({
    condominios: 1, condInicio: 1, blocos: 1, blocoLabel: 'letra',
    andarQtd: 10, andarInicio: 1, unidadesPorAndar: 4,
    modoUnidade: 'andar', areasComuns: [], areasGlobais: [],
  });

  const [linearPayload, setLinearPayload] = useState<LinearPayload>({
    trechos: [{ id: crypto.randomUUID(), nome: '', kmInicio: 0, kmFim: 5, intervaloKm: 0.5, elementoLabel: 'PV' }],
  });

  const [instalacaoPayload, setInstalacaoPayload] = useState<InstalacaoPayload>({
    areas: [{ id: crypto.randomUUID(), nome: '', modulosQtde: 1, modulosNomes: [], modoModulo: 'qtde' }],
  });

  const [state, setState] = useState<WizardState>({
    nome: '',
    obraTipoId: null,
    modoQualidade: 'SIMPLES',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    dataInicioPrevista: '',
    dataFimPrevista: '',
    totalNiveis: null,
    niveisConfig: [],
    gerarLocais: false,
    nivel: 2,
    prefixo: '',
    quantidade: 1,
  });

  const { data: tipos = [], isLoading: tiposLoading, isError: tiposError, refetch: tiposRefetch } = useQuery<ObraTipo[]>({
    queryKey: ['obra-tipos'],
    queryFn: () => obrasService.getTipos(),
  });

  const criarObraMutation = useMutation({
    mutationFn: () =>
      obrasService.create({
        nome: state.nome,
        obraTipoId: state.obraTipoId!,
        modoQualidade: state.modoQualidade,
        endereco: state.endereco || undefined,
        cidade: state.cidade || undefined,
        estado: state.estado || undefined,
        cep: state.cep || undefined,
        dataInicioPrevista: state.dataInicioPrevista || undefined,
        dataFimPrevista: state.dataFimPrevista || undefined,
      }),
    onSuccess: async (res) => {
      setObraCriada(res.obra);
      if (fotoCapa) {
        await uploadFotoMutation.mutateAsync(res.obra.id).catch(() => {});
      }
      setEtapa(2);
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao criar obra');
    },
  });

  const uploadFotoMutation = useMutation({
    mutationFn: (obraId: number) => obrasService.uploadFotoCapa(obraId, fotoCapa!),
    onError: () => {
      setErro('Foto não pôde ser enviada. Continue sem ela ou tente no modal de edição.');
    },
  });

  const salvarNiveisMutation = useMutation({
    mutationFn: () =>
      obrasService.saveNiveisConfig(obraCriada!.id, state.niveisConfig),
    onSuccess: () => {
      setEtapa(3);
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao salvar hierarquia');
    },
  });

  const gerarCascataGenericaMutation = useMutation({
    mutationFn: () =>
      obrasService.gerarCascata(obraCriada!.id, 'generica', {
        niveis: genericaPayload.niveis.map((n) => ({
          nivel: n.nivel,
          qtde: n.qtde,
          prefixo: n.prefixo,
        })),
      }),
    onSuccess: () => {
      navigate(`/obras/${obraCriada!.id}`);
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao gerar locais em cascata');
    },
  });

  const gerarCascataEdificacaoMutation = useMutation({
    mutationFn: () => obrasService.gerarCascata(obraCriada!.id, 'edificacao', edificacaoPayload),
    onSuccess: () => navigate(`/obras/${obraCriada!.id}`),
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao gerar locais'),
  });

  const gerarCascataLinearMutation = useMutation({
    mutationFn: () => obrasService.gerarCascata(obraCriada!.id, 'linear', {
      trechos: linearPayload.trechos.map(({ id: _id, ...t }) => t),
    }),
    onSuccess: () => navigate(`/obras/${obraCriada!.id}`),
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao gerar locais'),
  });

  const gerarCascataInstalacaoMutation = useMutation({
    mutationFn: () =>
      obrasService.gerarCascata(obraCriada!.id, 'instalacao', {
        areas: instalacaoPayload.areas.map((a) => ({
          nome: a.nome,
          modulos: a.modoModulo === 'qtde' ? a.modulosQtde : a.modulosNomes,
        })),
      }),
    onSuccess: () => navigate(`/obras/${obraCriada!.id}`),
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao gerar locais'),
  });

  const tipoSelecionado = tipos.find((t) => t.id === state.obraTipoId);

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setErro('');
  };

  // ─── Validações por etapa ───────────────

  const podeAvancarEtapa0 = state.nome.trim().length >= 2 && state.obraTipoId !== null;

  const handleAvancarEtapa0 = () => {
    if (!podeAvancarEtapa0) return;
    // Define totalNiveis sugerido pelo tipo; niveisConfig ainda vazio (preenchido ao selecionar qty)
    const sugestao = tipoSelecionado?.totalNiveis ?? null;
    setState((prev) => ({ ...prev, totalNiveis: sugestao, niveisConfig: [] }));
    setEtapa(1);
  };

  const selecionarTotalNiveis = (qty: number) => {
    const sugestoes = tipoSelecionado?.niveis ?? [];
    setState((prev) => ({
      ...prev,
      totalNiveis: qty,
      niveisConfig: Array.from({ length: qty }, (_, i) => ({
        nivel: i + 1,
        labelSingular: sugestoes[i]?.labelSingular ?? '',
        labelPlural: sugestoes[i]?.labelPlural ?? '',
      })),
    }));
    setErro('');
  };

  const atualizarNomeNivel = (index: number, valor: string) => {
    setState((prev) => {
      const novos = prev.niveisConfig.map((n, i) =>
        i === index ? { ...n, labelSingular: valor, labelPlural: valor } : n,
      );
      return { ...prev, niveisConfig: novos };
    });
    setErro('');
  };

  const podeAvancarEtapa2 =
    state.totalNiveis !== null &&
    state.niveisConfig.length === state.totalNiveis &&
    state.niveisConfig.every((n) => n.labelSingular.trim().length >= 2);

  const handleSalvarNiveis = () => {
    if (!podeAvancarEtapa2) return;
    salvarNiveisMutation.mutate();
  };

  const handleCriarObra = () => {
    if (!state.obraTipoId) return;
    if (obraCriada !== null) { setEtapa(2); return; }  // already created, just advance
    criarObraMutation.mutate();
  };

  const handleFinalizarSemLocais = () => {
    navigate(`/obras/${obraCriada!.id}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Cabeçalho */}
        <button
          onClick={() => navigate('/obras')}
          style={{
            background: 'none', border: 'none', color: 'var(--text-60)',
            cursor: 'pointer', fontSize: '14px', marginBottom: '24px',
          }}
        >
          ← Voltar para obras
        </button>

        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Nova Obra
        </h1>
        <p style={{ color: 'var(--text-60)', fontSize: '14px', marginBottom: '32px' }}>
          Preencha as informações para cadastrar a obra no sistema.
        </p>

        {/* Indicador de etapas */}
        <StepIndicator etapaAtual={etapa} etapas={ETAPAS} />

        {/* Erro global */}
        {erro && (
          <div
            style={{
              background: 'rgba(255,61,87,0.1)', border: '1px solid var(--status-error)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px',
              color: 'var(--status-error)', fontSize: '14px', marginBottom: '20px',
            }}
          >
            {erro}
          </div>
        )}

        {/* ETAPA 0 — Identificação */}
        {etapa === 0 && (
          <EtapaCard titulo="Identificação da Obra">
            <Campo label="Nome da Obra *">
              <input
                value={state.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex: Residencial Aurora — Bloco A"
                style={inputStyle}
              />
            </Campo>

            <Campo label="Tipo de Obra *">
              {tiposLoading && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-60)', fontSize: '14px' }}>
                  Carregando tipos de obra…
                </div>
              )}
              {tiposError && (
                <div style={{ padding: '12px 16px', background: 'rgba(255,61,87,0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span>Erro ao carregar tipos de obra. Verifique sua conexão.</span>
                  <button
                    onClick={() => tiposRefetch()}
                    style={{ background: 'none', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-sm)', color: 'var(--status-error)', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {!tiposLoading && !tiposError && tipos.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-60)', fontSize: '13px', border: '1px dashed var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
                  Nenhum tipo de obra cadastrado. Entre em contato com o suporte.
                </div>
              )}
              {!tiposLoading && tipos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {tipos.map((tipo) => (
                    <TipoCard
                      key={tipo.id}
                      tipo={tipo}
                      selecionado={state.obraTipoId === tipo.id}
                      onSelecionar={() => set('obraTipoId', tipo.id)}
                    />
                  ))}
                </div>
              )}
            </Campo>

            <Campo label="Modo de Qualidade">
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['SIMPLES', 'PBQPH'] as const).map((modo) => (
                  <button
                    key={modo}
                    onClick={() => set('modoQualidade', modo)}
                    style={{
                      flex: 1, padding: '12px',
                      background: state.modoQualidade === modo ? 'var(--accent-dim)' : 'var(--bg-surface)',
                      border: `1px solid ${state.modoQualidade === modo ? 'var(--accent)' : 'var(--bg-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      color: state.modoQualidade === modo ? 'var(--accent)' : 'var(--text-60)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                      {modo === 'SIMPLES' ? 'Simples' : 'PBQP-H'}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      {modo === 'SIMPLES' ? 'Sem certificação' : 'Com certificação PBQP-H'}
                    </div>
                  </button>
                ))}
              </div>
            </Campo>

            {!podeAvancarEtapa0 && (state.nome.trim().length > 0 || state.obraTipoId !== null) && (
              <div style={{ fontSize: '13px', color: 'var(--text-60)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {state.nome.trim().length < 2 && (
                  <span>• Informe o nome da obra (mínimo 2 caracteres)</span>
                )}
                {state.obraTipoId === null && (
                  <span>• Selecione um tipo de obra acima</span>
                )}
              </div>
            )}
            <BotoesWizard
              onAvancar={handleAvancarEtapa0}
              podeAvancar={podeAvancarEtapa0}
              labelAvancar="Próximo: Localização"
            />
          </EtapaCard>
        )}

        {/* ETAPA 1 — Localização */}
        {etapa === 1 && (
          <EtapaCard titulo="Localização (opcional)">
            <Campo label="Endereço">
              <input
                value={state.endereco}
                onChange={(e) => set('endereco', e.target.value)}
                placeholder="Rua, número, bairro"
                style={inputStyle}
              />
            </Campo>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
              <Campo label="Cidade">
                <input
                  value={state.cidade}
                  onChange={(e) => set('cidade', e.target.value)}
                  placeholder="São Paulo"
                  style={inputStyle}
                />
              </Campo>
              <Campo label="Estado">
                <select
                  value={state.estado}
                  onChange={(e) => set('estado', e.target.value)}
                  style={{ ...inputStyle, width: '80px' }}
                >
                  <option value="">UF</option>
                  {ESTADOS_BR.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </Campo>
            </div>

            <Campo label="CEP">
              <input
                value={state.cep}
                onChange={(e) => set('cep', e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                style={{ ...inputStyle, maxWidth: '160px' }}
              />
            </Campo>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Campo label="Data de início prevista">
                <input
                  type="date"
                  value={state.dataInicioPrevista}
                  onChange={(e) => set('dataInicioPrevista', e.target.value)}
                  style={inputStyle}
                />
              </Campo>
              <Campo label="Previsão de término">
                <input
                  type="date"
                  value={state.dataFimPrevista}
                  onChange={(e) => set('dataFimPrevista', e.target.value)}
                  style={inputStyle}
                />
              </Campo>
            </div>

            <Campo label="Foto de capa (opcional)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fotoPreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <img src={fotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => {
                        if (fotoPreview) URL.revokeObjectURL(fotoPreview);
                        setFotoCapa(null);
                        setFotoPreview(null);
                      }}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                        borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
                        fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >×</button>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '80px', border: '1px dashed var(--bg-border)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', color: 'var(--text-60)', fontSize: '13px', gap: '8px',
                  }}>
                    <span>📷</span>
                    <span>Clique para adicionar foto</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (fotoPreview) URL.revokeObjectURL(fotoPreview);
                        setFotoCapa(file);
                        setFotoPreview(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                )}
              </div>
            </Campo>

            <BotoesWizard
              onVoltar={() => setEtapa(0)}
              onAvancar={handleCriarObra}
              carregando={criarObraMutation.isPending}
              labelAvancar="Criar Obra e Configurar Hierarquia"
              podeAvancar
            />
          </EtapaCard>
        )}

        {/* ETAPA 2 — Hierarquia */}
        {etapa === 2 && obraCriada && (
          <EtapaCard titulo="Hierarquia de Locais">
            <div
              style={{
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px',
                marginBottom: '24px', fontSize: '14px', color: 'var(--accent)',
              }}
            >
              Obra <strong>{obraCriada.nome}</strong> criada com código{' '}
              <strong style={{ fontFamily: 'var(--font-data)' }}>{obraCriada.codigo}</strong>
            </div>

            {/* FASE 1 — Quantos níveis? */}
            <Campo label="Quantos níveis de hierarquia tem esta obra?">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => selecionarTotalNiveis(n)}
                    style={{
                      width: '48px', height: '48px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${state.totalNiveis === n ? 'var(--accent)' : 'var(--bg-border)'}`,
                      background: state.totalNiveis === n ? 'var(--accent-dim)' : 'var(--bg-surface)',
                      color: state.totalNiveis === n ? 'var(--accent)' : 'var(--text-60)',
                      fontSize: '18px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Campo>

            {/* FASE 2 — Campos de nome (aparecem após escolher qty) */}
            {state.totalNiveis !== null && state.niveisConfig.length > 0 && (
              <>
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {state.niveisConfig.map((n, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', fontWeight: 600, color: 'var(--text-60)',
                        }}
                      >
                        {n.nivel}
                      </span>
                      <input
                        value={n.labelSingular}
                        onChange={(e) => atualizarNomeNivel(i, e.target.value)}
                        placeholder={`Nome do nível ${n.nivel} — ex: ${['Torre','Pavimento','Apartamento','Cômodo','Seção','Área'][i] ?? 'Nível'}`}
                        style={{ ...inputStyle, flex: 1 }}
                        autoFocus={i === 0}
                      />
                    </div>
                  ))}
                </div>

                {/* Preview */}
                {state.niveisConfig.some((n) => n.labelSingular.trim()) && (
                  <div
                    style={{
                      marginTop: '16px', background: 'var(--bg-surface)',
                      border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
                      padding: '10px 14px', fontSize: '13px', color: 'var(--text-60)',
                    }}
                  >
                    {state.niveisConfig
                      .map((n) => n.labelSingular.trim() || `Nível ${n.nivel}`)
                      .join(' › ')}
                  </div>
                )}
              </>
            )}

            <BotoesWizard
              onVoltar={() => setEtapa(1)}
              onAvancar={handleSalvarNiveis}
              carregando={salvarNiveisMutation.isPending}
              podeAvancar={podeAvancarEtapa2}
              labelAvancar="Salvar e Continuar"
              labelPular="Pular — configurar depois"
              onPular={() => setEtapa(3)}
            />
          </EtapaCard>
        )}

        {/* ETAPA 3 — Gerar Locais */}
        {etapa === 3 && obraCriada && (
          <EtapaCard titulo="Gerar Locais em Massa">
            <p style={{ color: 'var(--text-60)', fontSize: '14px', marginBottom: '20px' }}>
              Gere automaticamente os locais da obra.
              Você pode fazer isso agora ou mais tarde.
            </p>

            {/* Seletor de estratégia */}
            {!estrategia && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                {([
                  { key: 'generica' as EstrategiaGeracao,   label: 'Genérica',   desc: 'Multi-nível configurável', emBreve: false },
                  { key: 'edificacao' as EstrategiaGeracao, label: 'Edificação', desc: 'Condomínio, Blocos, Andares e Unidades', emBreve: false },
                  { key: 'linear' as EstrategiaGeracao,     label: 'Linear',      desc: 'Trechos com PVs (rodovias, redes)', emBreve: false },
                  { key: 'instalacao' as EstrategiaGeracao, label: 'Instalação',  desc: 'Áreas com módulos (fábricas, ETEs)', emBreve: false },
                ]).map((e) => (
                  <button
                    key={e.key}
                    onClick={() => !e.emBreve && setEstrategia(e.key)}
                    disabled={e.emBreve}
                    style={{
                      padding: '14px', border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      background: e.emBreve ? 'var(--bg-void)' : 'var(--bg-surface)',
                      cursor: e.emBreve ? 'not-allowed' : 'pointer',
                      textAlign: 'left', transition: 'border-color 0.15s',
                      opacity: e.emBreve ? 0.5 : 1,
                    }}
                    onMouseEnter={(ev) => { if (!e.emBreve) ev.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={(ev) => { if (!e.emBreve) ev.currentTarget.style.borderColor = 'var(--bg-border)'; }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-100)', marginBottom: '4px' }}>
                      {e.label}{e.emBreve && <span style={{ fontSize: '10px', color: 'var(--text-40)', marginLeft: '6px', fontWeight: 400 }}>Em breve</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-60)' }}>{e.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Formulário quando estratégia selecionada — por enquanto apenas genérica simplificada */}
            {estrategia && (
              <div style={{
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600 }}>
                  Estratégia: {{
                    generica: 'Genérica', edificacao: 'Edificação',
                    linear: 'Linear', instalacao: 'Instalação',
                  }[estrategia]}
                </span>
                <button
                  onClick={() => setEstrategia(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-60)' }}
                >
                  Trocar
                </button>
              </div>
            )}

            <label style={checkboxContainerStyle}>
              <input
                type="checkbox"
                checked={state.gerarLocais}
                onChange={(e) => set('gerarLocais', e.target.checked)}
              />
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>Gerar locais agora</span>
            </label>

            {state.gerarLocais && estrategia === 'generica' && (
              <GenericaForm
                value={{ ...genericaPayload, maxNiveis: state.totalNiveis ?? 6 }}
                onChange={setGenericaPayload}
              />
            )}

            {state.gerarLocais && estrategia === 'edificacao' && (
              <EdificacaoForm value={edificacaoPayload} onChange={setEdificacaoPayload} />
            )}

            {state.gerarLocais && estrategia === 'linear' && (
              <LinearForm value={linearPayload} onChange={setLinearPayload} />
            )}

            {state.gerarLocais && estrategia === 'instalacao' && (
              <InstalacaoForm value={instalacaoPayload} onChange={setInstalacaoPayload} />
            )}

            <BotoesWizard
              onVoltar={() => setEtapa(2)}
              onAvancar={
                !state.gerarLocais
                  ? handleFinalizarSemLocais
                  : estrategia === 'generica'
                  ? () => gerarCascataGenericaMutation.mutate()
                  : estrategia === 'edificacao'
                  ? () => gerarCascataEdificacaoMutation.mutate()
                  : estrategia === 'linear'
                  ? () => gerarCascataLinearMutation.mutate()
                  : estrategia === 'instalacao'
                  ? () => gerarCascataInstalacaoMutation.mutate()
                  : handleFinalizarSemLocais
              }
              carregando={
                gerarCascataGenericaMutation.isPending ||
                gerarCascataEdificacaoMutation.isPending ||
                gerarCascataLinearMutation.isPending ||
                gerarCascataInstalacaoMutation.isPending
              }
              podeAvancar={
                !state.gerarLocais ||
                (estrategia !== null &&
                  (estrategia !== 'generica' ||
                    genericaPayload.niveis.every((n) => n.prefixo.trim().length > 0 && n.qtde > 0)))
              }
              labelAvancar={state.gerarLocais ? 'Gerar Locais e Finalizar' : 'Finalizar Cadastro'}
            />
          </EtapaCard>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────

function StepIndicator({ etapaAtual, etapas }: { etapaAtual: number; etapas: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
      {etapas.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < etapas.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: i < etapaAtual ? 'var(--accent)' : i === etapaAtual ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                border: `2px solid ${i <= etapaAtual ? 'var(--accent)' : 'var(--bg-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700,
                color: i < etapaAtual ? '#000' : i === etapaAtual ? 'var(--accent)' : 'var(--text-40)',
              }}
            >
              {i < etapaAtual ? '✓' : i + 1}
            </div>
            <span
              style={{
                fontSize: '11px', marginTop: '4px', whiteSpace: 'nowrap',
                color: i === etapaAtual ? 'var(--text-80)' : 'var(--text-40)',
              }}
            >
              {label}
            </span>
          </div>
          {i < etapas.length - 1 && (
            <div
              style={{
                flex: 1, height: '2px', margin: '0 4px 16px',
                background: i < etapaAtual ? 'var(--accent)' : 'var(--bg-border)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function EtapaCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
      }}
    >
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--text-100)' }}>
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-60)', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TipoCard({
  tipo,
  selecionado,
  onSelecionar,
}: {
  tipo: ObraTipo;
  selecionado: boolean;
  onSelecionar: () => void;
}) {
  return (
    <button
      onClick={onSelecionar}
      style={{
        background: selecionado ? 'var(--accent-dim)' : 'var(--bg-surface)',
        border: `1px solid ${selecionado ? 'var(--accent)' : 'var(--bg-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px', color: selecionado ? 'var(--accent)' : 'var(--text-100)', marginBottom: '4px' }}>
        {tipo.nome}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-40)' }}>
        {tipo.totalNiveis} nível{tipo.totalNiveis !== 1 ? 'is' : ''}
        {tipo.tenantId === 0 && <span style={{ marginLeft: '6px', color: 'var(--text-40)' }}>• padrão</span>}
      </div>
    </button>
  );
}

function BotoesWizard({
  onVoltar,
  onAvancar,
  onPular,
  podeAvancar,
  carregando,
  labelAvancar = 'Próximo',
  labelPular,
}: {
  onVoltar?: () => void;
  onAvancar: () => void;
  onPular?: () => void;
  podeAvancar: boolean;
  carregando?: boolean;
  labelAvancar?: string;
  labelPular?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--bg-border)' }}>
      {onVoltar && (
        <button
          onClick={onVoltar}
          disabled={carregando}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
            padding: '10px 18px', cursor: 'pointer', fontSize: '14px',
          }}
        >
          Voltar
        </button>
      )}
      {labelPular && onPular && (
        <button
          onClick={onPular}
          disabled={carregando}
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-40)', cursor: 'pointer', fontSize: '13px',
          }}
        >
          {labelPular}
        </button>
      )}
      <button
        onClick={onAvancar}
        disabled={!podeAvancar || carregando}
        style={{
          background: podeAvancar ? 'var(--accent)' : 'var(--bg-border)',
          color: podeAvancar ? '#000' : 'var(--text-40)',
          border: 'none', borderRadius: 'var(--radius-md)',
          padding: '10px 20px', cursor: podeAvancar ? 'pointer' : 'default',
          fontSize: '14px', fontWeight: 600,
        }}
      >
        {carregando ? 'Salvando...' : labelAvancar}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
  color: 'var(--text-100)',
  fontSize: '14px',
  outline: 'none',
};

const checkboxContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  userSelect: 'none',
};
