// backend/src/almoxarifado/compras/compras.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import type { AlmOrdemCompra, AlmOcItem } from '../types/alm.types';
import type { CreateOcDto } from './dto/create-oc.dto';
import type { ReceberOcDto } from './dto/receber-oc.dto';

type OcDetalhe = AlmOrdemCompra & { itens: AlmOcItem[] };

@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  // ── Listar ────────────────────────────────────────────────────────────────

  async listar(
    tenantId: number,
    filters: { localDestinoId?: number; status?: string; limit?: number; offset?: number } = {},
  ): Promise<AlmOrdemCompra[]> {
    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;
    const conditions: string[] = [`oc.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localDestinoId) {
      conditions.push(`oc.local_destino_id = $${i++}`);
      params.push(filters.localDestinoId);
    }
    if (filters.status) {
      conditions.push(`oc.status = $${i++}`);
      params.push(filters.status);
    }

    const limitIdx = i++;
    const offsetIdx = i++;

    return this.prisma.$queryRawUnsafe<AlmOrdemCompra[]>(
      `SELECT oc.*,
              f.nome_fantasia         AS fornecedor_nome,
              u.nome                  AS criado_por_nome,
              l.nome                  AS local_destino_nome,
              COUNT(it.id)::int       AS total_itens
       FROM alm_ordens_compra oc
       JOIN fvm_fornecedores f ON f.id = oc.fornecedor_id
       LEFT JOIN "Usuario" u ON u.id = oc.criado_por
       LEFT JOIN alm_locais l ON l.id = oc.local_destino_id
       LEFT JOIN alm_oc_itens it ON it.oc_id = oc.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY oc.id, f.nome_fantasia, u.nome, l.nome
       ORDER BY oc.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      ...params, limit, offset,
    );
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  async buscarOuFalhar(tenantId: number, id: number): Promise<OcDetalhe> {
    const rows = await this.prisma.$queryRawUnsafe<AlmOrdemCompra[]>(
      `SELECT oc.*,
              f.nome_fantasia AS fornecedor_nome,
              u.nome          AS criado_por_nome
       FROM alm_ordens_compra oc
       JOIN fvm_fornecedores f ON f.id = oc.fornecedor_id
       LEFT JOIN "Usuario" u ON u.id = oc.criado_por
       WHERE oc.id = $1 AND oc.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ordem de Compra ${id} não encontrada`);

    const itens = await this.prisma.$queryRawUnsafe<AlmOcItem[]>(
      `SELECT i.*, m.nome AS catalogo_nome, m.codigo AS catalogo_codigo
       FROM alm_oc_itens i
       JOIN fvm_catalogo_materiais m ON m.id = i.catalogo_id
       WHERE i.oc_id = $1
       ORDER BY i.id`,
      id,
    );

    return { ...rows[0], itens };
  }

  // ── Criar ────────────────────────────────────────────────────────────────

  async criar(
    tenantId: number,
    usuarioId: number,
    dto: CreateOcDto,
  ): Promise<AlmOrdemCompra> {
    if (!dto.itens?.length) {
      throw new BadRequestException('A OC deve ter pelo menos um item');
    }

    return this.prisma.$transaction(async (tx) => {
      const valorTotal = dto.itens.reduce(
        (acc, item) => acc + (item.preco_unitario ?? 0) * item.quantidade,
        0,
      );

      const rows = await tx.$queryRawUnsafe<AlmOrdemCompra[]>(
        `INSERT INTO alm_ordens_compra
           (tenant_id, local_destino_id, solicitacao_id, fornecedor_id,
            status, valor_total, prazo_entrega, condicao_pgto,
            local_entrega, observacoes, criado_por)
         VALUES ($1, $2, $3, $4, 'rascunho', $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        tenantId, dto.local_destino_id,
        dto.solicitacao_id ?? null,
        dto.fornecedor_id,
        valorTotal || null,
        dto.prazo_entrega ? new Date(dto.prazo_entrega) : null,
        dto.condicao_pgto ?? null,
        dto.local_entrega ?? null,
        dto.observacoes ?? null,
        usuarioId,
      );
      const oc = rows[0];

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_oc_itens
             (oc_id, catalogo_id, quantidade, unidade, preco_unitario)
           VALUES ($1, $2, $3, $4, $5)`,
          oc.id, item.catalogo_id, item.quantidade, item.unidade, item.preco_unitario ?? null,
        );
      }

      this.logger.log(JSON.stringify({
        action: 'alm.oc.criar', tenantId, localDestinoId: dto.local_destino_id, ocId: oc.id,
      }));

      return oc;
    });
  }

  // ── Confirmar ─────────────────────────────────────────────────────────────

  async confirmar(tenantId: number, id: number): Promise<void> {
    await this._assertStatus(tenantId, id, ['rascunho'], 'confirmada');
  }

  // ── Emitir ────────────────────────────────────────────────────────────────

  async emitir(tenantId: number, id: number): Promise<void> {
    await this._assertStatus(tenantId, id, ['confirmada'], 'emitida');
  }

  // ── Receber itens ─────────────────────────────────────────────────────────

  async receberItens(
    tenantId: number,
    ocId: number,
    usuarioId: number,
    dto: ReceberOcDto,
  ): Promise<void> {
    const oc = await this._checkOc(tenantId, ocId);

    if (oc.status === 'cancelada' || oc.status === 'recebida') {
      throw new BadRequestException(`OC com status "${oc.status}" não permite recebimento`);
    }

    for (const recebimento of dto.itens) {
      if (recebimento.qtd_recebida <= 0) continue;

      // Busca item para pegar catalogo_id e unidade
      const itemRows = await this.prisma.$queryRawUnsafe<{
        id: number; catalogo_id: number; quantidade: number;
        qtd_recebida: number; unidade: string;
      }[]>(
        `SELECT id, catalogo_id, quantidade::float, qtd_recebida::float, unidade
         FROM alm_oc_itens WHERE id = $1 AND oc_id = $2`,
        recebimento.item_id, ocId,
      );
      if (!itemRows.length) continue;

      const item = itemRows[0];
      const maxReceber = item.quantidade - item.qtd_recebida;
      const qtd = Math.min(recebimento.qtd_recebida, maxReceber);
      if (qtd <= 0) continue;

      // Atualiza qtd_recebida no item
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_oc_itens SET qtd_recebida = qtd_recebida + $1 WHERE id = $2`,
        qtd, recebimento.item_id,
      );

      // Registra entrada no estoque
      await this.estoque.registrarMovimento(tenantId, oc.local_destino_id, usuarioId, {
        catalogo_id:    item.catalogo_id,
        tipo:           'entrada',
        quantidade:     qtd,
        unidade:        item.unidade,
        local_id:       recebimento.local_id ?? 0,
        referencia_tipo: 'oc',
        referencia_id:  ocId,
        observacao:     `Recebimento OC ${oc.numero}`,
      });
    }

    // Determina novo status da OC
    const updatedItems = await this.prisma.$queryRawUnsafe<{
      quantidade: number; qtd_recebida: number;
    }[]>(
      `SELECT quantidade::float, qtd_recebida::float FROM alm_oc_itens WHERE oc_id = $1`,
      ocId,
    );

    const totalOk = updatedItems.every((i) => i.qtd_recebida >= i.quantidade);
    const algumOk = updatedItems.some((i) => i.qtd_recebida > 0);
    const novoStatus = totalOk ? 'recebida' : algumOk ? 'parcialmente_recebida' : oc.status;

    if (novoStatus !== oc.status) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_ordens_compra SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        novoStatus, ocId, tenantId,
      );
    }
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  async cancelar(tenantId: number, id: number): Promise<void> {
    const oc = await this._checkOc(tenantId, id);
    if (oc.status === 'recebida' || oc.status === 'cancelada') {
      throw new BadRequestException(`OC com status "${oc.status}" não pode ser cancelada`);
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_ordens_compra SET status = 'cancelada', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async _checkOc(
    tenantId: number,
    id: number,
  ): Promise<{ status: string; numero: string; local_destino_id: number }> {
    const rows = await this.prisma.$queryRawUnsafe<{
      status: string; numero: string; local_destino_id: number;
    }[]>(
      `SELECT status, numero, local_destino_id FROM alm_ordens_compra WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`OC ${id} não encontrada`);
    return rows[0];
  }

  private async _assertStatus(
    tenantId: number,
    id: number,
    allowedFrom: string[],
    nextStatus: string,
  ): Promise<void> {
    const oc = await this._checkOc(tenantId, id);
    if (!allowedFrom.includes(oc.status)) {
      throw new BadRequestException(
        `OC está em "${oc.status}" — transição para "${nextStatus}" não permitida`,
      );
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_ordens_compra SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      nextStatus, id, tenantId,
    );
  }
}
