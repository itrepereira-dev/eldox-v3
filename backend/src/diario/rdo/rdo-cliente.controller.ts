// backend/src/diario/rdo/rdo-cliente.controller.ts
// Rota PÚBLICA (sem JWT) para o cliente visualizar o RDO via token
import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RdoPdfService } from './rdo-pdf.service';

// Endpoint público → rate-limit agressivo por IP para frear brute-force em tokens.
const PORTAL_PUBLICO_THROTTLE = {
  short: { limit: 10, ttl: 60_000 },
  long: { limit: 100, ttl: 3_600_000 },
};

@Controller('relatorio-cliente')
@Throttle(PORTAL_PUBLICO_THROTTLE)
export class RdoClienteController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rdoPdfService: RdoPdfService,
  ) {}

  /**
   * GET /relatorio-cliente/:token
   * Retorna dados do RDO para exibição pública (sem dados sensíveis do tenant)
   */
  @Get(':token')
  async getRelatorio(@Param('token') token: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.id, r.data::text AS data, r.status, r.resumo_ia, r.numero,
              o.nome AS obra_nome, o.endereco AS obra_endereco,
              r.token_cliente_expires_at
       FROM rdos r
       LEFT JOIN "Obra" o ON o.id = r.obra_id
       WHERE r.token_cliente = $1
         AND (r.token_cliente_expires_at IS NULL OR r.token_cliente_expires_at > NOW())
         AND r.deleted_at IS NULL`,
      token,
    );

    if (!rows.length) {
      throw new NotFoundException('Link inválido ou expirado');
    }

    const rdo = rows[0];

    // Carrega as seções públicas (sem dados internos como tenant_id, usuario_id, etc.)
    const [clima, atividades, ocorrencias, fotos] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT periodo, condicao, praticavel, chuva_mm FROM rdo_clima
         WHERE rdo_id = $1 ORDER BY periodo`,
        rdo.id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT descricao, hora_inicio, hora_fim, progresso_pct, ordem
         FROM rdo_atividades WHERE rdo_id = $1 ORDER BY ordem`,
        rdo.id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT descricao, tags
         FROM rdo_ocorrencias WHERE rdo_id = $1`,
        rdo.id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT url, thumbnail_url, legenda, nome_arquivo
         FROM rdo_fotos WHERE rdo_id = $1 ORDER BY created_at ASC`,
        rdo.id,
      ),
    ]);

    return {
      status: 'success',
      data: {
        rdo_numero: rdo.numero ?? rdo.id,
        data: rdo.data,
        status: rdo.status,
        resumo_ia: rdo.resumo_ia,
        obra_nome: rdo.obra_nome,
        obra_endereco: rdo.obra_endereco,
        validade_link: rdo.token_cliente_expires_at,
        clima,
        atividades,
        ocorrencias,
        fotos,
      },
    };
  }

  /**
   * GET /relatorio-cliente/:token/pdf
   * Baixa o PDF do RDO via token público
   */
  @Get(':token/pdf')
  async downloadPdf(@Param('token') token: string, @Res() res: Response) {
    const { buffer, nomeArquivo } = await this.rdoPdfService.gerarCompartilhavel(token);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
