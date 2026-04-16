// backend/src/concretagem/croqui/croqui.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { CroquiService } from './croqui.service';
import { PlantaIaService } from './planta-ia.service';
import { AnalisarPlantaDto } from './dto/analisar-planta.dto';
import { CreateCroquiDto } from './dto/create-croqui.dto';
import { UpdateCroquiDto } from './dto/update-croqui.dto';

@Controller('api/v1/obras/:obraId/croquis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CroquiController {
  constructor(
    private readonly croqui: CroquiService,
    private readonly plantaIa: PlantaIaService,
  ) {}

  // POST /api/v1/obras/:obraId/croquis/analisar
  // Análise IA — não persiste, engenheiro revisa antes de salvar
  @Post('analisar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async analisar(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: AnalisarPlantaDto,
  ) {
    const data = await this.plantaIa.analisar(tenantId, user.id, dto);
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/croquis
  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.croqui.listar(tenantId, obraId);
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/croquis/:croquiId
  @Get(':croquiId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async buscar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('croquiId', ParseIntPipe) croquiId: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.croqui.buscar(tenantId, obraId, croquiId);
    return { status: 'success', data };
  }

  // POST /api/v1/obras/:obraId/croquis
  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async criar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateCroquiDto,
  ) {
    const data = await this.croqui.criar(tenantId, obraId, user.id, dto);
    return { status: 'success', data };
  }

  // PATCH /api/v1/obras/:obraId/croquis/:croquiId
  @Patch(':croquiId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async atualizar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('croquiId', ParseIntPipe) croquiId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateCroquiDto,
  ) {
    const data = await this.croqui.atualizar(
      tenantId, obraId, croquiId, user.id, dto,
    );
    return { status: 'success', data };
  }

  // DELETE /api/v1/obras/:obraId/croquis/:croquiId
  @Delete(':croquiId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  async deletar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('croquiId', ParseIntPipe) croquiId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
  ) {
    const data = await this.croqui.deletar(tenantId, obraId, croquiId, user.id);
    return { status: 'success', data };
  }
}
