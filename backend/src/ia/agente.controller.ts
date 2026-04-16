// backend/src/ia/agente.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/tenant.decorator';
import { IaService } from './ia.service';
import { ChatMasterDto } from './dto/chat-master.dto';

@Controller('api/v1/ia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgenteController {
  constructor(private readonly ia: IaService) {}

  @Post('chat')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  @HttpCode(HttpStatus.OK)
  chat(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: ChatMasterDto,
  ) {
    return this.ia.chatMaster(tenantId, user.id, dto);
  }
}
