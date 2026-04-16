// frontend-web/src/services/semaforo.service.ts
import { api } from './api';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho';

export interface ModuloDetalhes {
  total: number;
  conformes: number;
  nao_conformes: number;
  score_pct: number;
}

export interface NcsDetalhes {
  total_abertas: number;
  abertas_mais_7_dias: number;
  penalidade_pct: number;
}

export interface SemaforoBreakdown {
  fvs: ModuloDetalhes;
  fvm: ModuloDetalhes;
  ensaios: ModuloDetalhes;
  ncs: NcsDetalhes;
}

export interface SemaforoResult {
  obraId: number;
  score: number;
  cor: CorSemaforo;
  breakdown: SemaforoBreakdown;
  calculadoEm: string;
  expiradoEm: string;
}

export type SemaforoResponse       = { status: 'success'; data: SemaforoResult };
export type SemaforoGlobalResponse = { status: 'success'; data: SemaforoResult[] };

// ─── Service ────────────────────────────────────────────────────────────────

export const semaforoService = {
  // Semáforo de uma obra (usa cache ou recalcula automaticamente)
  getObra: (obraId: number): Promise<SemaforoResponse> =>
    api.get(`/obras/${obraId}/semaforo`).then(r => r.data),

  // Força recálculo imediato (invalida cache)
  recalcular: (obraId: number): Promise<SemaforoResponse> =>
    api.post(`/obras/${obraId}/semaforo/recalcular`).then(r => r.data),

  // Semáforo de todas as obras do tenant
  getGlobal: (): Promise<SemaforoGlobalResponse> =>
    api.get('/semaforo').then(r => r.data),
};
