// backend/src/almoxarifado/solicitacao/solicitacao.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmSolicitacao, AlmSolicitacaoItem, AlmAprovacao } from '../types/alm.types';
import type { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import type { AprovarSolicitacaoDto } from './dto/aprovar-solicitacao.dto';

type SolicitacaoDetalhe = AlmSolicitacao & {
  itens: AlmSolicitacaoItem[];
  aprovacoes: AlmAprovacao[];
};

@Injectable()
export class SolicitacaoService {
  private readonly logger = new Logger(SolicitacaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Listar ────────────────────────────────────────────────────────────────

  async listar(
    tenantId: number,
    filters: { localDestinoId?: number; status?: string; limit?: number; offset?: number } = {},
  ): Promise<AlmSolicitacao[]> {
    const conditions: string[] = [`s.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localDestinoId) {
      conditions.push(`s.local_destino_id = $${i++}`);
      params.push(filters.localDestinoId);
    }
    if (filters.status) {
      conditions.push(`s.status = $${i++}`);
      params.push(filters.status);
    }

    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;
    const limitIdx  = i++;
    const offsetIdx = i++;

    return this.prisma.$queryRawUnsafe<AlmSolicitacao[]>(
      `SELECT s.*,
              u.nome                 AS solicitante_nome,
              l.nome                 AS local_destino_nome,
              COUNT(i.id)::int       AS total_itens
       FROM alm_solicitacoes s
       LEFT JOIN "Usuario" u ON u.id = s.solicitante_id
       LEFT JOIN alm_locais l ON l.id = s.local_destino_id
       LEFT JOIN alm_solicitacao_itens i ON i.solicitacao_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY s.id, u.nome, l.nome
       ORDER BY
         CASE WHEN s.urgente THEN 0 ELSE 1 END,
         s.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      ...params, limit, offset,
    );
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  async buscarOuFalhar(tenantId: number, id: number): Promise<SolicitacaoDetalhe> {
    const rows = await this.prisma.$queryRawUnsafe<AlmSolicitacao[]>(
      `SELECT s.*, u.nome AS solicitante_nome
       FROM alm_solicitacoes s
       LEFT JOIN "Usuario" u ON u.id = s.solicitante_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Solicitação ${id} não encontrada`);

    const [itens, aprovacoes] = await Promise.all([
      this.prisma.$queryRawUnsafe<AlmSolicitacaoItem[]>(
        `SELECT si.*, m.nome AS catalogo_nome, m.codigo AS catalogo_codigo
         FROM alm_solicitacao_itens si
         JOIN fvm_catalogo_materiais m ON m.id = si.catalogo_id
         WHERE si.solicitacao_id = $1
         ORDER BY si.id`,
        id,
      ),
      this.prisma.$queryRawUnsafe<AlmAprovacao[]>(
        `SELECT a.*, u.nome AS aprovador_nome
         FROM alm_aprovacoes a
         LEFT JOIN "Usuario" u ON u.id = a.aprovador_id
         WHERE a.solicitacao_id = $1
         ORDER BY a.created_at`,
        id,
      ),
    ]);

    return { ...rows[0], itens, aprovacoes };
  }

  // ── Criar ────────────────────────────────────────────────────────────────

  async criar(
    tenantId: number,
    usuarioId: number,
    dto: CreateSolicitacaoDto,
  ): Promise<AlmSolicitacao> {
    if (!dto.itens?.length) {
      throw new BadRequestException('A solicitação deve ter pelo menos um item');
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<AlmSolicitacao[]>(
        `INSERT INTO alm_solicitacoes
           (tenant_id, local_destino_id, descricao, urgente, data_necessidade, servico_ref, solicitante_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        tenantId,
        dto.local_destino_id,
        dto.descricao,
        dto.urgente ?? false,
        dto.data_necessidade ? new Date(dto.data_necessidade) : null,
        dto.servico_ref ?? null,
        usuarioId,
      );
      const sol = rows[0];

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_solicitacao_itens
             (solicitacao_id, catalogo_id, quantidade, unidade, observacao)
           VALUES ($1, $2, $3, $4, $5)`,
          sol.id, item.catalogo_id, item.quantidade, item.unidade, item.observacao ?? null,
        );
      }

      this.logger.log(JSON.stringify({
        action: 'alm.solicitacao.criar',
        tenantId, localDestinoId: dto.local_destino_id, solicitacaoId: sol.id,
      }));

      return sol;
    });
  }

  // ── Submeter para aprovação ───────────────────────────────────────────────

  async submeter(tenantId: number, id: number): Promise<void> {
    const sol = await this._checkExists(tenantId, id);
    if (sol.status !== 'rascunho') {
      throw new BadRequestException(`Solicitação está em status "${sol.status}" — não pode ser submetida`);
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_solicitacoes
       SET status = 'aguardando_aprovacao', etapa_atual = 1, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }

  // ── Aprovar / Reprovar ────────────────────────────────────────────────────

  async aprovar(
    tenantId: number,
    id: number,
    usuarioId: number,
    dto: AprovarSolicitacaoDto,
  ): Promise<void> {
    const sol = await this._checkExists(tenantId, id);

    if (sol.status !== 'aguardando_aprovacao' && sol.status !== 'em_aprovacao') {
      throw new BadRequestException(`Solicitação está em status "${sol.status}" — não pode ser aprovada/reprovada`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Registra a ação
      await tx.$executeRawUnsafe(
        `INSERT INTO alm_aprovacoes
           (tenant_id, solicitacao_id, etapa, acao, aprovador_id, observacao)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        tenantId, id, sol.etapa_atual, dto.acao, usuarioId, dto.observacao ?? null,
      );

      if (dto.acao === 'reprovado') {
        await tx.$executeRawUnsafe(
          `UPDATE alm_solicitacoes
           SET status = 'reprovada', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          id, tenantId,
        );
        return;
      }

      // Verifica se há próxima etapa configurada
      const proxEtapa = await tx.$queryRawUnsafe<{ etapa: number }[]>(
        `SELECT etapa FROM alm_fluxo_aprovacao_config
         WHERE tenant_id = $1 AND etapa > $2 AND ativo = true
         ORDER BY etapa ASC LIMIT 1`,
        tenantId, sol.etapa_atual,
      );

      if (proxEtapa.length) {
        await tx.$executeRawUnsafe(
          `UPDATE alm_solicitacoes
           SET status = 'em_aprovacao', etapa_atual = $3, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          id, tenantId, proxEtapa[0].etapa,
        );
      } else {
        // Última etapa: aprova definitivamente
        await tx.$executeRawUnsafe(
          `UPDATE alm_solicitacoes
           SET status = 'aprovada', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          id, tenantId,
        );
      }
    });

    this.logger.log(JSON.stringify({
      action: 'alm.solicitacao.aprovar',
      tenantId, id, acao: dto.acao, usuarioId,
    }));
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  async cancelar(tenantId: number, id: number, usuarioId: number): Promise<void> {
    const sol = await this._checkExists(tenantId, id);

    if (sol.status === 'aprovada' || sol.status === 'cancelada') {
      throw new BadRequestException(`Solicitação com status "${sol.status}" não pode ser cancelada`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE alm_solicitacoes
         SET status = 'cancelada', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        id, tenantId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO alm_aprovacoes
           (tenant_id, solicitacao_id, etapa, acao, aprovador_id)
         VALUES ($1, $2, $3, 'cancelado', $4)`,
        tenantId, id, sol.etapa_atual, usuarioId,
      );
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async _checkExists(
    tenantId: number,
    id: number,
  ): Promise<{ status: string; etapa_atual: number }> {
    const rows = await this.prisma.$queryRawUnsafe<{ status: string; etapa_atual: number }[]>(
      `SELECT status, etapa_atual FROM alm_solicitacoes WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Solicitação ${id} não encontrada`);
    return rows[0];
  }
}
