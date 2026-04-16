// backend/src/planos-acao/pa/pa.service.ts
import {
  Injectable, NotFoundException, ForbiddenException,
  UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaDto } from '../dto/create-pa.dto';
import { UpdatePaDto } from '../dto/update-pa.dto';
import { TransicaoDto } from '../dto/transicao.dto';

export interface AvaliarGatilhosContexto {
  taxaConformidade?: number;
  temItemCriticoNc?: boolean;
  obraId: number;
  tituloSugerido?: string;
}

@Injectable()
export class PaService {
  private readonly logger = new Logger(PaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async getPaOuFalhar(tenantId: number, paId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT p.*, e.nome AS etapa_nome, e.cor AS etapa_cor,
              e.is_final AS etapa_is_final, e.roles_transicao AS etapa_roles_transicao
       FROM pa_plano_acao p
       JOIN pa_config_etapa e ON e.id = p.etapa_atual_id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
      paId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Plano de Ação ${paId} não encontrado`);
    return rows[0];
  }

  private async gerarNumero(tenantId: number): Promise<string> {
    const ano = new Date().getFullYear();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS total FROM pa_plano_acao WHERE tenant_id = $1 AND numero LIKE $2`,
      tenantId, `PA-${ano}-%`,
    );
    const seq = Number(rows[0].total) + 1;
    return `PA-${ano}-${String(seq).padStart(4, '0')}`;
  }

