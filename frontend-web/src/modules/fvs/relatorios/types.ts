// frontend-web/src/modules/fvs/relatorios/types.ts

export type ReportTipo =
  | 'R1_FICHA'
  | 'R2_CONFORMIDADE'
  | 'R3_PENDENCIAS'
  | 'R4_NCS'
  | 'R5_PA'
  | 'R6_USO';

export type ReportFormato = 'pdf' | 'excel';

export interface RelatorioBotaoProps {
  tipo: ReportTipo;
  filtros: ReportFiltros;
  formatos?: ReportFormato[];
  label?: string;
}

export interface ReportFiltros {
  obraId?: number;
  fichaId?: number;
  servicoId?: number;
  dataInicio?: string;   // ISO date "YYYY-MM-DD"
  dataFim?: string;      // ISO date "YYYY-MM-DD"
  status?: string;
  criticidade?: string;
  inspetorId?: number;
}

// ─── R1: Ficha de Inspeção Individual ───────────────────────────────────────

export interface R1FichaData {
  ficha: {
    id: number;
    nome: string;
    status: string;
    regime: string;
    created_at: string;
    obra_nome: string;
    inspetor_nome: string;
    exige_ro: boolean;
  };
  servicos: Array<{
    servico_nome: string;
    locais: Array<{
      local_nome: string;
      itens: Array<{
        descricao: string;
        criticidade: string;
        status: string;
        observacao: string | null;
      }>;
    }>;
  }>;
  evidencias: Array<{
    registro_id: number;
    nome_original: string;
    url: string;
    mime_type: string;
  }>;
  ncs: Array<{
    numero: string;
    item_descricao: string;
    criticidade: string;
    status: string;
    responsavel: string | null;
    prazo: string | null;
  }>;
}

// ─── R2: Conformidade por Serviço ────────────────────────────────────────────

export interface R2ConformidadeData {
  obra_nome: string;
  servico_nome: string | null;
  data_inicio: string;
  data_fim: string;
  por_semana: Array<{
    semana: string;
    total: number;
    aprovadas: number;
    taxa: number;
  }>;
  por_local: Array<{
    local_id: number;
    local_nome: string;
    ultima_inspecao: string | null;
    itens_total: number;
    itens_ok: number;
    itens_nc: number;
    taxa: number;
  }>;
  ncs_por_criticidade: { critico: number; maior: number; menor: number };
  fichas: Array<{
    ficha_numero: string;
    data: string;
    inspetor: string;
    local: string;
    itens_ok: number;
    itens_nc: number;
    taxa: number;
  }>;
}

// ─── R3: Pendências ──────────────────────────────────────────────────────────

export interface R3PendenciasData {
  obra_nome: string;
  data_geracao: string;
  fichas_abertas: Array<{
    id: number;
    nome: string;
    status: string;
    created_at: string;
    inspetor_nome: string;
    dias_aberta: number;
  }>;
  ncs_sem_plano: Array<{
    numero: string;
    titulo: string;
    criticidade: string;
    status: string;
    created_at: string;
    dias_aberta: number;
  }>;
  planos_vencidos: Array<{
    id: number;
    titulo: string;
    prazo: string;
    dias_vencido: number;
    responsavel: string | null;
    prioridade: string;
  }>;
}

// ─── R4: Não Conformidades ───────────────────────────────────────────────────

export interface R4NcsData {
  obra_nome: string;
  data_geracao: string;
  filtros: { status?: string; criticidade?: string; servico?: string; data_inicio?: string; data_fim?: string };
  ncs: Array<{
    numero: string;
    ficha_nome: string;
    servico: string;
    item_descricao: string;
    criticidade: string;
    status: string;
    responsavel: string | null;
    prazo: string | null;
    created_at: string;
  }>;
  sla: { no_prazo: number; vencidas: number; sem_prazo: number };
  por_criticidade: { alta: number; media: number; baixa: number };
}

// ─── R5: Planos de Ação ──────────────────────────────────────────────────────

export interface R5PlanoAcaoData {
  obra_nome: string;
  data_geracao: string;
  planos: Array<{
    id: number;
    numero: string;
    titulo: string;
    origem: string;
    etapa_atual: string;
    prioridade: string;
    responsavel: string | null;
    prazo: string | null;
    dias_aberto: number;
    vencido: boolean;
    created_at: string;
  }>;
  resumo: { abertos: number; em_andamento: number; fechados_este_mes: number };
}

// ─── R6: Relatório de Uso por Serviço ────────────────────────────────────────

export interface R6UsoData {
  obra_nome: string;
  data_inicio: string;
  data_fim: string;
  total_fichas: number;
  por_servico: Array<{
    servico_nome: string;
    total_fichas: number;
    total_registros: number;
    registros_ok: number;
    registros_nc: number;
    taxa: number;
  }>;
  por_inspetor: Array<{
    inspetor_nome: string;
    total_fichas: number;
    fichas_concluidas: number;
  }>;
}
