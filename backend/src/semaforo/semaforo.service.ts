// backend/src/semaforo/semaforo.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Tipos internos ──────────────────────────────────────────────────────────

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho';

export interface ModuloDetalhes {
  total: number;
  conformes: number;
  nao_conformes: number;
  score_pct: number; // 0–100
}

export interface NcsDetalhes {
  total_abertas: number;
  abertas_mais_7_dias: number;
  penalidade_pct: number; // 0–100 (quanto foi penalizado)
}

export interface SemaforoBreakdown {
  fvs: ModuloDetalhes;
  fvm: ModuloDetalhes;
  ensaios: ModuloDetalhes;
  ncs: NcsDetalhes;
}

export interface SemaforoResult {
  obraId: number;
  score: number;       // 0.00–1.00
  cor: CorSemaforo;
  breakdown: SemaforoBreakdown;
  calculadoEm: Date;
  expiradoEm: Date;
}

// ─── Pesos do Semáforo (somam 1.0) ──────────────────────────────────────────

const PESO_FVS    = 0.30;
const PESO_FVM    = 0.25;
const PESO_ENSAIO = 0.25;
const PESO_NCS    = 0.20;

const TTL_HORAS = 1;

// ─── Linhas brutas retornadas pelo raw SQL ───────────────────────────────────

interface FvsRow    { total: number; conformes: number }
interface FvmRow    { total: number; conformes: number }
interface EnsaioRow { total: number; conformes: number }
interface NcRow     { total_abertas: number; abertas_mais_7_dias: number }
interface CacheRow  {
  modulo: string;
  score: number;
  semaforo: string;
  detalhes: unknown;
  calculado_em: Date;
  expirado_em: Date;
}

