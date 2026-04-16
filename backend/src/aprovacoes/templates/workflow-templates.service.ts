import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AprovacaoModulo } from '@prisma/client';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';

const ROLES_VALIDAS = ['ENGENHEIRO', 'ADMIN_TENANT', 'TECNICO', 'LABORATORIO', 'VISITANTE'];

@Injectable()
export class WorkflowTemplatesService {
  private readonly logger = new Logger(WorkflowTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Criar template com etapas ──────────────────────────────────────────────

  async criar(tenantId: number, dto: CreateWorkflowTemplateDto) {
    if (!dto.etapas || dto.etapas.length === 0) {
      throw new BadRequestException('O template deve ter pelo menos uma etapa');
    }

    // Valida ordens sem duplicata
    const ordens = dto.etapas.map((e) => e.ordem);
    const ordensUnicas = new Set(ordens);
    if (ordensUnicas.size !== ordens.length) {
      throw new BadRequestException('Ordens de etapas não podem ser duplicadas');
    }

    // Valida role quando tipoAprovador = ROLE
    for (const etapa of dto.etapas) {
      if (etapa.tipoAprovador === 'ROLE') {
        if (!etapa.role) {
          throw new BadRequestException(
            `Etapa "${etapa.nome}" com tipoAprovador ROLE deve informar o campo role`,
          );
        }
        if (!ROLES_VALIDAS.includes(etapa.role)) {
          throw new BadRequestException(
            `Role "${etapa.role}" inválida. Use: ${ROLES_VALIDAS.join(', ')}`,
          );
        }
      }
      if (etapa.tipoAprovador === 'USUARIO_FIXO' && !etapa.usuarioFixoId) {
        throw new BadRequestException(
          `Etapa "${etapa.nome}" com tipoAprovador USUARIO_FIXO deve informar usuarioFixoId`,
        );
      }
    }

    const template = await this.prisma.workflowTemplate.create({
      data: {
        tenantId,
        nome: dto.nome,
        modulo: dto.modulo,
        descricao: dto.descricao,
        ativo: true,
        etapas: {
          create: dto.etapas.map((e) => ({
            ordem: e.ordem,
            nome: e.nome,
            tipoAprovador: e.tipoAprovador,
            role: e.role ?? null,
            usuarioFixoId: e.usuarioFixoId ?? null,
            condicao: e.condicao ?? undefined,
            prazoHoras: e.prazoHoras ?? 48,
            acaoVencimento: e.acaoVencimento ?? 'ESCALAR',
            acaoRejeicao: e.acaoRejeicao ?? 'RETORNAR_SOLICITANTE',
          })),
        },
      },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
    });

    return { status: 'success', data: template };
  }

  // ── Listar templates ───────────────────────────────────────────────────────

  async listar(tenantId: number, modulo?: AprovacaoModulo, ativo?: boolean) {
    const templates = await this.prisma.workflowTemplate.findMany({
      where: {
        tenantId,
        deletadoEm: null,
        ...(modulo !== undefined ? { modulo } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
      },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
      orderBy: { criadoEm: 'desc' },
    });

    return { status: 'success', data: templates };
  }

  // ── Buscar template por ID ─────────────────────────────────────────────────

  async buscar(tenantId: number, id: number) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id, tenantId, deletadoEm: null },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
    });

    if (!template) {
      throw new NotFoundException(`WorkflowTemplate ${id} não encontrado`);
    }

    return { status: 'success', data: template };
  }

  // ── Atualizar template (substitui etapas inteiras) ─────────────────────────

  async atualizar(tenantId: number, id: number, dto: CreateWorkflowTemplateDto) {
    // Valida existência
    const existente = await this.prisma.workflowTemplate.findFirst({
      where: { id, tenantId, deletadoEm: null },
    });
    if (!existente) {
      throw new NotFoundException(`WorkflowTemplate ${id} não encontrado`);
    }

    if (!dto.etapas || dto.etapas.length === 0) {
      throw new BadRequestException('O template deve ter pelo menos uma etapa');
    }

    const ordens = dto.etapas.map((e) => e.ordem);
    const ordensUnicas = new Set(ordens);
    if (ordensUnicas.size !== ordens.length) {
      throw new BadRequestException('Ordens de etapas não podem ser duplicadas');
    }

    for (const etapa of dto.etapas) {
      if (etapa.tipoAprovador === 'ROLE') {
        if (!etapa.role) {
          throw new BadRequestException(
            `Etapa "${etapa.nome}" com tipoAprovador ROLE deve informar o campo role`,
          );
        }
        if (!ROLES_VALIDAS.includes(etapa.role)) {
          throw new BadRequestException(
            `Role "${etapa.role}" inválida. Use: ${ROLES_VALIDAS.join(', ')}`,
          );
        }
      }
      if (etapa.tipoAprovador === 'USUARIO_FIXO' && !etapa.usuarioFixoId) {
        throw new BadRequestException(
          `Etapa "${etapa.nome}" com tipoAprovador USUARIO_FIXO deve informar usuarioFixoId`,
        );
      }
    }

    // Substitui etapas em transação
    const template = await this.prisma.$transaction(async (tx) => {
      await tx.workflowTemplateEtapa.deleteMany({ where: { templateId: id } });

      return tx.workflowTemplate.update({
        where: { id },
        data: {
          nome: dto.nome,
          modulo: dto.modulo,
          descricao: dto.descricao,
          etapas: {
            create: dto.etapas.map((e) => ({
              ordem: e.ordem,
              nome: e.nome,
              tipoAprovador: e.tipoAprovador,
              role: e.role ?? null,
              usuarioFixoId: e.usuarioFixoId ?? null,
              condicao: e.condicao ?? undefined,
              prazoHoras: e.prazoHoras ?? 48,
              acaoVencimento: e.acaoVencimento ?? 'ESCALAR',
              acaoRejeicao: e.acaoRejeicao ?? 'RETORNAR_SOLICITANTE',
            })),
          },
        },
        include: { etapas: { orderBy: { ordem: 'asc' } } },
      });
    });

    return { status: 'success', data: template };
  }

  // ── Desativar template ─────────────────────────────────────────────────────

  async desativar(tenantId: number, id: number) {
    const existente = await this.prisma.workflowTemplate.findFirst({
      where: { id, tenantId, deletadoEm: null },
    });
    if (!existente) {
      throw new NotFoundException(`WorkflowTemplate ${id} não encontrado`);
    }

    const template = await this.prisma.workflowTemplate.update({
      where: { id },
      data: { ativo: false },
    });

    return { status: 'success', data: template };
  }
}
