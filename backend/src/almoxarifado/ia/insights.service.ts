// backend/src/almoxarifado/ia/insights.service.ts
import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService }         from '../../prisma/prisma.service';
import { AgenteReorderService }  from './agente-reorder.service';
import { AgenteAnomaliaService } from './agente-anomalia.service';
import { SolicitacaoService }    from '../solicitacao/solicitacao.service';
import type { AlmSugestaoIa }    from '../types/alm.types';

const SISTEMA_USUARIO_ID = 1;

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly reorder:    AgenteReorderService,
    private readonly anomalia:   AgenteAnomaliaService,
    private readonly solicitacao: SolicitacaoService,
  ) {}

  // ── Leitura ───────────────────────────────────────────────────────────────

  async listar(tenantId: number): Promise<AlmSugestaoIa[]> {
    return this.prisma.$queryRawUnsafe<AlmSugestaoIa[]>(
      `SELECT * FROM alm_sugestoes_ia
       WHERE tenant_id = $1 AND status = 'pendente'
       ORDER BY
         (dados_json->>'nivel' = 'critico') DESC,
         criado_em DESC`,
      tenantId,
    );
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  async aplicar(
    tenantId: number,
    id: number,
    usuarioId: number,
  ): Promise<{ solicitacao_id: number }> {
    const rows = await this.prisma.$queryRawUnsafe<AlmSugestaoIa[]>(
      `SELECT * FROM alm_sugestoes_ia WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    const sugestao = rows[0];
    if (!sugestao) throw new NotFoundException('Sugestão não encontrada');
    if (sugestao.status !== 'pendente') {
      throw new BadRequestException('Sugestão já foi processada');
    }
    if (sugestao.tipo !== 'reorder') {
      throw new BadRequestException('Apenas sugestões de reposição podem gerar solicitação');
    }

    const dados = sugestao.dados_json as any;
    const sol = await this.solicitacao.criar(tenantId, usuarioId, {
      local_destino_id: sugestao.local_id,
      descricao: `Reposição sugerida por IA — ${sugestao.catalogo_nome}`,
      itens: [{
        catalogo_id: sugestao.catalogo_id,
        quantidade:  dados.recomendacao_qty ?? 1,
        unidade:     sugestao.unidade,
        observacao:  dados.analise_ia ?? undefined,
      }],
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_sugestoes_ia
       SET status = 'aplicado', solicitacao_id = $1, atualizado_em = NOW()
       WHERE id = $2`,
      sol.id, id,
    );

    this.logger.log(JSON.stringify({
      action: 'alm.insights.aplicar',
      tenantId, sugestaoId: id, solicitacaoId: sol.id,
    }));

    return { solicitacao_id: sol.id };
  }

  async ignorar(tenantId: number, id: number): Promise<void> {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE alm_sugestoes_ia
       SET status = 'ignorado', atualizado_em = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'`,
      id, tenantId,
    );
    if ((result as number) === 0) {
      throw new NotFoundException('Sugestão não encontrada ou já processada');
    }
  }

  // ── Job ───────────────────────────────────────────────────────────────────

  async executarParaTodos(): Promise<void> {
    const tenants = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Tenant" WHERE ativo = true`,
    );
    for (const t of tenants) {
      try {
        await this.executarParaTenant(t.id);
      } catch (err: any) {
        this.logger.error(`Erro ao executar insights para tenant ${t.id}: ${err.message}`);
      }
    }
  }

  async executarParaTenant(tenantId: number): Promise<void> {
    const locais = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_locais WHERE tenant_id = $1 AND ativo = true`,
      tenantId,
    );

    for (const local of locais) {
      const [reorderPreds, anomalias] = await Promise.all([
        this.reorder.executar(tenantId, local.id).catch(() => []),
        this.anomalia.executar(tenantId, local.id).catch(() => []),
      ]);

      for (const p of reorderPreds) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO alm_sugestoes_ia
             (tenant_id, tipo, catalogo_id, catalogo_nome, local_id, unidade, dados_json)
           VALUES ($1, 'reorder', $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT ON CONSTRAINT uq_alm_sugestoes_ia_key
           DO UPDATE SET
             dados_json    = EXCLUDED.dados_json,
             catalogo_nome = EXCLUDED.catalogo_nome,
             atualizado_em = NOW()
           WHERE alm_sugestoes_ia.status = 'pendente'`,
          tenantId, p.catalogo_id, p.catalogo_nome, local.id, p.unidade,
          JSON.stringify(p),
        );
      }

      for (const a of anomalias) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO alm_sugestoes_ia
             (tenant_id, tipo, catalogo_id, catalogo_nome, local_id, unidade, dados_json)
           VALUES ($1, 'anomalia', $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT ON CONSTRAINT uq_alm_sugestoes_ia_key
           DO UPDATE SET
             dados_json    = EXCLUDED.dados_json,
             catalogo_nome = EXCLUDED.catalogo_nome,
             atualizado_em = NOW()
           WHERE alm_sugestoes_ia.status = 'pendente'`,
          tenantId, a.catalogo_id, a.catalogo_nome, local.id, a.unidade,
          JSON.stringify(a),
        );
      }
    }

    this.logger.log(JSON.stringify({
      action: 'alm.insights.executar',
      tenantId,
      locais: locais.length,
    }));
  }
}
