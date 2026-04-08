// src/ged/workflow/workflow.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GedWorkflowTemplate,
  GedWorkflowStep,
  GedWorkflowExecucao,
} from '../types/ged.types';

export interface WorkflowInicioResult {
  templateId: number;
  stepAtualId: number;
  stepAtualNome: string;
  stepAtualOrdem: number;
  roleMinima: string;
  prazoHoras: number | null;
}

export interface WorkflowStepResult {
  concluido: boolean;
  proximoStepId: number | null;
  proximoStepNome: string | null;
  mensagem: string;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca template de workflow por ID, validando tenant.
   */
  async findTemplate(tenantId: number, templateId: number): Promise<GedWorkflowTemplate> {
    const rows = await this.prisma.$queryRawUnsafe<GedWorkflowTemplate[]>(
      `SELECT id, tenant_id, nome, tipo
       FROM ged_workflow_templates
       WHERE id = $1 AND tenant_id = $2`,
      templateId,
      tenantId,
    );

    if (!rows.length) {
      throw new NotFoundException(`Workflow template ${templateId} não encontrado.`);
    }
    return rows[0];
  }

  /**
   * Busca todos os steps de um template, ordenados por ordem.
   */
  async findSteps(templateId: number): Promise<GedWorkflowStep[]> {
    return this.prisma.$queryRawUnsafe<GedWorkflowStep[]>(
      `SELECT id, template_id, ordem, nome, role_minima, obrigatorio, prazo_horas,
              condicao_avanco, acao_timeout
       FROM ged_workflow_steps
       WHERE template_id = $1
       ORDER BY ordem ASC`,
      templateId,
    );
  }

  /**
   * Inicia um workflow para uma versão de documento.
   * Define workflow_template_id e workflow_step_atual na versão.
   */
  async iniciar(
    tenantId: number,
    versaoId: number,
    templateId: number,
    userId: number,
  ): Promise<WorkflowInicioResult> {
    const template = await this.findTemplate(tenantId, templateId);
    const steps = await this.findSteps(templateId);

    if (!steps.length) {
      throw new BadRequestException(
        `Workflow template ${templateId} não possui steps configurados.`,
      );
    }

    const primeiroStep = steps[0];

    // Atualiza a versão com o template e step inicial
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes
       SET workflow_template_id = $1, workflow_step_atual = $2
       WHERE id = $3`,
      templateId,
      primeiroStep.id,
      versaoId,
    );

    // Registra execução de início
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ged_workflow_execucoes
         (tenant_id, versao_id, template_id, step_id, usuario_id, acao, comentario)
       VALUES ($1, $2, $3, $4, $5, 'INICIO', 'Workflow iniciado automaticamente')`,
      tenantId,
      versaoId,
      templateId,
      primeiroStep.id,
      userId,
    );

    this.logger.log(
      `Workflow iniciado: versao=${versaoId} template=${template.nome} step=${primeiroStep.nome}`,
    );

    return {
      templateId,
      stepAtualId: primeiroStep.id,
      stepAtualNome: primeiroStep.nome,
      stepAtualOrdem: primeiroStep.ordem,
      roleMinima: primeiroStep.role_minima,
      prazoHoras: primeiroStep.prazo_horas,
    };
  }

  /**
   * Executa uma ação em um step do workflow.
   * Avança para próximo step ou marca como concluído.
   */
  async executarStep(
    tenantId: number,
    versaoId: number,
    userId: number,
    acao: string,
    comentario?: string,
  ): Promise<WorkflowStepResult> {
    // Busca versão atual com step
    const versoes = await this.prisma.$queryRawUnsafe<
      { workflow_template_id: number; workflow_step_atual: number }[]
    >(
      `SELECT workflow_template_id, workflow_step_atual
       FROM ged_versoes
       WHERE id = $1`,
      versaoId,
    );

    if (!versoes.length) {
      throw new NotFoundException(`Versão ${versaoId} não encontrada.`);
    }

    const versao = versoes[0];
    if (!versao.workflow_template_id || !versao.workflow_step_atual) {
      throw new BadRequestException('Esta versão não possui workflow ativo.');
    }

    // Busca step atual
    const steps = await this.findSteps(versao.workflow_template_id);
    const stepAtualIdx = steps.findIndex((s) => s.id === versao.workflow_step_atual);

    if (stepAtualIdx === -1) {
      throw new BadRequestException('Step atual do workflow não encontrado.');
    }

    const stepAtual = steps[stepAtualIdx];

    // Registra execução do step
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ged_workflow_execucoes
         (tenant_id, versao_id, template_id, step_id, usuario_id, acao, comentario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      tenantId,
      versaoId,
      versao.workflow_template_id,
      stepAtual.id,
      userId,
      acao,
      comentario ?? null,
    );

    // Verifica se há próximo step
    const proximoStep = steps[stepAtualIdx + 1] ?? null;

    if (proximoStep) {
      // Avança para o próximo step
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes SET workflow_step_atual = $1 WHERE id = $2`,
        proximoStep.id,
        versaoId,
      );

      return {
        concluido: false,
        proximoStepId: proximoStep.id,
        proximoStepNome: proximoStep.nome,
        mensagem: `Workflow avançou para o step: ${proximoStep.nome}`,
      };
    }

    // Workflow concluído — limpa step_atual (null = concluído)
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes SET workflow_step_atual = NULL WHERE id = $1`,
      versaoId,
    );

    this.logger.log(`Workflow concluído: versao=${versaoId}`);

    return {
      concluido: true,
      proximoStepId: null,
      proximoStepNome: null,
      mensagem: 'Workflow concluído. Todos os steps foram executados.',
    };
  }

  /**
   * Verifica se o workflow de uma versão está concluído.
   */
  async verificarConclusao(versaoId: number): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<
      { workflow_step_atual: number | null }[]
    >(
      `SELECT workflow_step_atual FROM ged_versoes WHERE id = $1`,
      versaoId,
    );

    if (!rows.length) return false;
    // workflow_step_atual = NULL significa concluído ou sem workflow
    return rows[0].workflow_step_atual === null;
  }

  /**
   * Busca histórico de execuções de um workflow para uma versão.
   */
  async buscarHistorico(tenantId: number, versaoId: number): Promise<GedWorkflowExecucao[]> {
    return this.prisma.$queryRawUnsafe<GedWorkflowExecucao[]>(
      `SELECT id, tenant_id, versao_id, template_id, step_id, usuario_id, acao, comentario, criado_em
       FROM ged_workflow_execucoes
       WHERE versao_id = $1 AND tenant_id = $2
       ORDER BY criado_em ASC`,
      versaoId,
      tenantId,
    );
  }
}
