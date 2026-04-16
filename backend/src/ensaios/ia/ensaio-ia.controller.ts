// backend/src/ensaios/ia/ensaio-ia.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { EnsaioIaService } from './ensaio-ia.service';
import { ExtrairLaudoIaDto } from './dto/extrair-laudo-ia.dto';

@Controller('api/v1/ensaios/ia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnsaioIaController {
  constructor(private readonly ensaioIa: EnsaioIaService) {}

  @Post('extrair')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(200)
  async extrair(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: ExtrairLaudoIaDto,
  ) {
    const data = await this.ensaioIa.extrairLaudo(tenantId, user.id, dto);
    return { status: 'success', data };
  }
}
