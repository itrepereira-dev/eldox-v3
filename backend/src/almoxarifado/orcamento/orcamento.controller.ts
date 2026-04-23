// backend/src/almoxarifado/orcamento/orcamento.controller.ts
import {
  BadRequestException,
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe,
  UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Req, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { OrcamentoService } from './orcamento.service';
import { UpdateOrcamentoItemDto } from './dto/update-orcamento-item.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrcamentoController {
  constructor(private readonly orcamento: OrcamentoService) {}

  @Get('obras/:obraId/orcamentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getVersoes(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.orcamento.getVersoes(tenantId, obraId);
  }

  @Post('obras/:obraId/orcamentos/import')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (_req, file, cb) => {
        const name = file.originalname?.toLowerCase() ?? '';
        const ok =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          name.endsWith('.xlsx') ||
          name.endsWith('.xls');
        cb(
          ok
            ? null
            : new BadRequestException('Orçamento precisa ser .xlsx'),
          ok,
        );
      },
    }),
  )
  async importarXlsx(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('nome') nome: string | undefined,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.orcamento.importarXlsx(tenantId, obraId, usuarioId, file.buffer, nome);
  }

  @Get('orcamentos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getVersao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orcamento.getVersaoOuFalhar(tenantId, id);
  }

  @Patch('orcamentos/:id/ativar')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  ativarVersao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orcamento.ativarVersao(tenantId, id);
  }

  @Delete('orcamentos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVersao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orcamento.deleteVersao(tenantId, id);
  }

  @Get('orcamentos/:id/itens')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getItens(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit')    limit?: string,
    @Query('offset')   offset?: string,
    @Query('semMatch') semMatch?: string,
  ) {
    return this.orcamento.getItens(tenantId, id, {
      limit:    limit    ? Number(limit)    : undefined,
      offset:   offset   ? Number(offset)   : undefined,
      semMatch: semMatch === 'true',
    });
  }

  @Patch('orcamentos/itens/:itemId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateItem(
    @TenantId() tenantId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateOrcamentoItemDto,
  ) {
    return this.orcamento.updateItem(tenantId, itemId, dto);
  }

  /**
   * GET /api/v1/almoxarifado/orcamentos/template
   * Baixa a planilha modelo de orçamento de obra (SINAPI-compatível).
   */
  @Get('orcamentos/template')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  downloadTemplate(@Res() res: Response) {
    const buffer = this.orcamento.gerarTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="eldox_orcamento_obra_modelo.xlsx"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