@Injectable()
export class SemaforoService {
  private readonly logger = new Logger(SemaforoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── calcularSemaforo ──────────────────────────────────────────────────────
  //  Consulta FVS, FVM, Ensaios e NCS, calcula score, persiste cache por módulo.

  async calcularSemaforo(tenantId: number, obraId: number): Promise<SemaforoResult> {
    // Verifica se a obra pertence ao tenant (usa Prisma ORM — tabela sem @@map)
    const obraCheck = await this.prisma.obra.findFirst({
      where: { id: obraId, tenantId, deletadoEm: null },
      select: { id: true },
    });
    if (!obraCheck) throw new NotFoundException(`Obra ${obraId} não encontrada`);

    // ── FVS: fichas aprovadas (status = 'aprovada') ───────────────────────
    const fvsRows = await this.prisma.$queryRawUnsafe<FvsRow[]>(
      `SELECT
         COUNT(*)::int                                        AS total,
         COUNT(*) FILTER (WHERE status = 'aprovada')::int    AS conformes
       FROM fvs_fichas
       WHERE tenant_id = $1
         AND obra_id   = $2
         AND deleted_at IS NULL`,
      tenantId,
      obraId,
    );
    const fvsTotais = fvsRows[0] ?? { total: 0, conformes: 0 };
    const fvsScore  = fvsTotais.total > 0
      ? (Number(fvsTotais.conformes) / Number(fvsTotais.total)) * 100
      : 100; // sem registros = neutro (não penaliza)

    // ── FVM: lotes aprovados ou aprovado_com_ressalva ─────────────────────
    const fvmRows = await this.prisma.$queryRawUnsafe<FvmRow[]>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (
           WHERE status IN ('aprovado','aprovado_com_ressalva')
         )::int        AS conformes
       FROM fvm_lotes
       WHERE tenant_id = $1
         AND obra_id   = $2
         AND deleted_at IS NULL`,
      tenantId,
      obraId,
    );
    const fvmTotais = fvmRows[0] ?? { total: 0, conformes: 0 };
    const fvmScore  = fvmTotais.total > 0
      ? (Number(fvmTotais.conformes) / Number(fvmTotais.total)) * 100
      : 100;

    // ── Ensaios: aprovados via ensaio_revisao.situacao = 'APROVADO' ──────
    // Cada ensaio_laboratorial tem zero ou uma revisão; contamos apenas ensaios
    // que já têm uma revisão com situacao = 'APROVADO' como conformes.
    const ensaioRows = await this.prisma.$queryRawUnsafe<EnsaioRow[]>(
      `SELECT
         COUNT(DISTINCT e.id)::int AS total,
         COUNT(DISTINCT e.id) FILTER (
           WHERE r.situacao = 'APROVADO'
         )::int                   AS conformes
       FROM ensaio_laboratorial e
       LEFT JOIN ensaio_revisao r ON r.ensaio_id = e.id AND r.tenant_id = e.tenant_id
       WHERE e.tenant_id = $1
         AND e.obra_id   = $2
         AND e.deleted_at IS NULL`,
      tenantId,
      obraId,
    );
    const ensaioTotais = ensaioRows[0] ?? { total: 0, conformes: 0 };
    const ensaioScore  = ensaioTotais.total > 0
      ? (Number(ensaioTotais.conformes) / Number(ensaioTotais.total)) * 100
      : 100;

    // ── NCS: penalidade por NCs abertas > 7 dias ─────────────────────────
    const ncRows = await this.prisma.$queryRawUnsafe<NcRow[]>(
      `SELECT
         COUNT(*) FILTER (
           WHERE status NOT IN ('FECHADA','CANCELADA')
         )::int AS total_abertas,
         COUNT(*) FILTER (
           WHERE status NOT IN ('FECHADA','CANCELADA')
             AND created_at < NOW() - INTERVAL '7 days'
         )::int AS abertas_mais_7_dias
       FROM nao_conformidades
       WHERE tenant_id = $1
         AND obra_id   = $2
         AND deleted_at IS NULL`,
      tenantId,
      obraId,
    );
    const ncTotais           = ncRows[0] ?? { total_abertas: 0, abertas_mais_7_dias: 0 };
    const totalAbertas       = Number(ncTotais.total_abertas);
    const abertas7dias       = Number(ncTotais.abertas_mais_7_dias);
    // Penalidade cresce linearmente: cada NC > 7 dias subtrai 10 pontos, máximo 100
    const penalidadePct      = Math.min(abertas7dias * 10, 100);
    const ncsScore           = 100 - penalidadePct;

    // ── Score composto (0–100) ────────────────────────────────────────────
    const scoreComposto =
      fvsScore    * PESO_FVS  +
      fvmScore    * PESO_FVM  +
      ensaioScore * PESO_ENSAIO +
      ncsScore    * PESO_NCS;

    const scoreNormalizado = scoreComposto / 100; // 0.00–1.00

    // ── Determina cor ─────────────────────────────────────────────────────
    let cor: CorSemaforo;
    if (scoreNormalizado >= 0.85)      cor = 'verde';
    else if (scoreNormalizado >= 0.60) cor = 'amarelo';
    else                               cor = 'vermelho';

    // ── Monta breakdown ───────────────────────────────────────────────────
    const breakdown: SemaforoBreakdown = {
      fvs: {
        total:        Number(fvsTotais.total),
        conformes:    Number(fvsTotais.conformes),
        nao_conformes: Number(fvsTotais.total) - Number(fvsTotais.conformes),
        score_pct:    Math.round(fvsScore * 100) / 100,
      },
      fvm: {
        total:        Number(fvmTotais.total),
        conformes:    Number(fvmTotais.conformes),
        nao_conformes: Number(fvmTotais.total) - Number(fvmTotais.conformes),
        score_pct:    Math.round(fvmScore * 100) / 100,
      },
      ensaios: {
        total:        Number(ensaioTotais.total),
        conformes:    Number(ensaioTotais.conformes),
        nao_conformes: Number(ensaioTotais.total) - Number(ensaioTotais.conformes),
        score_pct:    Math.round(ensaioScore * 100) / 100,
      },
      ncs: {
        total_abertas:      totalAbertas,
        abertas_mais_7_dias: abertas7dias,
        penalidade_pct:     penalidadePct,
      },
    };

    const agora        = new Date();
    const expiradoEm   = new Date(agora.getTime() + TTL_HORAS * 60 * 60 * 1000);

    // ── Persiste cache por módulo (upsert) ────────────────────────────────
    const modulosUpsert: Array<{ modulo: string; score: number; semaforo: CorSemaforo; detalhes: unknown }> = [
      { modulo: 'fvs',     score: fvsScore,    semaforo: this.corModulo(fvsScore),    detalhes: breakdown.fvs },
      { modulo: 'fvm',     score: fvmScore,    semaforo: this.corModulo(fvmScore),    detalhes: breakdown.fvm },
      { modulo: 'ensaios', score: ensaioScore, semaforo: this.corModulo(ensaioScore), detalhes: breakdown.ensaios },
      { modulo: 'ncs',     score: ncsScore,    semaforo: this.corModulo(ncsScore),    detalhes: breakdown.ncs },
    ];

    await Promise.all(
      modulosUpsert.map(({ modulo, score, semaforo, detalhes }) =>
        this.prisma.$executeRawUnsafe(
          `INSERT INTO semaforo_pbqph_cache
             (tenant_id, obra_id, modulo, score, semaforo, detalhes, calculado_em, expirado_em)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), $7)
           ON CONFLICT (tenant_id, obra_id, modulo) DO UPDATE SET
             score        = EXCLUDED.score,
             semaforo     = EXCLUDED.semaforo,
             detalhes     = EXCLUDED.detalhes,
             calculado_em = NOW(),
             expirado_em  = EXCLUDED.expirado_em`,
          tenantId,
          obraId,
          modulo,
          Math.round(score * 100) / 100,
          semaforo,
          JSON.stringify(detalhes),
          expiradoEm,
        ),
      ),
    );

    this.logger.log(
      `Semáforo obra ${obraId} recalculado: score=${scoreNormalizado.toFixed(3)} cor=${cor}`,
    );

    return {
      obraId,
      score:       Math.round(scoreNormalizado * 10000) / 10000,
      cor,
      breakdown,
      calculadoEm: agora,
      expiradoEm,
    };
  }

  // ── getSemaforo ──────────────────────────────────────────────────────────
  //  Retorna cache válido (< 1h) ou recalcula.

  async getSemaforo(tenantId: number, obraId: number): Promise<SemaforoResult> {
    const agora = new Date();

    const cacheRows = await this.prisma.$queryRawUnsafe<CacheRow[]>(
      `SELECT modulo, score, semaforo, detalhes, calculado_em, expirado_em
       FROM semaforo_pbqph_cache
       WHERE tenant_id = $1
         AND obra_id   = $2
         AND expirado_em > $3
       ORDER BY modulo`,
      tenantId,
      obraId,
      agora,
    );

    // Precisamos dos 4 módulos para reconstituir o resultado do cache
    const modulosEsperados = ['ensaios', 'fvm', 'fvs', 'ncs'];
    const modulosPresentes  = cacheRows.map(r => r.modulo).sort();

    const cacheValido =
      modulosPresentes.length === 4 &&
      modulosEsperados.every((m, i) => m === modulosPresentes[i]);

    if (!cacheValido) {
      return this.calcularSemaforo(tenantId, obraId);
    }

    // Reconstrói SemaforoResult a partir do cache
    const porModulo: Record<string, CacheRow> = {};
    for (const row of cacheRows) porModulo[row.modulo] = row;

    const breakdown: SemaforoBreakdown = {
      fvs:     porModulo['fvs'].detalhes     as ModuloDetalhes,
      fvm:     porModulo['fvm'].detalhes     as ModuloDetalhes,
      ensaios: porModulo['ensaios'].detalhes as ModuloDetalhes,
      ncs:     porModulo['ncs'].detalhes     as NcsDetalhes,
    };

    // Recalcula score global a partir dos módulos em cache
    const fvsScore    = Number(porModulo['fvs'].score);
    const fvmScore    = Number(porModulo['fvm'].score);
    const ensaioScore = Number(porModulo['ensaios'].score);
    const ncsScore    = Number(porModulo['ncs'].score);

    const scoreComposto =
      fvsScore    * PESO_FVS  +
      fvmScore    * PESO_FVM  +
      ensaioScore * PESO_ENSAIO +
      ncsScore    * PESO_NCS;

    const scoreNormalizado = scoreComposto / 100;
    let cor: CorSemaforo;
    if (scoreNormalizado >= 0.85)      cor = 'verde';
    else if (scoreNormalizado >= 0.60) cor = 'amarelo';
    else                               cor = 'vermelho';

    return {
      obraId,
      score:       Math.round(scoreNormalizado * 10000) / 10000,
      cor,
      breakdown,
      calculadoEm: porModulo['fvs'].calculado_em,
      expiradoEm:  porModulo['fvs'].expirado_em,
    };
  }

  // ── getSemaforoTodasObras ─────────────────────────────────────────────────
  //  Retorna semáforo de todas as obras ativas do tenant.
  //  Usa cache quando disponível; dispara recálculo em background para expirados.

  async getSemaforoTodasObras(tenantId: number): Promise<SemaforoResult[]> {
    const obrasRows = await this.prisma.obra.findMany({
      where: { tenantId, deletadoEm: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    const resultados = await Promise.all(
      obrasRows.map(o => this.getSemaforo(tenantId, o.id).catch(err => {
        this.logger.error(`getSemaforo obraId=${o.id} falhou: ${err}`);
        return null;
      })),
    );

    return resultados.filter((r): r is SemaforoResult => r !== null);
  }

  // ── Helper: cor por score percentual individual do módulo ────────────────

  private corModulo(scorePct: number): CorSemaforo {
    if (scorePct >= 85) return 'verde';
    if (scorePct >= 60) return 'amarelo';
    return 'vermelho';
  }
}
