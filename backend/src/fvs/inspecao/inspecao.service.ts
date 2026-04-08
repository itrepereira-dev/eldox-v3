// backend/src/fvs/inspecao/inspecao.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  FichaFvs, FichaFvsComProgresso, FichaDetalhada, FvsGrade,
  FvsRegistro, FvsEvidencia, StatusFicha, StatusGrade,
} from '../types/fvs.types';
import type { CreateFichaDto } from './dto/create-ficha.dto';
import type { UpdateFichaDto } from './dto/update-ficha.dto';
import type { PutRegistroDto } from './dto/put-registro.dto';
import type { UpdateLocalDto } from './dto/update-local.dto';

// Transições de status válidas: de → [destinos permitidos]
const TRANSICOES_VALIDAS: Record<StatusFicha, StatusFicha[]> = {
  rascunho: ['em_inspecao'],
  em_inspecao: ['concluida', 'rascunho'],
  concluida: ['em_inspecao'],
};

@Injectable()
export class InspecaoService {
  private readonly logger = new Logger(InspecaoService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ── Helper: buscar ficha com validação de tenant ────────────────────────────

  private async getFichaOuFalhar(tenantId: number, fichaId: number): Promise<FichaFvs> {
    const rows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    return rows[0];
  }

  // ── Helper: audit_log (INSERT ONLY) ────────────────────────────────────────

  private async gravarAuditLog(
    tx: any,
    params: {
      tenantId: number; fichaId: number; usuarioId: number;
      acao: string; statusDe?: string; statusPara?: string;
      registroId?: number; ip?: string; detalhes?: object;
    },
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO fvs_audit_log
         (tenant_id, ficha_id, registro_id, acao, status_de, status_para, usuario_id, ip_origem, detalhes, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9::jsonb, NOW())`,
      params.tenantId, params.fichaId, params.registroId ?? null,
      params.acao, params.statusDe ?? null, params.statusPara ?? null,
      params.usuarioId, params.ip ?? null,
      params.detalhes ? JSON.stringify(params.detalhes) : null,
    );
  }

  // ── createFicha ─────────────────────────────────────────────────────────────

  async createFicha(
    tenantId: number,
    userId: number,
    dto: CreateFichaDto,
    ip?: string,
  ): Promise<FichaFvs> {
    return this.prisma.$transaction(async (tx) => {
      const fichas = await tx.$queryRawUnsafe<FichaFvs[]>(
        `INSERT INTO fvs_fichas (tenant_id, obra_id, nome, regime, status, criado_por)
         VALUES ($1, $2, $3, $4, 'rascunho', $5)
         RETURNING *`,
        tenantId, dto.obraId, dto.nome, dto.regime, userId,
      );
      const ficha = fichas[0];

      for (const svc of dto.servicos) {
        const fichaServicos = await tx.$queryRawUnsafe<{ id: number }[]>(
          `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          tenantId, ficha.id, svc.servicoId,
          svc.itensExcluidos ? JSON.stringify(svc.itensExcluidos) : null,
        );
        const fichaServicoId = fichaServicos[0].id;

        for (const localId of svc.localIds) {
          await tx.$queryRawUnsafe(
            `INSERT INTO fvs_ficha_servico_locais (tenant_id, ficha_servico_id, obra_local_id)
             VALUES ($1, $2, $3)`,
            tenantId, fichaServicoId, localId,
          );
        }
      }

      if (dto.regime === 'pbqph') {
        await this.gravarAuditLog(tx, {
          tenantId, fichaId: ficha.id, usuarioId: userId,
          acao: 'abertura_ficha', ip,
        });
      }

