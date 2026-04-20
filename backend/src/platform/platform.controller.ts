import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt } from 'class-validator';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/tenant.decorator';

class ImpersonateDto {
  @IsInt()
  tenantId!: number;
}

@Controller('api/v1/platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN' as never)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  listarTenants(
    @CurrentUser()
    user: {
      id: number;
      tenantId: number;
      originalTenantId?: number;
      role: string;
    },
  ) {
    return this.platform.listarTenants(user);
  }

  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  impersonate(
    @CurrentUser()
    user: {
      id: number;
      tenantId: number;
      originalTenantId?: number;
      role: string;
    },
    @Body() dto: ImpersonateDto,
  ) {
    return this.platform.impersonate(user, dto.tenantId);
  }
}
