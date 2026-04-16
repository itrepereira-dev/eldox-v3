// frontend-web/src/modules/fvs/relatorios/hooks/useRelatorioFvs.ts
import { useState } from 'react';
import { api } from '../../../../services/api';
import type {
  ReportTipo, ReportFiltros, ReportFormato,
  R1FichaData, R2ConformidadeData, R3PendenciasData, R4NcsData, R5PlanoAcaoData,
} from '../types';

export type RelatorioDadosResult =
  | R1FichaData
  | R2ConformidadeData
  | R3PendenciasData
  | R4NcsData
  | R5PlanoAcaoData;

interface UseRelatorioFvsReturn {
  loading: boolean;
  error: string | null;
  triggerDownload: (tipo: ReportTipo, filtros: ReportFiltros, formato: ReportFormato) => Promise<void>;
}

async function fetchDados(tipo: ReportTipo, filtros: ReportFiltros): Promise<RelatorioDadosResult> {
  switch (tipo) {
    case 'R1_FICHA': {
      if (!filtros.fichaId) throw new Error('fichaId é obrigatório para R1');
      const { data } = await api.get(`/fvs/fichas/${filtros.fichaId}`);
      return data as R1FichaData;
    }
    case 'R2_CONFORMIDADE': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R2');
      const params: Record<string, string | number> = {};
      if (filtros.servicoId) params.servico_id = filtros.servicoId;
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      const { data } = await api.get(`/fvs/dashboard/obras/${filtros.obraId}/relatorio-conformidade`, { params });
      return data as R2ConformidadeData;
    }
    case 'R3_PENDENCIAS': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R3');
      const params: Record<string, string | number> = {};
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      if (filtros.inspetorId) params.inspetor_id = filtros.inspetorId;
      if (filtros.criticidade) params.criticidade = filtros.criticidade;
      const [fichas, ncs, planos] = await Promise.all([
        api.get(`/fvs/fichas`, { params: { obraId: filtros.obraId, status: 'em_inspecao,rascunho', ...params } }),
        api.get(`/obras/${filtros.obraId}/ncs`, { params: { status: 'ABERTA,EM_ANALISE,TRATAMENTO', ...params } }),
        api.get(`/obras/${filtros.obraId}/planos-acao`, { params: { vencidos: true, ...params } }),
      ]);
      const obraRes = await api.get(`/obras/${filtros.obraId}`);
      const obra_nome = obraRes.data?.nome ?? '';
      const agora = new Date();
      return {
        obra_nome,
        data_geracao: agora.toISOString(),
        fichas_abertas: (fichas.data?.data ?? []).map((f: { id: number; nome: string; status: string; created_at: string; criado_por_nome?: string }) => ({
          id: f.id,
          nome: f.nome,
          status: f.status,
          created_at: f.created_at,
          inspetor_nome: f.criado_por_nome ?? 'Desconhecido',
          dias_aberta: Math.floor((agora.getTime() - new Date(f.created_at).getTime()) / 86400000),
        })),
        ncs_sem_plano: (ncs.data?.data ?? []).map((nc: { numero: string; titulo: string; criticidade: string; status: string; created_at: string }) => ({
          numero: nc.numero,
          titulo: nc.titulo,
          criticidade: nc.criticidade,
          status: nc.status,
          created_at: nc.created_at,
          dias_aberta: Math.floor((agora.getTime() - new Date(nc.created_at).getTime()) / 86400000),
        })),
        planos_vencidos: (planos.data?.data ?? []).map((pa: { id: number; titulo: string; prazo: string | null; responsavel_nome?: string | null; prioridade?: string }) => ({
          id: pa.id,
          titulo: pa.titulo,
          prazo: pa.prazo ?? '',
          dias_vencido: pa.prazo ? Math.floor((agora.getTime() - new Date(pa.prazo).getTime()) / 86400000) : 0,
          responsavel: pa.responsavel_nome ?? null,
          prioridade: pa.prioridade ?? 'NORMAL',
        })),
      } as R3PendenciasData;
    }
    case 'R4_NCS': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R4');
      const params: Record<string, string | number> = {};
      if (filtros.status) params.status = filtros.status;
      if (filtros.criticidade) params.criticidade = filtros.criticidade;
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      const [ncsRes, obraRes] = await Promise.all([
        api.get(`/obras/${filtros.obraId}/ncs`, { params }),
        api.get(`/obras/${filtros.obraId}`),
      ]);
      const ncs = ncsRes.data?.data ?? [];
      const agora = new Date();
      const vencidas = ncs.filter((nc: { prazo: string | null; status: string }) => nc.prazo && new Date(nc.prazo) < agora && nc.status !== 'FECHADA').length;
      const no_prazo = ncs.filter((nc: { prazo: string | null; status: string }) => nc.prazo && new Date(nc.prazo) >= agora).length;
      const sem_prazo = ncs.filter((nc: { prazo: string | null }) => !nc.prazo).length;
      const por_criticidade = {
        alta: ncs.filter((nc: { criticidade: string }) => nc.criticidade === 'ALTA').length,
        media: ncs.filter((nc: { criticidade: string }) => nc.criticidade === 'MEDIA').length,
        baixa: ncs.filter((nc: { criticidade: string }) => nc.criticidade === 'BAIXA').length,
      };
      return {
        obra_nome: obraRes.data?.nome ?? '',
        data_geracao: agora.toISOString(),
        filtros: {
          status: filtros.status,
          criticidade: filtros.criticidade,
          data_inicio: filtros.dataInicio,
          data_fim: filtros.dataFim,
        },
        ncs: ncs.map((nc: { numero: string; titulo: string; criticidade: string; status: string; responsavel_nome?: string | null; prazo: string | null; created_at: string; fvs_ficha_id?: number | null; categoria?: string }) => ({
          numero: nc.numero,
          ficha_nome: nc.fvs_ficha_id ? `Ficha #${nc.fvs_ficha_id}` : '—',
          servico: nc.categoria ?? '—',
          item_descricao: nc.titulo,
          criticidade: nc.criticidade,
          status: nc.status,
          responsavel: nc.responsavel_nome ?? null,
          prazo: nc.prazo,
          created_at: nc.created_at,
        })),
        sla: { no_prazo, vencidas, sem_prazo },
        por_criticidade,
      } as R4NcsData;
    }
    case 'R5_PA': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R5');
      const params: Record<string, string | number> = {};
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      const [planosRes, obraRes] = await Promise.all([
        api.get(`/obras/${filtros.obraId}/planos-acao`, { params }),
        api.get(`/obras/${filtros.obraId}`),
      ]);
      const planos = planosRes.data?.data ?? [];
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const abertos = planos.filter((p: { etapa_atual?: string }) => p.etapa_atual === 'ABERTO').length;
      const em_andamento = planos.filter((p: { etapa_atual?: string }) => p.etapa_atual === 'EM_ANDAMENTO').length;
      const fechados_este_mes = planos.filter((p: { etapa_atual?: string; updated_at?: string }) =>
        p.etapa_atual === 'FECHADO' && p.updated_at && new Date(p.updated_at) >= inicioMes
      ).length;
      return {
        obra_nome: obraRes.data?.nome ?? '',
        data_geracao: agora.toISOString(),
        planos: planos.map((p: { id: number; titulo: string; origem?: string; etapa_atual?: string; prioridade?: string; responsavel_nome?: string | null; prazo?: string | null; created_at: string; numero?: string }) => {
          const vencido = !!p.prazo && new Date(p.prazo) < agora && p.etapa_atual !== 'FECHADO';
          return {
            id: p.id,
            numero: p.numero ?? `PA-${p.id}`,
            titulo: p.titulo,
            origem: p.origem ?? '—',
            etapa_atual: p.etapa_atual ?? 'ABERTO',
            prioridade: p.prioridade ?? 'NORMAL',
            responsavel: p.responsavel_nome ?? null,
            prazo: p.prazo ?? null,
            dias_aberto: Math.floor((agora.getTime() - new Date(p.created_at).getTime()) / 86400000),
            vencido,
            created_at: p.created_at,
          };
        }),
        resumo: { abertos, em_andamento, fechados_este_mes },
      } as R5PlanoAcaoData;
    }
  }
}

export function useRelatorioFvs(): UseRelatorioFvsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerDownload = async (
    tipo: ReportTipo,
    filtros: ReportFiltros,
    formato: ReportFormato,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const dados = await fetchDados(tipo, filtros);

      if (formato === 'pdf') {
        const { renderToPdf } = await import('../pdf/PdfRenderer');
        await renderToPdf(tipo, dados, filtros);
      } else {
        const { renderToXlsx } = await import('../excel/XlsxRenderer');
        await renderToXlsx(tipo, dados, filtros);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, triggerDownload };
}
