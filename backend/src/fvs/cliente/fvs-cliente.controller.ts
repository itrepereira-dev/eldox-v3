// backend/src/fvs/cliente/fvs-cliente.controller.ts
// Portal PÚBLICO para clientes visualizarem relatório de inspeção via token
// Sem JWT — acesso por token de compartilhamento
import {
  Controller, Get, Param, Res, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { FvsPdfService } from '../pdf/fvs-pdf.service';

// Endpoint público → rate-limit agressivo por IP para frear brute-force em tokens.
const PORTAL_PUBLICO_THROTTLE = {
  short: { limit: 10, ttl: 60_000 },
  long: { limit: 100, ttl: 3_600_000 },
};

@Controller('fvs-cliente')
@Throttle(PORTAL_PUBLICO_THROTTLE)
export class FvsClienteController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fvsPdf: FvsPdfService,
  ) {}

  @Get(':token')
  async getRelatorio(@Param('token') token: string) {
    // 1. Buscar ficha pelo token
    const fichas = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT f.*, o.nome AS obra_nome, o.endereco AS obra_endereco
       FROM fvs_fichas f
       JOIN "Obra" o ON o.id = f.obra_id
       WHERE f.token_cliente = $1
         AND f.deleted_at IS NULL`,
      token,
    );
    if (!fichas.length) throw new NotFoundException('Relatório não encontrado');

    const ficha = fichas[0];

    // 2. Verificar expiração
    if (ficha.token_cliente_expires_at && new Date(ficha.token_cliente_expires_at) < new Date()) {
      throw new ForbiddenException('Link expirado');
    }

    // 3. Buscar dados completos (somente status aprovada/concluida)
    if (!['concluida', 'aprovada'].includes(ficha.status)) {
      throw new ForbiddenException('Relatório ainda não disponível para consulta');
    }

    const [servicos, ncs, evidencias] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
           cs.nome AS servico_nome,
           COUNT(r.id)::int AS total_registros,
           COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::int AS conformes,
           COUNT(r.id) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho'))::int AS nao_conformes,
           ROUND(COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::numeric
                 / NULLIF(COUNT(r.id), 0) * 100, 1) AS taxa_conformidade
         FROM fvs_registros r
         JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
         WHERE r.ficha_id = $1 AND r.tenant_id = $2
         GROUP BY cs.nome
         ORDER BY taxa_conformidade ASC NULLS LAST`,
        ficha.id, ficha.tenant_id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
           nc.id, nc.criticidade, nc.status, nc.causa_raiz AS descricao,
           nc.acao_corretiva, nc.prazo_resolucao AS prazo, nc.ia_sugestao_json,
           cs.nome AS servico_nome,
           ci.descricao AS item_nome,
           ol."nomeCompleto" AS local_nome
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
         LEFT JOIN fvs_catalogo_itens ci ON ci.id = r.item_id
         LEFT JOIN "ObraLocal" ol ON ol.id = r.obra_local_id
         WHERE r.ficha_id = $1 AND nc.tenant_id = $2
         ORDER BY
           CASE nc.criticidade WHEN 'critico' THEN 1 WHEN 'maior' THEN 2 ELSE 3 END,
           nc.criado_em DESC`,
        ficha.id, ficha.tenant_id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT e.id, gv.storage_key AS url, NULL AS thumbnail_url,
                NULL AS descricao, e.created_at AS criado_em,
                r.status AS registro_status,
                cs.nome AS servico_nome
         FROM fvs_evidencias e
         JOIN ged_versoes gv ON gv.id = e.ged_versao_id
         JOIN fvs_registros r ON r.id = e.registro_id
         JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
         WHERE r.ficha_id = $1 AND e.tenant_id = $2
         ORDER BY e.created_at DESC
         LIMIT 50`,
        ficha.id, ficha.tenant_id,
      ),
    ]);

    const totalRegistros = servicos.reduce((s: number, sv: any) => s + sv.total_registros, 0);
    const conformes = servicos.reduce((s: number, sv: any) => s + sv.conformes, 0);

    return {
      ficha: {
        id: ficha.id,
        titulo: ficha.nome,
        status: ficha.status,
        obra_nome: ficha.obra_nome,
        obra_endereco: ficha.obra_endereco,
        criado_em: ficha.created_at,
        concluido_em: ficha.updated_at,
      },
      resumo: {
        taxa_conformidade_geral: totalRegistros > 0 ? Math.round((conformes / totalRegistros) * 100) : null,
        total_registros: totalRegistros,
        total_ncs: ncs.length,
        ncs_criticas: ncs.filter((nc: any) => nc.criticidade === 'critico').length,
      },
      servicos,
      ncs,
      evidencias,
    };
  }

  @Get(':token/pdf')
  async getPdf(@Param('token') token: string, @Res() res: Response) {
    const { buffer, nomeArquivo } = await this.fvsPdf.gerarPdfPorToken(token);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