      return ficha;
    });
  }

  // ── getFichas ───────────────────────────────────────────────────────────────

  async getFichas(
    tenantId: number,
    obraId?: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: FichaFvsComProgresso[]; total: number; page: number }> {
    const offset = (page - 1) * limit;

    let rows: (FichaFvsComProgresso & { total_count: string })[];

    if (obraId !== undefined) {
      rows = await this.prisma.$queryRawUnsafe<(FichaFvsComProgresso & { total_count: string })[]>(
        `SELECT f.*,
                COUNT(*) OVER() AS total_count,
                COALESCE(
                  ROUND(
                    100.0 * COUNT(r.id) FILTER (WHERE r.status <> 'nao_avaliado') /
                    NULLIF(COUNT(r.id), 0)
                  )::int, 0
                ) AS progresso
         FROM fvs_fichas f
         LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
         WHERE f.tenant_id = $1 AND f.obra_id = $2 AND f.deleted_at IS NULL
         GROUP BY f.id
         ORDER BY f.created_at DESC
         LIMIT $3 OFFSET $4`,
        tenantId, obraId, limit, offset,
      );
    } else {
      rows = await this.prisma.$queryRawUnsafe<(FichaFvsComProgresso & { total_count: string })[]>(
        `SELECT f.*,
                COUNT(*) OVER() AS total_count,
                COALESCE(
                  ROUND(
                    100.0 * COUNT(r.id) FILTER (WHERE r.status <> 'nao_avaliado') /
                    NULLIF(COUNT(r.id), 0)
                  )::int, 0
                ) AS progresso
         FROM fvs_fichas f
         LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
         WHERE f.tenant_id = $1 AND f.deleted_at IS NULL
         GROUP BY f.id
         ORDER BY f.created_at DESC
         LIMIT $2 OFFSET $3`,
        tenantId, limit, offset,
      );
    }

    const total = rows.length ? Number(rows[0].total_count) : 0;
    return {
      data: rows.map(r => ({ ...r, progresso: Number(r.progresso) })),
      total,
      page,
    };
  }

  // ── getFicha (detalhada) ────────────────────────────────────────────────────

  async getFicha(tenantId: number, fichaId: number): Promise<FichaDetalhada> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    const servicos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT fs.*, s.nome AS servico_nome
       FROM fvs_ficha_servicos fs
       JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
       WHERE fs.ficha_id = $1 AND fs.tenant_id = $2
       ORDER BY fs.ordem ASC`,
      fichaId, tenantId,
    );

    for (const srv of servicos) {
      srv.locais = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT fsl.*, ol.nome AS local_nome
         FROM fvs_ficha_servico_locais fsl
         JOIN "ObraLocal" ol ON ol.id = fsl.obra_local_id
         WHERE fsl.ficha_servico_id = $1 AND fsl.tenant_id = $2`,
        srv.id, tenantId,
      );
    }

    const prog = await this.prisma.$queryRawUnsafe<{ progresso: number }[]>(
      `SELECT COALESCE(
         ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'nao_avaliado') / NULLIF(COUNT(*), 0))::int, 0
       ) AS progresso
       FROM fvs_registros WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );

    return { ...ficha, servicos, progresso: Number(prog[0].progresso) };
  }

  // ── patchFicha ──────────────────────────────────────────────────────────────

  async patchFicha(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: UpdateFichaDto,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (dto.status && dto.status !== ficha.status) {
      const permitidos = TRANSICOES_VALIDAS[ficha.status as StatusFicha] ?? [];
      if (!permitidos.includes(dto.status as StatusFicha)) {
        throw new ConflictException(
          `Transição de status inválida: ${ficha.status} → ${dto.status}`,
        );
      }

      if (dto.status === 'concluida' && ficha.regime === 'pbqph') {
        await this.validarConclusaoPbqph(tenantId, fichaId);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (dto.nome   !== undefined) { sets.push(`nome = $${i++}`);   vals.push(dto.nome); }
      if (dto.status !== undefined) { sets.push(`status = $${i++}`); vals.push(dto.status); }
      sets.push(`updated_at = NOW()`);
      const idIdx = i++;
      const tenantIdx = i++;
      vals.push(fichaId, tenantId);

      const rows = await tx.$queryRawUnsafe<FichaFvs[]>(
        `UPDATE fvs_fichas SET ${sets.join(', ')} WHERE id = $${idIdx} AND tenant_id = $${tenantIdx} RETURNING *`,
        ...vals,
      );

      if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada após update`);

      if (dto.status && dto.status !== ficha.status && ficha.regime === 'pbqph') {
        await this.gravarAuditLog(tx, {
          tenantId, fichaId, usuarioId: userId,
          acao: 'alteracao_status', statusDe: ficha.status, statusPara: dto.status, ip,
        });
      }

      return rows[0];
    });
  }

  // ── deleteFicha ─────────────────────────────────────────────────────────────

  async deleteFicha(tenantId: number, fichaId: number): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Só é possível excluir fichas com status rascunho');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_fichas SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );
  }

  // ── validarConclusaoPbqph ──────────────────────────────────────────────────

  private async validarConclusaoPbqph(tenantId: number, fichaId: number): Promise<void> {
    const pendentes = await this.prisma.$queryRawUnsafe<{ item_id: number; descricao: string }[]>(
      `SELECT r.item_id, i.descricao
       FROM fvs_registros r
       JOIN fvs_catalogo_itens i ON i.id = r.item_id
       WHERE r.ficha_id = $1 AND r.tenant_id = $2
         AND r.status = 'nao_conforme'
         AND i.criticidade = 'critico'
         AND NOT EXISTS (
           SELECT 1 FROM fvs_evidencias e WHERE e.registro_id = r.id AND e.tenant_id = r.tenant_id
         )`,
      fichaId, tenantId,
    );

    if (pendentes.length) {
      throw new UnprocessableEntityException({
        message: 'Itens críticos NC sem evidência fotográfica',
        itensPendentes: pendentes,
      });
    }
  }

  // ── addServico ────────────────────────────────────────────────────────────────

  async addServico(
    tenantId: number,
    fichaId: number,
    dto: { servicoId: number; localIds: number[]; itensExcluidos?: number[] },
  ): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Serviços só podem ser adicionados com ficha em rascunho');
    }

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        tenantId, fichaId, dto.servicoId,
        dto.itensExcluidos ? JSON.stringify(dto.itensExcluidos) : null,
      );
      const fichaServicoId = rows[0].id;

      for (const localId of dto.localIds) {
        await tx.$queryRawUnsafe(
          `INSERT INTO fvs_ficha_servico_locais (tenant_id, ficha_servico_id, obra_local_id) VALUES ($1, $2, $3)`,
          tenantId, fichaServicoId, localId,
        );
      }
    });
  }

  // ── removeServico ─────────────────────────────────────────────────────────────

  async removeServico(tenantId: number, fichaId: number, servicoId: number): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Serviços só podem ser removidos com ficha em rascunho');
    }
    // fvs_ficha_servico_locais é apagado por CASCADE (ver migration fvs_inspecao)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_ficha_servicos WHERE ficha_id = $1 AND servico_id = $2 AND tenant_id = $3`,
      fichaId, servicoId, tenantId,
    );
  }

  // ── getGrade ─────────────────────────────────────────────────────────────────

  async getGrade(
    tenantId: number,
    fichaId: number,
    filtros?: { pavimentoId?: number; servicoId?: number },
  ): Promise<FvsGrade> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    // Parameterized filter for servico (optional)
    const servicoParams: unknown[] = [fichaId, tenantId];
    let servicoExtra = '';
    if (filtros?.servicoId) {
      servicoParams.push(filtros.servicoId);
      servicoExtra = `AND fs.servico_id = $${servicoParams.length}`;
    }

    const servicos = await this.prisma.$queryRawUnsafe<{ id: number; nome: string }[]>(
      `SELECT s.id, s.nome
       FROM fvs_ficha_servicos fs
       JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
       WHERE fs.ficha_id = $1 AND fs.tenant_id = $2 ${servicoExtra}
       ORDER BY fs.ordem ASC`,
      ...servicoParams,
    );

    // Parameterized filter for pavimento (optional)
    const localParams: unknown[] = [fichaId, tenantId];
    let pavimentoExtra = '';
    if (filtros?.pavimentoId) {
      localParams.push(filtros.pavimentoId);
      pavimentoExtra = `AND ol.pavimento_id = $${localParams.length}`;
    }

    const locais = await this.prisma.$queryRawUnsafe<{ id: number; nome: string; pavimento_id: number | null }[]>(
      `SELECT DISTINCT ol.id, ol.nome, ol.pavimento_id
       FROM fvs_ficha_servico_locais fsl
       JOIN "ObraLocal" ol ON ol.id = fsl.obra_local_id
       JOIN fvs_ficha_servicos fs ON fs.id = fsl.ficha_servico_id
       WHERE fs.ficha_id = $1 AND fsl.tenant_id = $2 ${pavimentoExtra}
       ORDER BY ol.nome ASC`,
      ...localParams,
    );

    const registros = await this.prisma.$queryRawUnsafe<{ servico_id: number; obra_local_id: number; status: string }[]>(
      `SELECT servico_id, obra_local_id, status
       FROM fvs_registros
       WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );

    // Algoritmo de agregação: NC > Aprovado > Não avaliado > Pendente
    const celulas: Record<number, Record<number, StatusGrade>> = {};
    for (const srv of servicos) {
      celulas[srv.id] = {};
      for (const loc of locais) {
        const celReg = registros.filter(r => r.servico_id === srv.id && r.obra_local_id === loc.id);
        celulas[srv.id][loc.id] = this.calcularStatusCelula(celReg.map(r => r.status));
      }
    }

    return { servicos, locais, celulas };
  }

  private calcularStatusCelula(statuses: string[]): StatusGrade {
    if (!statuses.length) return 'nao_avaliado';
    if (statuses.some(s => s === 'nao_conforme')) return 'nc';
    if (statuses.every(s => s === 'conforme' || s === 'excecao')) return 'aprovado';
    if (statuses.every(s => s === 'nao_avaliado')) return 'nao_avaliado';
    return 'pendente';
  }

  // ── Métodos adicionais (Tasks 5, 6) — serão adicionados depois ──────────────
  // getRegistros, putRegistro, createEvidencia, deleteEvidencia, getEvidencias, patchLocal
}
