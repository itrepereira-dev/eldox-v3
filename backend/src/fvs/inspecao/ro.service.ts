// backend/src/fvs/inspecao/ro.service.ts
import {
  Injectable, NotFoundException, ConflictException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GedService } from '../../ged/ged.service';
import { UploadDocumentoDto } from '../../ged/dto/upload-documento.dto';
import type {
  RoOcorrencia, RoServicoNc, RoServicoEvidencia, FichaFvs,
} from '../types/fvs.types';
import type { PatchRoDto } from './dto/patch-ro.dto';
import type { PatchServicoNcDto } from './dto/patch-servico-nc.dto';

@Injectable()
export class RoService {
  private readonly logger = new Logger(RoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService,
  ) {}

  // ── getRo ───────────────────────────────────────────────────────────────────

  async getRo(tenantId: number, fichaId: number): Promise<RoOcorrencia> {
    const rows = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `SELECT * FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`RO não encontrado para ficha ${fichaId}`);

    const ro = rows[0];

    const servicos = await this.prisma.$queryRawUnsafe<RoServicoNc[]>(
      `SELECT * FROM ro_servicos_nc WHERE ro_id = $1 AND tenant_id = $2 ORDER BY id ASC`,
      ro.id, tenantId,
    );

    for (const svc of servicos) {
      svc.itens = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM ro_servico_itens_nc WHERE ro_servico_nc_id = $1 AND tenant_id = $2`,
        svc.id, tenantId,
      );
      svc.evidencias = await this.prisma.$queryRawUnsafe<RoServicoEvidencia[]>(
        `SELECT e.*, gv.nome_original, gv.storage_key
         FROM ro_servico_evidencias e
         JOIN ged_versoes gv ON gv.id = e.versao_ged_id
         WHERE e.ro_servico_nc_id = $1 AND e.tenant_id = $2 ORDER BY e.created_at ASC`,
        svc.id, tenantId,
      );
    }

    ro.servicos = servicos;
    return ro;
  }

  // ── patchRo ─────────────────────────────────────────────────────────────────

  async patchRo(tenantId: number, fichaId: number, dto: PatchRoDto): Promise<RoOcorrencia> {
    const roRows = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `SELECT * FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );
    if (!roRows.length) throw new NotFoundException(`RO não encontrado para ficha ${fichaId}`);
    const ro = roRows[0];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.tipo                !== undefined) { sets.push(`tipo = $${i++}`);                vals.push(dto.tipo); }
    if (dto.responsavel_id      !== undefined) { sets.push(`responsavel_id = $${i++}`);      vals.push(dto.responsavel_id); }
    if (dto.o_que_aconteceu     !== undefined) { sets.push(`o_que_aconteceu = $${i++}`);     vals.push(dto.o_que_aconteceu); }
    if (dto.acao_imediata       !== undefined) { sets.push(`acao_imediata = $${i++}`);       vals.push(dto.acao_imediata); }
    if (dto.causa_6m            !== undefined) { sets.push(`causa_6m = $${i++}`);            vals.push(dto.causa_6m); }
    if (dto.justificativa_causa !== undefined) { sets.push(`justificativa_causa = $${i++}`); vals.push(dto.justificativa_causa); }
    sets.push(`updated_at = NOW()`);
    vals.push(ro.id, tenantId);

    const updated = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `UPDATE ro_ocorrencias SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return updated[0];
  }

  // ── patchServicoNc ───────────────────────────────────────────────────────────

  async patchServicoNc(
    tenantId: number,
    fichaId: number,
    servicoNcId: number,
    dto: PatchServicoNcDto,
    userId?: number,
    ip?: string,
  ): Promise<RoServicoNc> {
    const roRows = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `SELECT * FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );
    if (!roRows.length) throw new NotFoundException(`RO não encontrado para ficha ${fichaId}`);
    const ro = roRows[0];

    const svcRows = await this.prisma.$queryRawUnsafe<RoServicoNc[]>(
      `SELECT * FROM ro_servicos_nc WHERE id = $1 AND ro_id = $2 AND tenant_id = $3`,
      servicoNcId, ro.id, tenantId,
    );
    if (!svcRows.length) throw new NotFoundException(`ServicoNC ${servicoNcId} não encontrado`);
    const svc = svcRows[0];

    if (svc.status === 'verificado') {
      throw new ConflictException(`Serviço ${servicoNcId} já está verificado — status imutável`);
    }

    if (dto.desbloquear) {
      // Buscar ficha para verificar regime
      const fichaRows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
        `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        fichaId, tenantId,
      );
      const ficha = fichaRows[0];

      // PBQP-H: campos obrigatórios antes de desbloquear
      if (ficha?.regime === 'pbqph') {
        if (!ro.tipo || !ro.responsavel_id || !ro.causa_6m) {
          throw new UnprocessableEntityException(
            'PBQP-H: tipo, responsavel_id e causa_6m obrigatórios no RO antes de desbloquear',
          );
        }
      }

      return this.prisma.$transaction(async (tx) => {
        // Buscar itens NC do serviço
        const itens = await tx.$queryRawUnsafe<{ id: number; registro_id: number; item_id?: number }[]>(
          `SELECT rsni.id, rsni.registro_id
           FROM ro_servico_itens_nc rsni
           WHERE rsni.ro_servico_nc_id = $1 AND rsni.tenant_id = $2`,
          servicoNcId, tenantId,
        );

        // Determinar próximo ciclo
        const novoCiclo = (svc.ciclo_reinspecao ?? 1) + 1;

        // Para cada item NC, criar fvs_registros com ciclo=novoCiclo
        for (const item of itens) {
          const regOriginal = await tx.$queryRawUnsafe<any[]>(
            `SELECT * FROM fvs_registros WHERE id = $1 AND tenant_id = $2`,
            item.registro_id, tenantId,
          );
          if (!regOriginal.length) continue;
          const orig = regOriginal[0];

          await tx.$executeRawUnsafe(
            `INSERT INTO fvs_registros
               (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, inspecionado_por, inspecionado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO NOTHING`,
            tenantId, fichaId, orig.servico_id, orig.item_id, orig.obra_local_id, novoCiclo,
            'nao_avaliado', userId ?? null,
          );
        }

        // Marcar serviço como desbloqueado
        const updatedSvc = await tx.$queryRawUnsafe<RoServicoNc[]>(
          `UPDATE ro_servicos_nc
           SET status = 'desbloqueado', ciclo_reinspecao = $1, desbloqueado_em = NOW()
           WHERE id = $2 AND tenant_id = $3
           RETURNING *`,
          novoCiclo, servicoNcId, tenantId,
        );

        // Audit log (PBQP-H)
        if (ficha?.regime === 'pbqph' && userId) {
          await tx.$executeRawUnsafe(
            `INSERT INTO fvs_audit_log
               (tenant_id, ficha_id, acao, usuario_id, ip_origem, detalhes, criado_em)
             VALUES ($1, $2, $3, $4, $5::inet, $6::jsonb, NOW())`,
            tenantId, fichaId, 'desbloqueio_servico_nc',
            userId, ip ?? null,
            JSON.stringify({ servicoNcId, novoCiclo }),
          );
        }

        return updatedSvc[0];
      });
    }

    // Apenas atualizar acao_corretiva (sem desbloquear)
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.acao_corretiva !== undefined) { sets.push(`acao_corretiva = $${i++}`); vals.push(dto.acao_corretiva); }
    if (!sets.length) return svc;

    vals.push(servicoNcId, tenantId);
    const updated = await this.prisma.$queryRawUnsafe<RoServicoNc[]>(
      `UPDATE ro_servicos_nc SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return updated[0];
  }

  // ── createRoEvidencia ────────────────────────────────────────────────────────

  async createRoEvidencia(
    tenantId: number,
    fichaId: number,
    servicoNcId: number,
    userId: number,
    file: Express.Multer.File,
    descricao?: string,
    ip?: string,
  ): Promise<RoServicoEvidencia> {
    const fichaRows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!fichaRows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    const ficha = fichaRows[0];

    const catRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_categorias WHERE codigo = 'FTO' AND tenant_id IN (0, $1) LIMIT 1`,
      tenantId,
    );
    if (!catRows.length) throw new NotFoundException('Categoria GED FTO não configurada');

    const pastaRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_pastas
       WHERE tenant_id = $1 AND obra_id = $2 AND nome = 'Evidências RO' AND escopo = 'OBRA' LIMIT 1`,
      tenantId, ficha.obra_id,
    );
    let pastaId: number;
    if (pastaRows.length) {
      pastaId = pastaRows[0].id;
    } else {
      const np = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ged_pastas (tenant_id, escopo, obra_id, nome, caminho)
         VALUES ($1, 'OBRA', $2, 'Evidências RO', '/0/') RETURNING id`,
        tenantId, ficha.obra_id,
      );
      pastaId = np[0].id;
    }

    const gedResult = await this.ged.upload(
      tenantId, userId, ficha.obra_id, file,
      {
        titulo: `RO Evidência — servico_nc ${servicoNcId}`,
        categoriaId: catRows[0].id,
        pastaId,
        escopo: 'OBRA',
      } as UploadDocumentoDto,
      ip,
    );

    const evRows = await this.prisma.$queryRawUnsafe<RoServicoEvidencia[]>(
      `INSERT INTO ro_servico_evidencias (tenant_id, ro_servico_nc_id, versao_ged_id, descricao)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      tenantId, servicoNcId, gedResult.versaoId, descricao ?? null,
    );
    return evRows[0];
  }

  // ── deleteRoEvidencia ─────────────────────────────────────────────────────────

  async deleteRoEvidencia(
    tenantId: number,
    servicoNcId: number,
    evidenciaId: number,
  ): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; versao_ged_id: number }[]>(
      `SELECT id, versao_ged_id FROM ro_servico_evidencias
       WHERE id = $1 AND ro_servico_nc_id = $2 AND tenant_id = $3`,
      evidenciaId, servicoNcId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Evidência ${evidenciaId} não encontrada`);

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM ro_servico_evidencias WHERE id = $1 AND tenant_id = $2`,
      evidenciaId, tenantId,
    );
    // Marcar versão GED como obsoleta
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes SET status = 'obsoleta', atualizado_em = NOW() WHERE id = $1 AND tenant_id = $2`,
      rows[0].versao_ged_id, tenantId,
    );
  }

  // ── checkAndAdvanceRoStatus ────────────────────────────────────────────────────

  async checkAndAdvanceRoStatus(tenantId: number, fichaId: number): Promise<void> {
    const roRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 AND status = 'aberto' LIMIT 1`,
      fichaId, tenantId,
    );
    if (!roRows.length) return; // sem RO aberto → nada a fazer

    const roId = roRows[0].id;

    await this.prisma.$transaction(async (tx) => {
      // Verificar cada serviço desbloqueado
      const svcDesbloqueados = await tx.$queryRawUnsafe<{ id: number; ciclo_reinspecao: number }[]>(
        `SELECT id, ciclo_reinspecao FROM ro_servicos_nc
         WHERE ro_id = $1 AND tenant_id = $2 AND status = 'desbloqueado'`,
        roId, tenantId,
      );

      for (const svc of svcDesbloqueados) {
        // Contar itens NC deste serviço que ainda não estão conformes no ciclo de reinspeção
        const pendentes = await tx.$queryRawUnsafe<{ pendente_count: string }[]>(
          `SELECT COUNT(*) AS pendente_count
           FROM ro_servico_itens_nc rsni
           JOIN fvs_registros r
             ON r.id IN (
               SELECT id FROM fvs_registros r2
               WHERE r2.ficha_id = (SELECT ficha_id FROM ro_ocorrencias WHERE id = $1)
                 AND r2.item_id = (SELECT r3.item_id FROM fvs_registros r3 WHERE r3.id = rsni.registro_id)
                 AND r2.obra_local_id = (SELECT r3.obra_local_id FROM fvs_registros r3 WHERE r3.id = rsni.registro_id)
                 AND r2.ciclo = $2
                 AND r2.tenant_id = $3
             )
             AND r.status <> 'conforme'
           WHERE rsni.ro_servico_nc_id = $4 AND rsni.tenant_id = $3`,
          roId, svc.ciclo_reinspecao, tenantId, svc.id,
        );

        if (Number(pendentes[0].pendente_count) === 0) {
          await tx.$executeRawUnsafe(
            `UPDATE ro_servicos_nc SET status = 'verificado', verificado_em = NOW() WHERE id = $1 AND tenant_id = $2`,
            svc.id, tenantId,
          );
        }
      }

      // Verificar se todos os serviços do RO estão verificados
      const naoVerificados = await tx.$queryRawUnsafe<{ pendente_count: string }[]>(
        `SELECT COUNT(*) AS pendente_count FROM ro_servicos_nc
         WHERE ro_id = $1 AND tenant_id = $2 AND status IN ('pendente', 'desbloqueado')`,
        roId, tenantId,
      );

      if (Number(naoVerificados[0].pendente_count) === 0) {
        await tx.$executeRawUnsafe(
          `UPDATE ro_ocorrencias SET status = 'concluido', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          roId, tenantId,
        );
      }
    });
  }
}
