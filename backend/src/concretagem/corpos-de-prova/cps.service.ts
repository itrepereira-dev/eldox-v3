// backend/src/concretagem/corpos-de-prova/cps.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCpDto } from './dto/create-cp.dto';
import type { RegistrarRupturaDto } from './dto/registrar-ruptura.dto';

const IDADES_PADRAO = [3, 7, 28];

@Injectable()
export class CpsService {
  private readonly logger = new Logger(CpsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Moldagem de CPs ──────────────────────────────────────────────────────
  // Se idade_dias não informado → cria CPs para 3, 7 e 28 dias

  async moldagem(
    tenantId: number,
    concrtagemId: number,
    userId: number,
    dto: CreateCpDto,
  ) {
    const concretagem = await this.buscarConcretagem(tenantId, concrtagemId);

    const idades = dto.idades && dto.idades.length > 0
      ? dto.idades
      : dto.idade_dias
        ? [dto.idade_dias]
        : IDADES_PADRAO;
    const created: unknown[] = [];

    for (const idadeDias of idades) {
      const numero = await this.gerarNumeroCp(tenantId, concrtagemId, dto.caminhao_id);
      const dataMoldagem = new Date(dto.data_moldagem);
      const dataRupturaPrev = new Date(dataMoldagem);
      dataRupturaPrev.setDate(dataRupturaPrev.getDate() + idadeDias);

      const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO corpos_de_prova
           (tenant_id, concretagem_id, caminhao_id, numero, idade_dias, data_moldagem,
            data_ruptura_prev, laboratorio_id, observacoes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         RETURNING id`,
        tenantId,
        concrtagemId,
        dto.caminhao_id,
        numero,
        idadeDias,
        dto.data_moldagem,
        dataRupturaPrev.toISOString().split('T')[0],
        dto.laboratorio_id ?? null,
        dto.observacoes ?? null,
      );

      created.push(await this.buscarCp(tenantId, rows[0].id));

      this.auditLog(tenantId, userId, 'MOLDAGEM', rows[0].id, null, {
        ...dto,
        idade_dias: idadeDias,
        concretagem_id: concrtagemId,
        obra_id: concretagem.obra_id,
      }).catch((e: unknown) => this.logger.error(`auditLog CP falhou: ${e}`));
    }

    return created;
  }

  // ── Registrar ruptura (resultado de CP) ──────────────────────────────────

  async registrarRuptura(
    tenantId: number,
    cpId: number,
    userId: number,
    dto: RegistrarRupturaDto,
  ) {
    const cp = await this.buscarCp(tenantId, cpId);
    const concretagem = await this.buscarConcretagem(tenantId, cp.concretagem_id as number);

    // Busca fck_especificado da concretagem para comparar
    const fck = concretagem.fck_especificado as number;
    const aprovado = dto.resistencia >= fck;
    const status = aprovado ? 'ROMPIDO_APROVADO' : 'ROMPIDO_REPROVADO';
    const dataReal = dto.data_ruptura_real ?? new Date().toISOString().split('T')[0];

    await this.prisma.$executeRawUnsafe(
      `UPDATE corpos_de_prova
       SET resistencia = $3, status = $4::\"StatusCp\", data_ruptura_real = $5,
           rompido_por = $6, observacoes = COALESCE($7, observacoes), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      cpId,
      dto.resistencia,
      status,
      dataReal,
      userId,
      dto.observacoes ?? null,
    );

    // Verificar se todos os CPs de 28d têm resultado
    if ((concretagem.status as string) === 'EM_RASTREABILIDADE') {
      const aguardando28d = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total
         FROM corpos_de_prova
         WHERE tenant_id = $1 AND concretagem_id = $2
           AND idade_dias = 28
           AND status = 'AGUARDANDO_RUPTURA'`,
        tenantId,
        concretagem.id,
      );
      if (Number(aguardando28d[0]?.total ?? 1) === 0) {
        await this.prisma.$queryRawUnsafe(
          `UPDATE concretagens
           SET status = 'CONCLUIDA'::"StatusConcretagem", updated_at = NOW()
           WHERE tenant_id = $1 AND id = $2`,
          tenantId,
          concretagem.id,
        );
        this.logger.log(`Concretagem ${concretagem.id as number} → CONCLUIDA (todos CPs 28d rompidos)`);
      }
    }

    // NC automática se reprovado
    if (!aprovado) {
      void this.abrirNcAutomatica(
        tenantId,
        concretagem.obra_id as number,
        cp.caminhao_id as number,
        userId,
        'CP_REPROVADO',
        `Corpo de prova ${cp.numero as string} (${cp.idade_dias as number} dias) reprovado: resistência ${dto.resistencia} MPa abaixo do fck especificado de ${fck} MPa.`,
      ).catch((e: unknown) => this.logger.error(`NC automática CP falhou: ${e}`));
    }

    this.auditLog(tenantId, userId, 'RUPTURA', cpId, cp, dto).catch(
      (e: unknown) => this.logger.error(`auditLog ruptura falhou: ${e}`),
    );

    return this.buscarCp(tenantId, cpId);
  }

  // ── Listar CPs por concretagem ───────────────────────────────────────────

  async listarPorConcretagem(tenantId: number, concrtagemId: number) {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, caminhao_id, numero, idade_dias, data_moldagem, data_ruptura_prev,
              data_ruptura_real, resistencia, status, alerta_enviado, created_at
       FROM corpos_de_prova
       WHERE tenant_id = $1 AND concretagem_id = $2
       ORDER BY data_moldagem ASC, idade_dias ASC`,
      tenantId,
      concrtagemId,
    );
  }

  // ── Listar CPs próximos de ruptura ───────────────────────────────────────

  async listarProximosRupturas(tenantId: number, obraId: number, diasAhead = 2) {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT cp.*, b.elemento_estrutural, b.numero AS concretagem_numero
       FROM corpos_de_prova cp
       JOIN concretagens b ON b.id = cp.concretagem_id AND b.tenant_id = cp.tenant_id
       WHERE cp.tenant_id = $1 AND b.obra_id = $2
         AND cp.status = 'AGUARDANDO_RUPTURA'::"StatusCp"
         AND cp.data_ruptura_prev <= NOW() + ($3 || ' days')::interval
       ORDER BY cp.data_ruptura_prev ASC`,
      tenantId,
      obraId,
      diasAhead,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async buscarCp(tenantId: number, id: number): Promise<Record<string, unknown>> {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM corpos_de_prova WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      id,
    );
    if (!rows[0]) throw new NotFoundException('Corpo de prova não encontrado');
    return rows[0];
  }

  private async buscarConcretagem(tenantId: number, concrtagemId: number): Promise<Record<string, unknown>> {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, obra_id, status, fck_especificado FROM concretagens WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      concrtagemId,
    );
    if (!rows[0]) throw new NotFoundException('Concretagem não encontrada');
    return rows[0];
  }

  private async gerarNumeroCp(
    tenantId: number,
    concrtagemId: number,
    caminhaoId: number,
  ): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM corpos_de_prova WHERE tenant_id = $1 AND concretagem_id = $2 AND caminhao_id = $3`,
      tenantId,
      concrtagemId,
      caminhaoId,
    );
    const seq = (Number(rows[0]?.total ?? 0) + 1).toString().padStart(3, '0');
    return `CP-${concrtagemId}-${caminhaoId}-${seq}`;
  }

  private async abrirNcAutomatica(
    tenantId: number,
    obraId: number,
    caminhaoId: number,
    userId: number,
    tipo: string,
    descricao: string,
  ): Promise<void> {
    // Número usa o SERIAL id para evitar race condition
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO nao_conformidades
           (tenant_id, obra_id, numero, categoria, criticidade, titulo, descricao,
            status, caminhao_id, aberta_por, updated_at)
         VALUES ($1,$2,'TEMP','CONCRETAGEM'::"NcCategoria",'ALTA'::"NcCriticidade",$3,$4,
                 'ABERTA'::"NcStatus",$5,$6,NOW())
         RETURNING id`,
        tenantId,
        obraId,
        `NC Automática — ${tipo}`,
        descricao,
        caminhaoId,
        userId,
      );
      const ncId = rows[0].id;
      await this.prisma.$executeRawUnsafe(
        `UPDATE nao_conformidades SET numero = $1 WHERE id = $2`,
        `NC-CON-${obraId}-${ncId.toString().padStart(4, '0')}`,
        ncId,
      );
    } catch {
      await this.prisma
        .$executeRawUnsafe(
          `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
           VALUES ($1, $2, 'NC_AUTOMATICA', 'corpo_de_prova', $3, NULL::jsonb, $4::jsonb)`,
          tenantId,
          userId,
          caminhaoId,
          JSON.stringify({ tipo, descricao, obraId }),
        )
        .catch((e: unknown) => this.logger.error(`NC fallback audit falhou: ${e}`));
    }
  }

  private auditLog(
    tenantId: number,
    userId: number,
    acao: string,
    entidadeId: number,
    antes: unknown,
    depois: unknown,
  ): Promise<unknown> {
    return this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
       VALUES ($1, $2, $3, 'corpo_de_prova', $4, $5::jsonb, $6::jsonb)`,
      tenantId,
      userId,
      acao,
      entidadeId,
      JSON.stringify(antes),
      JSON.stringify(depois),
    );
  }
}
