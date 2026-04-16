// backend/src/almoxarifado/jobs/job-types.ts

export interface JobProcessarNfe {
  webhookId: number;
  tenantId: number;
}

export interface JobMatchNfeItens {
  nfeId: number;
  tenantId: number;
}

export interface JobVerificarEstoqueMinimo {
  tenantId: number;
  obraId?: number;
}

export interface JobPrevisaoReposicao {
  tenantId: number;
}

export interface JobDetectarAnomalias {
  tenantId: number;
}

export interface JobGerarPdfOc {
  ocId: number;
  tenantId: number;
}

export interface JobNotificarFornecedor {
  ocId: number;
  tenantId: number;
}

export type AlmJobData =
  | { name: 'processar-nfe';          data: JobProcessarNfe }
  | { name: 'match-nfe-itens';        data: JobMatchNfeItens }
  | { name: 'verificar-estoque-min';  data: JobVerificarEstoqueMinimo }
  | { name: 'previsao-reposicao';     data: JobPrevisaoReposicao }
  | { name: 'detectar-anomalias';     data: JobDetectarAnomalias }
  | { name: 'gerar-pdf-oc';           data: JobGerarPdfOc }
  | { name: 'notificar-fornecedor';   data: JobNotificarFornecedor };
