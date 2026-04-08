import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { obrasService, type ObraTipo, type Obra } from '../../services/obras.service';

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────

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
  niveisConfig: { nivel: number; labelSingular: string; labelPlural: string }[];
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
    niveisConfig: [],
    gerarLocais: false,
    nivel: 2,
    prefixo: '',
    quantidade: 1,
  });

  const { data: tipos = [] } = useQuery<ObraTipo[]>({
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
    onSuccess: (res) => {
      setObraCriada(res.obra);
      setEtapa(2);
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao criar obra');
    },
  });

  const gerarMassaMutation = useMutation({
    mutationFn: () =>
      obrasService.gerarMassa(obraCriada!.id, {
        nivel: state.nivel,
        prefixo: state.prefixo,
        quantidade: state.quantidade,
      }),
    onSuccess: () => {
      navigate(`/obras/${obraCriada!.id}`);
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao gerar locais');
    },
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
    // Inicializa niveisConfig com os níveis do tipo selecionado
    if (tipoSelecionado) {
      setState((prev) => ({
        ...prev,
        niveisConfig: tipoSelecionado.niveis.map((n) => ({
          nivel: n.numero,
          labelSingular: n.labelSingular,
          labelPlural: n.labelPlural,
        })),
      }));
    }
    setEtapa(1);
  };

  const handleCriarObra = () => {
    if (!state.obraTipoId) return;
    criarObraMutation.mutate();
  };

  const handleFinalizarSemLocais = () => {
    navigate(`/obras/${obraCriada!.id}`);
  };

  const handleGerarLocais = () => {
    if (!state.prefixo.trim()) {
      setErro('Informe o prefixo para geração dos locais');
      return;
    }
    gerarMassaMutation.mutate();
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
                marginBottom: '20px', fontSize: '14px', color: 'var(--accent)',
              }}
            >
              Obra <strong>{obraCriada.nome}</strong> criada com código{' '}
              <strong style={{ fontFamily: 'var(--font-data)' }}>{obraCriada.codigo}</strong>
            </div>

            <p style={{ color: 'var(--text-60)', fontSize: '14px', marginBottom: '20px' }}>
              Tipo selecionado: <strong style={{ color: 'var(--text-80)' }}>{tipoSelecionado?.nome}</strong>{' '}
              com {tipoSelecionado?.totalNiveis} nível{tipoSelecionado?.totalNiveis !== 1 ? 'is' : ''} de hierarquia.
            </p>

            {/* Preview da hierarquia */}
            <Campo label="Estrutura de hierarquia">
              <div
                style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius-md)', padding: '16px',
                }}
              >
                {state.niveisConfig.map((n, i) => (
                  <div key={n.nivel} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: i < state.niveisConfig.length - 1 ? '8px' : 0 }}>
                    <span
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', color: 'var(--text-60)', flexShrink: 0,
                      }}
                    >
                      {n.nivel}
                    </span>
                    <input
                      value={n.labelSingular}
                      onChange={(e) => {
                        const novo = state.niveisConfig.map((x) =>
                          x.nivel === n.nivel ? { ...x, labelSingular: e.target.value } : x
                        );
                        set('niveisConfig', novo);
                      }}
                      placeholder="Singular (ex: Torre)"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      value={n.labelPlural}
                      onChange={(e) => {
                        const novo = state.niveisConfig.map((x) =>
                          x.nivel === n.nivel ? { ...x, labelPlural: e.target.value } : x
                        );
                        set('niveisConfig', novo);
                      }}
                      placeholder="Plural (ex: Torres)"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </Campo>

            <BotoesWizard
              onAvancar={() => setEtapa(3)}
              podeAvancar
              labelAvancar="Próximo: Gerar Locais"
              labelPular="Pular — configurar depois"
              onPular={() => setEtapa(3)}
            />
          </EtapaCard>
        )}

        {/* ETAPA 3 — Gerar Locais */}
        {etapa === 3 && obraCriada && (
          <EtapaCard titulo="Gerar Locais em Massa">
            <p style={{ color: 'var(--text-60)', fontSize: '14px', marginBottom: '20px' }}>
              Gere automaticamente os locais do primeiro nível (ex: Torres, Blocos).
              Você pode fazer isso agora ou mais tarde.
            </p>

            <label style={checkboxContainerStyle}>
              <input
                type="checkbox"
                checked={state.gerarLocais}
                onChange={(e) => set('gerarLocais', e.target.checked)}
              />
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>Gerar locais agora</span>
            </label>

            {state.gerarLocais && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Campo label="Prefixo do nome">
                    <input
                      value={state.prefixo}
                      onChange={(e) => set('prefixo', e.target.value)}
                      placeholder={`Ex: ${tipoSelecionado?.niveis[0]?.labelSingular ?? 'Torre'}`}
                      style={inputStyle}
                    />
                  </Campo>
                  <Campo label="Quantidade">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={state.quantidade}
                      onChange={(e) => set('quantidade', parseInt(e.target.value) || 1)}
                      style={inputStyle}
                    />
                  </Campo>
                </div>

                {state.prefixo && state.quantidade > 0 && (
                  <div
                    style={{
                      marginTop: '12px', background: 'var(--bg-surface)',
                      border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
                      padding: '12px', fontSize: '13px', color: 'var(--text-60)',
                    }}
                  >
                    Serão criados:{' '}
                    <strong style={{ color: 'var(--text-100)' }}>
                      {Array.from({ length: Math.min(state.quantidade, 3) }, (_, i) =>
                        `${state.prefixo} ${String(i + 1).padStart(2, '0')}`
                      ).join(', ')}
                      {state.quantidade > 3 ? ` ... ${state.prefixo} ${String(state.quantidade).padStart(2, '0')}` : ''}
                    </strong>
                  </div>
                )}
              </div>
            )}

            <BotoesWizard
              onVoltar={() => setEtapa(2)}
              onAvancar={state.gerarLocais ? handleGerarLocais : handleFinalizarSemLocais}
              carregando={gerarMassaMutation.isPending}
              podeAvancar
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