  private async getEtapaInicialDoCiclo(cicloId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_etapa WHERE ciclo_id = $1 AND is_inicial = TRUE ORDER BY ordem LIMIT 1`,
      cicloId,
    );
    if (!rows.length) {
      throw new UnprocessableEntityException(
        `O ciclo ${cicloId} não possui etapa inicial configurada (is_inicial = true)`,
      );
    }
    return rows[0];
  }

  private validarCamposObrigatorios(
    campos: any[],
    camposExtras: Record<string, unknown>,
  ): void {
    for (const campo of campos) {
      if (campo.obrigatorio) {
        const val = camposExtras[campo.chave];
        if (val === undefined || val === null || val === '') {
          throw new UnprocessableEntityException(
            `Campo obrigatório ausente na transição: "${campo.nome}" (chave: ${campo.chave})`,
          );
        }
      }
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async listPas(
    tenantId: number,
    filters: {
      obraId?: number;
      etapaId?: number;
      prioridade?: string;
      responsavelId?: number;
      modulo?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: any[]; total: number }> {
    const conditions: string[] = [`p.tenant_id = $1`, `p.deleted_at IS NULL`];
    const vals: unknown[] = [tenantId];
    let i = 2;

    if (filters.obraId)       { conditions.push(`p.obra_id = $${i++}`);          vals.push(filters.obraId); }
    if (filters.etapaId)      { conditions.push(`p.etapa_atual_id = $${i++}`);   vals.push(filters.etapaId); }
    if (filters.prioridade)   { conditions.push(`p.prioridade = $${i++}`);       vals.push(filters.prioridade); }
    if (filters.responsavelId){ conditions.push(`p.responsavel_id = $${i++}`);   vals.push(filters.responsavelId); }
    if (filters.modulo)       { conditions.push(`p.modulo = $${i++}`);           vals.push(filters.modulo); }

    const where = conditions.join(' AND ');
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;
    const offset = (page - 1) * limit;

    const [countRows, items] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) AS total FROM pa_plano_acao p WHERE ${where}`,
        ...vals,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT p.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.ordem AS etapa_ordem
         FROM pa_plano_acao p
         JOIN pa_config_etapa e ON e.id = p.etapa_atual_id
         WHERE ${where}
         ORDER BY p.created_at DESC
         LIMIT $${i++} OFFSET $${i}`,
        ...vals, limit, offset,
      ),
    ]);

    return { items, total: Number(countRows[0].total) };
  }

  async getPa(tenantId: number, paId: number): Promise<any> {
    const pa = await this.getPaOuFalhar(tenantId, paId);

    const [etapas, historico, campos] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM pa_config_etapa WHERE ciclo_id = $1 ORDER BY ordem`,
        pa.ciclo_id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT h.*, ed.nome AS etapa_de_nome, ep.nome AS etapa_para_nome
         FROM pa_historico h
         LEFT JOIN pa_config_etapa ed ON ed.id = h.etapa_de_id
         JOIN pa_config_etapa ep ON ep.id = h.etapa_para_id
         WHERE h.pa_id = $1
         ORDER BY h.created_at DESC`,
        paId,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM pa_config_campo WHERE etapa_id = $1 ORDER BY ordem`,
        pa.etapa_atual_id,
      ),
    ]);

    return { ...pa, etapas_ciclo: etapas, historico, campos_etapa_atual: campos };
  }

  async createPa(tenantId: number, userId: number, dto: CreatePaDto): Promise<any> {
    const etapaInicial = await this.getEtapaInicialDoCiclo(dto.cicloId);
    const numero = await this.gerarNumero(tenantId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_plano_acao
         (tenant_id, ciclo_id, etapa_atual_id, modulo, origem_tipo, origem_id,
          obra_id, numero, titulo, descricao, prioridade, responsavel_id,
          prazo, campos_extras, aberto_por)
       VALUES ($1,$2,$3,'FVS',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
       RETURNING *`,
      tenantId,
      dto.cicloId,
      etapaInicial.id,
      dto.origemTipo ?? 'MANUAL',
      dto.origemId ?? null,
      dto.obraId,
      numero,
      dto.titulo,
      dto.descricao ?? null,
      dto.prioridade ?? 'MEDIA',
      dto.responsavelId ?? null,
      dto.prazo ?? null,
      JSON.stringify(dto.camposExtras ?? {}),
      userId,
    );

    const pa = rows[0];

    // Record initial history entry
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO pa_historico
         (tenant_id, pa_id, etapa_de_id, etapa_para_id, comentario, campos_extras, criado_por)
       VALUES ($1, $2, NULL, $3, 'PA aberto', '{}'::jsonb, $4)`,
      tenantId, pa.id, etapaInicial.id, userId,
    );

    return pa;
  }

  async updatePa(tenantId: number, paId: number, dto: UpdatePaDto): Promise<any> {
    await this.getPaOuFalhar(tenantId, paId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.titulo         !== undefined) { sets.push(`titulo = $${i++}`);          vals.push(dto.titulo); }
    if (dto.descricao      !== undefined) { sets.push(`descricao = $${i++}`);        vals.push(dto.descricao); }
    if (dto.prioridade     !== undefined) { sets.push(`prioridade = $${i++}`);       vals.push(dto.prioridade); }
    if (dto.responsavelId  !== undefined) { sets.push(`responsavel_id = $${i++}`);   vals.push(dto.responsavelId); }
    if (dto.prazo          !== undefined) { sets.push(`prazo = $${i++}`);            vals.push(dto.prazo); }
    if (dto.camposExtras   !== undefined) {
      sets.push(`campos_extras = $${i++}::jsonb`);
      vals.push(JSON.stringify(dto.camposExtras));
    }
    sets.push(`updated_at = NOW()`);
    vals.push(paId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_plano_acao SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} AND deleted_at IS NULL RETURNING *`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Plano de Ação ${paId} não encontrado`);
    return rows[0];
  }

  async transicionarEtapa(
    tenantId: number,
    paId: number,
    userId: number,
    userRole: string,
    dto: TransicaoDto,
  ): Promise<any> {
    const pa = await this.getPaOuFalhar(tenantId, paId);

    // Verify role permission for current stage
    const rolesPermitidos: string[] = pa.etapa_roles_transicao ?? [];
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(userRole)) {
      throw new ForbiddenException('Sem permissão para transicionar nesta etapa');
    }

    // Verify target stage belongs to same cycle
    const etapaParaRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_etapa WHERE id = $1 AND ciclo_id = $2`,
      dto.etapaParaId, pa.ciclo_id,
    );
    if (!etapaParaRows.length) {
      throw new UnprocessableEntityException(
        `Etapa ${dto.etapaParaId} não pertence ao ciclo do PA`,
      );
    }
    const etapaPara = etapaParaRows[0];

    // Validate required fields for target stage
    const camposProxEtapa = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_campo WHERE etapa_id = $1 ORDER BY ordem`,
      dto.etapaParaId,
    );
    this.validarCamposObrigatorios(camposProxEtapa, dto.camposExtras ?? {});

    // Merge campos_extras
    const camposAtualizados = { ...pa.campos_extras, ...(dto.camposExtras ?? {}) };

    const fechadoPor = etapaPara.is_final ? userId : null;

    return this.prisma.$transaction(async (tx) => {
      const paRows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE pa_plano_acao
         SET etapa_atual_id = $1,
             campos_extras = $2::jsonb,
             fechado_em = ${etapaPara.is_final ? 'NOW()' : 'NULL'},
             fechado_por = $3,
             updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
         RETURNING *`,
        dto.etapaParaId,
        JSON.stringify(camposAtualizados),
        fechadoPor,
        paId,
        tenantId,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO pa_historico
           (tenant_id, pa_id, etapa_de_id, etapa_para_id, comentario, campos_extras, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        tenantId,
        paId,
        pa.etapa_atual_id,
        dto.etapaParaId,
        dto.comentario ?? null,
        JSON.stringify(dto.camposExtras ?? {}),
        userId,
      );

      return paRows[0];
    });
  }

  async deletePa(tenantId: number, paId: number): Promise<void> {
    await this.getPaOuFalhar(tenantId, paId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE pa_plano_acao SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      paId, tenantId,
    );
  }

  // ── Auto-trigger ─────────────────────────────────────────────────────────────

  async avaliarGatilhos(
    tenantId: number,
    origemTipo: 'INSPECAO_FVS' | 'NC_FVS',
    origemId: number,
    contexto: AvaliarGatilhosContexto,
  ): Promise<void> {
    const gatilhos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT g.*, c.id AS ciclo_id
       FROM pa_config_gatilho g
       JOIN pa_config_ciclo c ON c.id = g.ciclo_id
       WHERE g.tenant_id = $1 AND g.modulo = 'FVS' AND g.ativo = TRUE AND c.ativo = TRUE`,
      tenantId,
    );

    for (const gatilho of gatilhos) {
      let deveAbrir = false;

      if (
        gatilho.condicao === 'TAXA_CONFORMIDADE_ABAIXO' &&
        contexto.taxaConformidade !== undefined &&
        contexto.taxaConformidade < Number(gatilho.valor_limiar)
      ) {
        deveAbrir = true;
      } else if (
        gatilho.condicao === 'ITEM_CRITICO_NC' &&
        contexto.temItemCriticoNc === true
      ) {
        deveAbrir = true;
      }

      if (!deveAbrir) continue;

      // Check for existing open PA with same origin
      const existing = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM pa_plano_acao
         WHERE tenant_id = $1 AND origem_tipo = $2 AND origem_id = $3
           AND deleted_at IS NULL AND fechado_em IS NULL
         LIMIT 1`,
        tenantId, origemTipo, origemId,
      );
      if (existing.length) {
        this.logger.log(
          `Gatilho ${gatilho.id} disparou mas PA já existe para ${origemTipo}#${origemId} — ignorando`,
        );
        continue;
      }

      try {
        await this.createPa(tenantId, 0 /* sistema */, {
          cicloId: gatilho.ciclo_id,
          obraId: contexto.obraId,
          titulo: contexto.tituloSugerido ?? `PA automático — ${origemTipo}#${origemId}`,
          origemTipo,
          origemId,
          prioridade: 'ALTA',
        });
        this.logger.log(
          `PA criado automaticamente via gatilho ${gatilho.id} para ${origemTipo}#${origemId}`,
        );
      } catch (err) {
        this.logger.error(
          `Falha ao criar PA automático via gatilho ${gatilho.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
