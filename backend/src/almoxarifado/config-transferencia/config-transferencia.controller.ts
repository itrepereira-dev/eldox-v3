// backend/src/almoxarifado/config-transferencia/config-transferencia.controller.ts
import {
  Controller, Get, Put,
  Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ConfigTransferenciaService } from './config-transferencia.service';
import { UpsertConfigTransferenciaDto } from './dto/upsert-config-transferencia.dto';

@Controller('api/v1/almoxarifado/config-transferencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigTransferenciaController {
  constructor(private readonly config: ConfigTransferenciaService) {}

  @Get()
  @Roles('ADMIN_TENANT')
  get(@TenantId() tenantId: number) {
    return this.config.get(tenantId);
  }

  @Put()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.OK)
  upsert(
    @TenantId() tenantId: number,
    @Body() dto: UpsertConfigTransferenciaDto,
  ) {
    return this.config.upsert(tenantId, dto);
  }
}
