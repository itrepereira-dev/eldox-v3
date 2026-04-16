// /backend/src/ai/agents/rdo/agente-clima.ts
// AGENTE-CLIMA — lógica pura (Open-Meteo + mapeamento, SEM LLM)
// Handler name: 'rdo.clima'

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  agregarPorPeriodo,
  type ClimaCtx,
  type CondPeriodo,
} from '../../prompts/rdo/clima.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteClimaCtx extends ClimaCtx {
  obra_id: number;
}

export interface AgenteClimaResult {
  periodos: CondPeriodo[];
  confianca: number;              // 0.0–1.0
  fonte: 'open_meteo' | 'historico_local';
  pre_preencher: boolean;         // true se confianca >= 0.8
  data: string;
  tenant_id: number;
}

// ── WMO API response shape (simplificado) ─────────────────────────────────────

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    precipitation: number[];
    weathercode: number[];
  };
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteClima {
  private readonly logger = new Logger(AgenteClima.name);
  private readonly OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

  constructor(private readonly prisma: PrismaService) {}

  async executar(ctx: AgenteClimaCtx): Promise<AgenteClimaResult> {
    try {
      const periodos = await this.fetchOpenMeteo(ctx);
      return {
        periodos,
        confianca: 0.9,
        fonte: 'open_meteo',
        pre_preencher: true,
        data: ctx.data,
        tenant_id: ctx.tenant_id,
      };
    } catch (err) {
      this.logger.warn(
        `AGENTE-CLIMA fallback ativado (tenant=${ctx.tenant_id}, obra=${ctx.obra_id}): ${(err as Error).message}`,
      );
      return this.fallback(ctx);
    }
  }

  // ── Open-Meteo ──────────────────────────────────────────────────────────────

  private async fetchOpenMeteo(ctx: AgenteClimaCtx): Promise<CondPeriodo[]> {
    const url = new URL(this.OPEN_METEO_BASE);
    url.searchParams.set('latitude', String(ctx.latitude));
    url.searchParams.set('longitude', String(ctx.longitude));
    url.searchParams.set('hourly', 'precipitation,weathercode');
    url.searchParams.set('timezone', 'America/Sao_Paulo');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('start_date', ctx.data);
    url.searchParams.set('end_date', ctx.data);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const { precipitation, weathercode } = data.hourly;

    if (!precipitation || precipitation.length < 24) {
      throw new Error('Open-Meteo retornou dados insuficientes');
    }

    return agregarPorPeriodo(precipitation, weathercode);
  }

  // ── Fallback: último clima registrado para a obra ─────────────────────────

  private async fallback(ctx: AgenteClimaCtx): Promise<AgenteClimaResult> {
    try {
      // Busca o RDO mais recente da obra com dados de clima
      const ultimoRdo = await this.prisma.$queryRaw<
        Array<{ clima_manha: string; clima_tarde: string; clima_noite: string; mm_chuva_manha: number; mm_chuva_tarde: number; mm_chuva_noite: number }>
      >`
        SELECT clima_manha, clima_tarde, clima_noite,
               COALESCE(mm_chuva_manha, 0) as mm_chuva_manha,
               COALESCE(mm_chuva_tarde, 0) as mm_chuva_tarde,
               COALESCE(mm_chuva_noite, 0) as mm_chuva_noite
        FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND clima_manha IS NOT NULL
        ORDER BY data DESC
        LIMIT 1
      `;

      if (ultimoRdo.length === 0) {
        return this.fallbackVazio(ctx);
      }

      const r = ultimoRdo[0];
      const periodos: CondPeriodo[] = [
        { periodo: 'manha', condicao: (r.clima_manha as CondPeriodo['condicao']) ?? 'claro', praticavel: r.mm_chuva_manha < 2, mm_chuva: r.mm_chuva_manha },
        { periodo: 'tarde', condicao: (r.clima_tarde as CondPeriodo['condicao']) ?? 'claro', praticavel: r.mm_chuva_tarde < 2, mm_chuva: r.mm_chuva_tarde },
        { periodo: 'noite', condicao: (r.clima_noite as CondPeriodo['condicao']) ?? 'claro', praticavel: r.mm_chuva_noite < 2, mm_chuva: r.mm_chuva_noite },
      ];

      return {
        periodos,
        confianca: 0.3,
        fonte: 'historico_local',
        pre_preencher: false,
        data: ctx.data,
        tenant_id: ctx.tenant_id,
      };
    } catch (fallbackErr) {
      this.logger.error(`AGENTE-CLIMA fallback DB falhou: ${(fallbackErr as Error).message}`);
      return this.fallbackVazio(ctx);
    }
  }

  private fallbackVazio(ctx: AgenteClimaCtx): AgenteClimaResult {
    const periodos: CondPeriodo[] = [
      { periodo: 'manha', condicao: 'claro', praticavel: true, mm_chuva: 0 },
      { periodo: 'tarde', condicao: 'claro', praticavel: true, mm_chuva: 0 },
      { periodo: 'noite', condicao: 'claro', praticavel: true, mm_chuva: 0 },
    ];
    return {
      periodos,
      confianca: 0.1,
      fonte: 'historico_local',
      pre_preencher: false,
      data: ctx.data,
      tenant_id: ctx.tenant_id,
    };
  }
}
