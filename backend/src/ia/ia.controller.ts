// backend/src/ia/ia.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/tenant.decorator';
import { IaService } from './ia.service';
import { GerarCatalogoDto } from './dto/gerar-catalogo.dto';
import { AssistenteFvsDto } from './dto/assistente.dto';

@Controller('api/v1/fvs/ia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IaController {
  constructor(private readonly ia: IaService) {}

  @Post('gerar-catalogo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  gerarCatalogo(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: GerarCatalogoDto,
  ) {
    return this.ia.gerarCatalogo(tenantId, user.id, dto);
  }

  @Post('gerar-modelo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  gerarModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: GerarCatalogoDto,
  ) {
    return this.ia.gerarModeloFvs(tenantId, user.id, dto);
  }

  @Post('assistente')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  assistente(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: AssistenteFvsDto,
  ) {
    return this.ia.assistenteFvs(tenantId, user.id, dto);
  }
}
