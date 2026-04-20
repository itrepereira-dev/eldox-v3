// backend/src/almoxarifado/conversao/conversao.controller.ts
import {
  Controller, Get, Post,
  Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ConversaoService } from './conversao.service';
import { UpsertConversaoDto } from './dto/upsert-conversao.dto';
import { ConverterDto } from './dto/converter.dto';
import { CalcularCompraDto } from './dto/calcular-compra.dto';

@Controller('api/v1/almoxarifado/conversoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversaoController {
  constructor(private readonly service: ConversaoService) {}

  /**
   * Lista todas conversões disponíveis para o tenant (inclui conversões de sistema com tenant_id=0).
   */
  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(@TenantId() tenantId: number) {
    return this.service.listConversoes(tenantId);
  }

  /**
   * Cria ou atualiza uma conversão (upsert por tenant+catalogo+origem+destino).
   * Admin only — conversões de sistema exigem seed direto no banco.
   */
  @Post()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  upsert(
    @TenantId() tenantId: number,
    @Body() dto: UpsertConversaoDto,
  ) {
    return this.service.upsertConversao(tenantId, dto);
  }

  /**
   * Preview de conversão — converte uma quantidade sem persistir.
   * Usado pelo frontend em tempo real (ex: tela de recebimento NF).
   */
  @Post('converter')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  @HttpCode(HttpStatus.OK)
  converter(
    @TenantId() tenantId: number,
    @Body() dto: ConverterDto,
  ) {
    return this.service.converter(
      tenantId,
      dto.catalogoId ?? null,
      dto.quantidade,
      dto.unidadeOrigem,
      dto.unidadeDestino,
    );
  }

  /**
   * Cálculo reverso — "preciso de X na UM de consumo, quantas unidades na UM de compra?"
   * Aplica arredondamento para cima + quebra técnica opcional.
   */
  @Post('calcular-compra')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  calcularCompra(
    @TenantId() tenantId: number,
    @Body() dto: CalcularCompraDto,
  ) {
    return this.service.calcularCompra(
      tenantId,
      dto.catalogoId ?? null,
      dto.necessidade,
      dto.unidadeNecessidade,
      dto.unidadeCompra,
      dto.quebraPct ?? 0,
    );
  }
}
