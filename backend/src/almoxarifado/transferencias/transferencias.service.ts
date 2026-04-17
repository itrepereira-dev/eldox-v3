// backend/src/almoxarifado/transferencias/transferencias.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmTransferencia, AlmTransferenciaItem } from '../types/alm.types';
import { ConfigTransferenciaService } from '../config-transferencia/config-transferencia.service';
import type { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import type { ExecutarTransferenciaDto } from './dto/executar-transferencia.dto';
import type { CancelarTransferenciaDto } from './dto/cancelar-transferencia.dto';

@Injectable()
export class TransferenciasService {
  private readonly logger = new Logger(TransferenciasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigTransferenciaService,
  ) {}

  async listar(
    tenantId: number,
    filters: {
      status?: string;
      local_origem_id?: number;
      local_destino_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<{ data: AlmTransferencia[]; total: number; page: number; perPage: number }> {
    const page    = filters.page    ?? 1;
    const perPage = Math.min(filters.per_page ?? 20, 100);
    const offset  = (page - 1) * perPage;

    const conditions: string[] = [`t.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.status) {
      conditions.push(`t.status = $${i++}`);
      params.push(filters.status);
    }
    if (filters.local_origem_id) {
      conditions.push(`t.local_origem_id = $${i++}`);
      params.push(filters.local_origem_id);
    }
    if (filters.local_destino_id) {
      conditions.push(`t.local_destino_id = $${i++}`);
      params.push(filters.local_destino_id);
    }

    const whereClause = conditions.join(' AND ');
    const limitIdx = i++;
    const offsetIdx = i++;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<AlmTransferencia[]>(
        `SELECT t.*,
                lo.nome AS local_origem_nome,
                ld.nome AS local_destino_nome
         FROM alm_transferencias t
         JOIN alm_locais lo ON lo.id = t.local_origem_id
         JOIN alm_locais ld ON ld.id = t.local_destino_id
         WHERE ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        ...params, perPage, offset,
      ),
      this.prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM alm_transferencias t WHERE ${whereClause}`,
        ...params,
      ),
    ]);

    return { data: rows, total: countRows[0].count, page, perPage };
  }

  async buscarPorId(tenantId: number, id: number): Promise<AlmTransferencia> {
    const rows = await this.prisma.$queryRawUnsafe<AlmTransferencia[]>(
      `SELECT t.*,
              lo.nome AS local_origem_nome,
              ld.nome AS local_destino_nome
       FROM alm_transferencias t
       JOIN alm_locais lo ON lo.id = t.local_origem_id
       JOIN alm_locais ld ON ld.id = t.local_destino_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException('Transferência não encontrada');

    const itens = await this.prisma.$queryRawUnsafe<AlmTransferenciaItem[]>(
      `SELECT ti.*, m.nome AS catalogo_nome
       FROM alm_transferencia_itens ti
       JOIN fvm_catalogo_materiais m ON m.id = ti.catalogo_id
       WHERE ti.transferencia_id = $1
       ORDER BY ti.id`,
      id,
    );

    return { ...rows[0], itens };
  }

  async criar(
    tenantId: number,
    usuarioId: number,
    dto: CreateTransferenciaDto,
  ): Promise<AlmTransferencia> {
    if (dto.local_origem_id === dto.local_destino_id) {
      throw new BadRequestException('Origem e destino não podem ser o mesmo local');
    }

    const locais = await this.prisma.$queryRawUnsafe<{ id: number; ativo: boolean }[]>(
      `SELECT id, ativo FROM alm_locais
       WHERE tenant_id = $1 AND id = ANY(ARRAY[$2, $3]::int[])`,
      tenantId, dto.local_origem_id, dto.local_destino_id,
    );

    if (locais.length < 2) throw new NotFoundException('Um ou ambos os locais não foram encontrados');

    const inativo = locais.find((l) => !l.ativo);
    if (inativo) throw new BadRequestException('Um ou ambos os locais estão inativos');

    const config = await this.configService.getOrDefault(tenantId);

    // Calculate valor_total from catalog reference prices
    let valorTotal: number | null = null;
    if (dto.itens.length > 0) {
      const catalogoIds = dto.itens.map((item) => item.catalogo_id);
      const precos = await this.prisma.$queryRawUnsafe<{ catalogo_id: number; preco_unitario: number }[]>(
        `SELECT id AS catalogo_id, preco_referencia AS preco_unitario
         FROM fvm_catalogo_materiais
         WHERE id = ANY($1::int[]) AND preco_referencia IS NOT NULL`,
        catalogoIds,
      );

      const precoMap = new Map(precos.map((p) => [p.catalogo_id, Number(p.preco_unitario)]));
      let total = 0;
      let allPriced = true;

      for (const item of dto.itens) {
        const preco = precoMap.get(item.catalogo_id);
        if (preco !== undefined) {
          total += preco * item.quantidade;
        } else {
          allPriced = false;
        }
      }

      if (allPriced) valorTotal = total;
    }

    // Determine initial status based on value threshold
    const status =
      config.valor_limite_direto > 0 &&
      valorTotal !== null &&
      valorTotal <= config.valor_limite_direto
        ? 'aprovada'
        : 'aguardando_aprovacao';

    return this.prisma.$transaction(async (tx) => {
      const transRows = await tx.$queryRawUnsafe<AlmTransferencia[]>(
        `INSERT INTO alm_transferencias
           (tenant_id, local_origem_id, local_destino_id, status, valor_total,
            solicitante_id, observacao, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        tenantId, dto.local_origem_id, dto.local_destino_id,
        status, valorTotal, usuarioId, dto.observacao ?? null,
      );

      const transferencia = transRows[0];

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_transferencia_itens (transferencia_id, catalogo_id, quantidade, unidade, qtd_executada)
           VALUES ($1, $2, $3, $4, 0)`,
          transferencia.id, item.catalogo_id, item.quantidade, item.unidade,
        );
      }

      this.logger.log(JSON.stringify({
        action: 'alm.transferencia.criar',
        tenantId,
        transferenciaId: transferencia.id,
        status,
      }));

      return this.buscarPorId(tenantId, transferencia.id);
    });
  }

  async aprovar(
    tenantId: number,
    aprovadorId: number,
    id: number,
    userRoles: string[],
  ): Promise<AlmTransferencia> {
    const transferencia = await this.buscarPorId(tenantId, id);

    if (transferencia.status !== 'aguardando_aprovacao') {
      throw new BadRequestException(
        `Transferência não pode ser aprovada no status atual: ${transferencia.status}`,
      );
    }

    const config = await this.configService.getOrDefault(tenantId);
    const rolesPermitidas = config.roles_aprovadores.length > 0
      ? config.roles_aprovadores
      : ['ADMIN_TENANT'];

    const temPermissao = userRoles.some((r) => rolesPermitidas.includes(r));
    if (!temPermissao) {
      throw new ForbiddenException('Usuário não possui permissão para aprovar transferências');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_transferencias
       SET status = 'aprovada', aprovador_id = $1, aprovado_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      aprovadorId, id, tenantId,
    );

    this.logger.log(JSON.stringify({ action: 'alm.transferencia.aprovar', tenantId, id, aprovadorId }));
    return this.buscarPorId(tenantId, id);
  }

  /**
   * Atomic transfer execution: SAIDA at origin + ENTRADA at destination.
   * Uses SELECT FOR UPDATE to prevent race conditions on stock balances.
   * Note: alm_estoque_saldo balance column is `quantidade` (not `saldo`).
   */
  async executar(
    tenantId: number,
    usuarioId: number,
    id: number,
    dto: ExecutarTransferenciaDto,
  ): Promise<AlmTransferencia> {
    const transferencia = await this.buscarPorId(tenantId, id);

    if (transferencia.status !== 'aprovada') {
      throw new BadRequestException(
        `Transferência não pode ser executada no status atual: ${transferencia.status}`,
      );
    }

    // Default to full execution of all items if no explicit list provided
    const itensParaExecutar = dto.itens ?? (transferencia.itens ?? []).map((i) => ({
      item_id: i.id,
      qtd_executada: Number(i.quantidade),
    }));

    if (itensParaExecutar.length === 0) {
      throw new BadRequestException('Nenhum item para executar');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock the transferencia row to prevent concurrent duplicate execution
      const locked = await tx.$queryRawUnsafe<{ status: string }[]>(
        `SELECT status FROM alm_transferencias WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        id, tenantId,
      );
      if (!locked.length || locked[0].status !== 'aprovada') {
        throw new BadRequestException('Transferência não está mais disponível para execução');
      }

      for (const execItem of itensParaExecutar) {
        const transItem = (transferencia.itens ?? []).find((i) => i.id === execItem.item_id);
        if (!transItem) {
          throw new BadRequestException(
            `Item ${execItem.item_id} não pertence a esta transferência`,
          );
        }
        if (execItem.qtd_executada > Number(transItem.quantidade)) {
          throw new BadRequestException(
            `Quantidade executada (${execItem.qtd_executada}) excede a solicitada (${transItem.quantidade}) para o item ${execItem.item_id}`,
          );
        }

        // Lock saldo row at origin (SELECT FOR UPDATE — prevents concurrent deductions)
        const saldoRows = await tx.$queryRawUnsafe<{ id: number; quantidade: number }[]>(
          `SELECT id, quantidade::float
           FROM alm_estoque_saldo
           WHERE tenant_id = $1 AND local_id = $2 AND catalogo_id = $3
           FOR UPDATE`,
          tenantId, transferencia.local_origem_id, transItem.catalogo_id,
        );

        const saldoAtual = saldoRows.length ? Number(saldoRows[0].quantidade) : 0;

        if (saldoAtual < execItem.qtd_executada) {
          throw new BadRequestException(
            `Saldo insuficiente para item ${transItem.catalogo_id} no local de origem. ` +
            `Disponível: ${saldoAtual}, solicitado: ${execItem.qtd_executada}`,
          );
        }

        // 1. Insert SAIDA movement at origin
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_movimentos
             (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
              saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, criado_por, created_at)
           VALUES ($1, $2, $3, 'saida', $4, $5, $6, $7, 'transferencia', $8, $9, NOW())`,
          tenantId, transItem.catalogo_id, transferencia.local_origem_id,
          execItem.qtd_executada, transItem.unidade,
          saldoAtual, saldoAtual - execItem.qtd_executada,
          id, usuarioId,
        );

        // 2. Decrement saldo at origin (quantidade column)
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, quantidade, unidade, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id)
           DO UPDATE SET quantidade = alm_estoque_saldo.quantidade + EXCLUDED.quantidade, updated_at = NOW()`,
          tenantId, transferencia.local_origem_id, transItem.catalogo_id,
          -execItem.qtd_executada, transItem.unidade,
        );

        // 3. Get current saldo at destination for saldo_anterior tracking
        const saldoDestinoRows = await tx.$queryRawUnsafe<{ quantidade: number }[]>(
          `SELECT COALESCE(quantidade, 0)::float AS quantidade
           FROM alm_estoque_saldo
           WHERE tenant_id = $1 AND local_id = $2 AND catalogo_id = $3
           FOR UPDATE`,
          tenantId, transferencia.local_destino_id, transItem.catalogo_id,
        );
        const saldoDestinoAtual = saldoDestinoRows.length ? Number(saldoDestinoRows[0].quantidade) : 0;

        // 4. Insert ENTRADA movement at destination
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_movimentos
             (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
              saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, criado_por, created_at)
           VALUES ($1, $2, $3, 'entrada', $4, $5, $6, $7, 'transferencia', $8, $9, NOW())`,
          tenantId, transItem.catalogo_id, transferencia.local_destino_id,
          execItem.qtd_executada, transItem.unidade,
          saldoDestinoAtual, saldoDestinoAtual + execItem.qtd_executada,
          id, usuarioId,
        );

        // 5. Increment saldo at destination (quantidade column)
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, quantidade, unidade, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id)
           DO UPDATE SET quantidade = alm_estoque_saldo.quantidade + EXCLUDED.quantidade, updated_at = NOW()`,
          tenantId, transferencia.local_destino_id, transItem.catalogo_id,
          execItem.qtd_executada, transItem.unidade,
        );

        // 6. Update qtd_executada on the transfer item
        await tx.$executeRawUnsafe(
          `UPDATE alm_transferencia_itens
           SET qtd_executada = qtd_executada + $1
           WHERE id = $2`,
          execItem.qtd_executada, execItem.item_id,
        );
      }

      // Check if any item is partially executed (qtd_executada < quantidade)
      const itemsAfter = await tx.$queryRawUnsafe<{ quantidade: number; qtd_executada: number }[]>(
        `SELECT quantidade::float, qtd_executada::float
         FROM alm_transferencia_itens WHERE transferencia_id = $1`,
        id,
      );
      const executadaParcial = itemsAfter.some(
        (i) => Number(i.qtd_executada) < Number(i.quantidade),
      );

      await tx.$executeRawUnsafe(
        `UPDATE alm_transferencias
         SET status = 'executada', executada_parcial = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        executadaParcial, id, tenantId,
      );

      this.logger.log(JSON.stringify({
        action: 'alm.transferencia.executar',
        tenantId, id, executadaParcial,
      }));

      return this.buscarPorId(tenantId, id);
    });
  }

  async cancelar(
    tenantId: number,
    id: number,
    dto: CancelarTransferenciaDto,
  ): Promise<AlmTransferencia> {
    const transferencia = await this.buscarPorId(tenantId, id);

    if (['executada', 'cancelada'].includes(transferencia.status)) {
      throw new BadRequestException(
        `Transferência não pode ser cancelada no status: ${transferencia.status}`,
      );
    }

    const novaObservacao = dto.motivo
      ? [transferencia.observacao, `Cancelamento: ${dto.motivo}`].filter(Boolean).join(' | ')
      : transferencia.observacao;

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_transferencias
       SET status = 'cancelada', observacao = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      novaObservacao, id, tenantId,
    );

    this.logger.log(JSON.stringify({ action: 'alm.transferencia.cancelar', tenantId, id }));
    return this.buscarPorId(tenantId, id);
  }
}
