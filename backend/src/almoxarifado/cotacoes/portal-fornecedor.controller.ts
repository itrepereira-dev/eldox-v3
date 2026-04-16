// backend/src/almoxarifado/cotacoes/portal-fornecedor.controller.ts
//
// Endpoints PÚBLICOS (sem autenticação JWT) para que o fornecedor possa
// visualizar e preencher a cotação através de um link com token único.
//
// Rota base: /portal/cotacao/:token

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
} from '@nestjs/common';
import { CotacoesService } from './cotacoes.service';

@Controller('portal/cotacao')
export class PortalFornecedorController {
  constructor(private readonly cotacoes: CotacoesService) {}

  /**
   * GET /portal/cotacao/:token
   *
   * O fornecedor acessa este link para ver a solicitação.
   * Retorna os itens que precisam de cotação, sem dados sensíveis de outros fornecedores.
   */
  @Get(':token')
  async visualizar(@Param('token') token: string) {
    const data = await this.cotacoes.buscarPorToken(token);
    return {
      status: 'success',
      data: {
        solicitacao_numero: data.cotacao.solicitacao_numero,
        obra_nome:          data.cotacao.obra_nome,
        prazo_validade:     data.cotacao.token_expires_at,
        observacao:         (data.cotacao as any).observacao,
        ja_respondida:      data.cotacao.status === 'respondida',
        itens: data.itens.map((i) => ({
          id:            i.id,
          catalogo_nome: i.catalogo_nome,
          quantidade:    i.quantidade,
          unidade:       i.unidade,
          // Inclui preço anterior se já foi respondida (para facilitar atualização)
          preco_unitario: data.cotacao.status === 'respondida' ? i.preco_unitario : null,
          marca:          data.cotacao.status === 'respondida' ? i.marca : null,
          disponivel:     data.cotacao.status === 'respondida' ? i.disponivel : true,
          prazo_dias:     data.cotacao.status === 'respondida' ? i.prazo_dias : null,
          observacao:     data.cotacao.status === 'respondida' ? i.observacao : null,
        })),
      },
    };
  }

  /**
   * POST /portal/cotacao/:token
   *
   * O fornecedor submete os preços.
   * Pode ser chamado múltiplas vezes enquanto o link não expirar.
   *
   * Body:
   * {
   *   prazo_entrega: "2026-05-10",       // data ISO
   *   condicao_pgto: "30/60 dias",
   *   frete: 150.00,
   *   itens: [
   *     {
   *       cotacao_item_id: 42,
   *       preco_unitario: 28.50,
   *       marca: "Suvinil",
   *       disponivel: true,
   *       prazo_dias: 3,
   *       observacao: "Disponível em estoque"
   *     }
   *   ]
   * }
   */
  @Post(':token')
  @HttpCode(200)
  async responder(
    @Param('token') token: string,
    @Body() body: {
      prazo_entrega?: string;
      condicao_pgto?: string;
      frete?: number;
      itens: {
        cotacao_item_id: number;
        preco_unitario: number | null;
        marca?: string;
        disponivel?: boolean;
        prazo_dias?: number;
        observacao?: string;
      }[];
    },
  ) {
    await this.cotacoes.responderCotacao(token, body);
    return {
      status: 'success',
      message: 'Cotação enviada com sucesso! O comprador irá analisar sua proposta.',
    };
  }
}
