import { Prisma } from '@prisma/client';

export interface GerarCascataContext {
  obraId: number;
  tenantId: number;
  obraCodigo: string;
  tx: Prisma.TransactionClient;
}

export interface GerarCascataResult {
  inseridos: number;
  // locais só contém IDs reais quando criados via create() individual.
  // Para createMany() em massa os IDs não são retornados pelo Prisma — omitir.
  locais?: { id: number; nome: string; nomeCompleto: string; nivel: number }[];
}

export interface ILocalGenerator {
  gerar(payload: unknown, ctx: GerarCascataContext): Promise<GerarCascataResult>;
}
