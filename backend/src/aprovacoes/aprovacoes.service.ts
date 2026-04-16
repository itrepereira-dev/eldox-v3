import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AprovacoesNotifierService } from './aprovacoes-notifier.service';
import { CreateAprovacaoDto } from './dto/create-aprovacao.dto';
import { DecidirAprovacaoDto } from './dto/decidir-aprovacao.dto';
import { DelegarAprovacaoDto } from './dto/delegar-aprovacao.dto';
import { ListAprovacoesDto } from './dto/list-aprovacoes.dto';
import {
  AprovacaoInstancia,
  WorkflowTemplateEtapa,
  Prisma,
} from '@prisma/client';

type SnapshotJson = Record<string, unknown>;

@Injectable()
export class AprovacoesService {
  private readonly logger = new Logger(AprovacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: AprovacoesNotifierService,
  ) {}

  // ── Solicitar aprovação ────────────────────────────────────────────────────

  async solicitar(
    tenantId: number,
    solicitanteId: number,
    dto: CreateAprovacaoDto & { snapshotJson: SnapshotJson },
  ) {
    // 1. Verifica unicidade: não pode existir instância PENDENTE|EM_APROVACAO para mesma entidade
    const emAndamento = await this.prisma.aprovacaoInstancia.findFirst({
      where: {
        tenantId,
        modulo: dto.modulo,
        entidadeId: dto.entidadeId,
        status: { in: ['PENDENTE', 'EM_APROVACAO'] },
        deletadoEm: null,
      },
    });
    if (emAndamento) {
      throw new BadRequestException(
        `Já existe uma aprovação em andamento para este registro (id=${emAndamento.id})`,
      );
    }

    // 2. Busca template ativo para o módulo
    const template = await this.prisma.workflowTemplate.findFirst({
      where: {
        tenantId,
        modulo: dto.modulo,
        ativo: true,
        deletadoEm: null,
      },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
    });

    if (!template) {
      throw new NotFoundException(
        'Nenhum template de aprovação ativo para este módulo',
      );
    }

    if (!template.etapas || template.etapas.length === 0) {
      throw new BadRequestException('Template de aprovação não possui etapas configuradas');
    }

    // 3. Avalia condição da primeira etapa ativa
    const primeiraEtapa = this.encontrarProximaEtapa(
      template.etapas,
      0,
      dto.snapshotJson,
    );
    if (!primeiraEtapa) {
      throw new BadRequestException(
        'Nenhuma etapa do template se aplica a este registro',
      );
    }

    // 4. Cria instância e decisão inicial em transação
    const instancia = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.aprovacaoInstancia.create({
        data: {
          tenantId,
          templateId: template.id,
          modulo: dto.modulo,
          entidadeId: dto.entidadeId,
          entidadeTipo: dto.entidadeTipo,
          obraId: dto.obraId ?? null,
          snapshotJson: dto.snapshotJson as object,
          etapaAtual: primeiraEtapa.ordem,
          status: 'EM_APROVACAO',
          titulo: dto.titulo,
          solicitanteId,
        },
      });

      await tx.aprovacaoDecisao.create({
        data: {
          tenantId,
          instanciaId: inst.id,
          etapaOrdem: primeiraEtapa.ordem,
          usuarioId: 0, // sistema
          decisao: 'INICIADA',
          observacao: 'Aprovação solicitada',
        },
      });

      return inst;
    });

    // 5. Notifica fire-and-forget
    this.notifier
      .notificarNovaPendente(tenantId, instancia.id)
      .catch((e: unknown) =>
        this.logger.error(`notificarNovaPendente falhou: ${e}`),
      );

    return { status: 'success', data: instancia };
  }

  // ── Decidir (aprovar/reprovar) ─────────────────────────────────────────────

  async decidir(
    tenantId: number,
    instanciaId: number,
    userId: number,
    userRole: string,
    dto: DecidirAprovacaoDto,
  ) {
    // 1. Busca instância com template e etapas
    const instancia = await this.prisma.aprovacaoInstancia.findFirst({
      where: { id: instanciaId, tenantId, deletadoEm: null },
      include: {
        template: {
          include: { etapas: { orderBy: { ordem: 'asc' } } },
        },
      },
    });

    if (!instancia) {
      throw new NotFoundException(`Instância de aprovação ${instanciaId} não encontrada`);
    }

    // 2. Valida status
    if (instancia.status !== 'EM_APROVACAO') {
      throw new BadRequestException(
        `Esta aprovação não está em andamento (status atual: ${instancia.status})`,
      );
    }

    // 3. Encontra etapa atual
    const etapaAtual = instancia.template.etapas.find(
      (e) => e.ordem === instancia.etapaAtual,
    );
    if (!etapaAtual) {
      throw new BadRequestException('Etapa atual não encontrada no template');
    }

    // 4. Valida permissão
    const temPermissao = await this.podeDecidir(
      instancia,
      etapaAtual,
      userId,
      userRole,
    );
    if (!temPermissao) {
      throw new ForbiddenException('Você não tem permissão para decidir esta etapa');
    }

    const snapshot = instancia.snapshotJson as SnapshotJson;

    if (dto.decisao === 'APROVADO') {
      // Procura próxima etapa com condição verdadeira
      const proximaEtapa = this.encontrarProximaEtapa(
        instancia.template.etapas,
        instancia.etapaAtual,
        snapshot,
      );

      await this.prisma.$transaction(async (tx) => {
        // Registra decisão de aprovação
        await tx.aprovacaoDecisao.create({
          data: {
            tenantId,
            instanciaId,
            etapaOrdem: instancia.etapaAtual,
            usuarioId: userId,
            decisao: 'APROVADO',
            observacao: dto.observacao ?? null,
          },
        });

        if (proximaEtapa) {
          // Avança para próxima etapa
          await tx.aprovacaoInstancia.update({
            where: { id: instanciaId },
            data: { etapaAtual: proximaEtapa.ordem },
          });

          await tx.aprovacaoDecisao.create({
            data: {
              tenantId,
              instanciaId,
              etapaOrdem: proximaEtapa.ordem,
              usuarioId: 0, // sistema
              decisao: 'INICIADA',
              observacao: `Avançou para etapa ${proximaEtapa.ordem}: ${proximaEtapa.nome}`,
            },
          });
        } else {
          // Última etapa: aprovação final
          await tx.aprovacaoInstancia.update({
            where: { id: instanciaId },
            data: { status: 'APROVADO' },
          });
        }
      });

      this.notifier
        .notificarDecisao(tenantId, instanciaId)
        .catch((e: unknown) =>
          this.logger.error(`notificarDecisao falhou: ${e}`),
        );
    } else {
      // REPROVADO — executa acaoRejeicao da etapa atual
      await this.executarAcaoRejeicao(
        tenantId,
        instancia,
        etapaAtual,
        userId,
        dto.observacao,
      );

      this.notifier
        .notificarDecisao(tenantId, instanciaId)
        .catch((e: unknown) =>
          this.logger.error(`notificarDecisao falhou: ${e}`),
        );
    }

    return this.buscar(tenantId, instanciaId, userId, userRole);
  }

  // ── Cancelar ───────────────────────────────────────────────────────────────

  async cancelar(
    tenantId: number,
    instanciaId: number,
    userId: number,
    userRole: string,
    motivo?: string,
  ) {
    const instancia = await this.prisma.aprovacaoInstancia.findFirst({
      where: { id: instanciaId, tenantId, deletadoEm: null },
    });

    if (!instancia) {
      throw new NotFoundException(`Instância de aprovação ${instanciaId} não encontrada`);
    }

    // Valida permissão: ADMIN_TENANT sempre pode; outros apenas se são o solicitante E status = PENDENTE
    const isAdmin = userRole === 'ADMIN_TENANT' || userRole === 'SUPER_ADMIN';
    const isSolicitante = instancia.solicitanteId === userId;
    const isPendente = instancia.status === 'PENDENTE';

    if (!isAdmin && !(isSolicitante && isPendente)) {
      throw new ForbiddenException(
        'Apenas o solicitante (enquanto PENDENTE) ou um administrador pode cancelar esta aprovação',
      );
    }

    if (
      instancia.status === 'APROVADO' ||
      instancia.status === 'CANCELADO'
    ) {
      throw new BadRequestException(
        `Não é possível cancelar uma aprovação com status ${instancia.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.aprovacaoInstancia.update({
        where: { id: instanciaId },
        data: { status: 'CANCELADO' },
      });

      await tx.aprovacaoDecisao.create({
        data: {
          tenantId,
          instanciaId,
          etapaOrdem: instancia.etapaAtual,
          usuarioId: userId,
          decisao: 'CANCELADO',
          observacao: motivo ?? null,
        },
      });
    });

    return { status: 'success', data: { id: instanciaId, status: 'CANCELADO' } };
  }

  // ── Delegar ────────────────────────────────────────────────────────────────

  async delegar(
    tenantId: number,
    instanciaId: number,
    userId: number,
    userRole: string,
    dto: DelegarAprovacaoDto,
  ) {
    const instancia = await this.prisma.aprovacaoInstancia.findFirst({
      where: { id: instanciaId, tenantId, deletadoEm: null },
      include: {
        template: {
          include: { etapas: { orderBy: { ordem: 'asc' } } },
        },
      },
    });

    if (!instancia) {
      throw new NotFoundException(`Instância de aprovação ${instanciaId} não encontrada`);
    }

    if (instancia.status !== 'EM_APROVACAO') {
      throw new BadRequestException('Só é possível delegar aprovações em andamento');
    }

    const etapaAtual = instancia.template.etapas.find(
      (e) => e.ordem === instancia.etapaAtual,
    );
    if (!etapaAtual) {
      throw new BadRequestException('Etapa atual não encontrada no template');
    }

    // Valida permissão para delegar
    const temPermissao = await this.podeDecidir(
      instancia,
      etapaAtual,
      userId,
      userRole,
    );
    if (!temPermissao) {
      throw new ForbiddenException('Você não tem permissão para delegar esta etapa');
    }

    // Valida que novoAprovadorId existe e tem role adequada
    const novoAprovador = await this.prisma.usuario.findFirst({
      where: {
        id: dto.novoAprovadorId,
        tenantId,
        ativo: true,
        deletadoEm: null,
      },
    });
    if (!novoAprovador) {
      throw new NotFoundException(`Usuário ${dto.novoAprovadorId} não encontrado`);
    }
    if (
      novoAprovador.role !== 'ENGENHEIRO' &&
      novoAprovador.role !== 'ADMIN_TENANT'
    ) {
      throw new BadRequestException(
        'O novo aprovador deve ter role ENGENHEIRO ou ADMIN_TENANT',
      );
    }

    await this.prisma.aprovacaoDecisao.create({
      data: {
        tenantId,
        instanciaId,
        etapaOrdem: instancia.etapaAtual,
        usuarioId: userId,
        decisao: 'DELEGADO',
        observacao:
          dto.observacao ??
          `Delegado para usuário ${dto.novoAprovadorId}`,
      },
    });

    this.notifier
      .notificarDelegacao(tenantId, instanciaId, dto.novoAprovadorId)
      .catch((e: unknown) =>
        this.logger.error(`notificarDelegacao falhou: ${e}`),
      );

    return { status: 'success', data: { id: instanciaId, delegadoPara: dto.novoAprovadorId } };
  }

  // ── Listar ─────────────────────────────────────────────────────────────────

  async listar(
    tenantId: number,
    userId: number,
    userRole: string,
    dto: ListAprovacoesDto,
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const baseWhere: Prisma.AprovacaoInstanciaWhereInput = {
      tenantId,
      deletadoEm: null,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.modulo ? { modulo: dto.modulo } : {}),
      ...(dto.obraId ? { obraId: dto.obraId } : {}),
      ...(dto.solicitanteId ? { solicitanteId: dto.solicitanteId } : {}),
    };

    // Filtro por role
    if (userRole === 'ADMIN_TENANT' || userRole === 'SUPER_ADMIN') {
      // vê todas
    } else if (userRole === 'ENGENHEIRO') {
      // Filtra por obras onde é responsável
      const obras = await this.prisma.obra.findMany({
        where: { tenantId, responsavelId: userId, deletadoEm: null },
        select: { id: true },
      });
      const obraIds = obras.map((o) => o.id);
      baseWhere.obraId = { in: obraIds };
    } else {
      // TECNICO e outros: apenas suas próprias solicitações
      baseWhere.solicitanteId = userId;
    }

    const [total, instancias] = await Promise.all([
      this.prisma.aprovacaoInstancia.count({ where: baseWhere }),
      this.prisma.aprovacaoInstancia.findMany({
        where: baseWhere,
        include: {
          template: { select: { nome: true, modulo: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    // Enriquece com nome do solicitante
    const solicitanteIds: number[] = [...new Set(instancias.map((i) => i.solicitanteId))];
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: solicitanteIds }, tenantId },
      select: { id: true, nome: true },
    });
    const usuarioMap = new Map(usuarios.map((u) => [u.id, u.nome]));

    const data = instancias.map((i) => ({
      ...i,
      solicitanteNome: usuarioMap.get(i.solicitanteId) ?? null,
    }));

    return { status: 'success', data, total, page, limit };
  }

  // ── Buscar detalhe ─────────────────────────────────────────────────────────

  async buscar(
    tenantId: number,
    instanciaId: number,
    _userId: number,
    _userRole: string,
  ) {
    const instancia = await this.prisma.aprovacaoInstancia.findFirst({
      where: { id: instanciaId, tenantId, deletadoEm: null },
      include: {
        template: {
          include: { etapas: { orderBy: { ordem: 'asc' } } },
        },
        decisoes: { orderBy: { criadoEm: 'asc' } },
      },
    });

    if (!instancia) {
      throw new NotFoundException(`Instância de aprovação ${instanciaId} não encontrada`);
    }

    // Enriquece com nome do solicitante
    const solicitante = await this.prisma.usuario.findFirst({
      where: { id: instancia.solicitanteId, tenantId },
      select: { id: true, nome: true, email: true },
    });

    // Enriquece com nome da obra
    let obra: { id: number; nome: string } | null = null;
    if (instancia.obraId) {
      obra = await this.prisma.obra.findFirst({
        where: { id: instancia.obraId, tenantId },
        select: { id: true, nome: true },
      });
    }

    // Enriquece decisões com nomes de usuários
    const usuarioIds: number[] = [
      ...new Set(
        instancia.decisoes
          .map((d) => d.usuarioId)
          .filter((id) => id > 0),
      ),
    ];
    const decisaoUsuarios = await this.prisma.usuario.findMany({
      where: { id: { in: usuarioIds }, tenantId },
      select: { id: true, nome: true },
    });
    const decisaoUsuarioMap = new Map(decisaoUsuarios.map((u) => [u.id, u.nome]));

    const decisoesEnriquecidas = instancia.decisoes.map((d) => ({
      ...d,
      usuarioNome: d.usuarioId > 0 ? (decisaoUsuarioMap.get(d.usuarioId) ?? null) : 'Sistema',
    }));

    return {
      status: 'success',
      data: {
        ...instancia,
        solicitante,
        obra,
        decisoes: decisoesEnriquecidas,
      },
    };
  }

  // ── Contar pendentes para o usuário ───────────────────────────────────────

  async contarPendentes(
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<{ status: string; data: { total: number } }> {
    if (userRole === 'ADMIN_TENANT' || userRole === 'SUPER_ADMIN') {
      const total = await this.prisma.aprovacaoInstancia.count({
        where: { tenantId, status: 'EM_APROVACAO', deletadoEm: null },
      });
      return { status: 'success', data: { total } };
    }

    if (userRole === 'ENGENHEIRO') {
      // Conta instâncias onde engenheiro é aprovador da etapa atual (por obra ou role)
      const rows = await this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*)::bigint AS total
        FROM aprovacao_instancias ai
        JOIN workflow_template_etapas wte
          ON wte.template_id = ai.template_id AND wte.ordem = ai.etapa_atual
        WHERE ai.tenant_id = ${tenantId}
          AND ai.status = 'EM_APROVACAO'
          AND ai.deleted_at IS NULL
          AND (
            (wte.tipo_aprovador = 'ROLE' AND wte.role = ${userRole})
            OR (wte.tipo_aprovador = 'USUARIO_FIXO' AND wte.usuario_fixo_id = ${userId})
            OR (
              wte.tipo_aprovador = 'RESPONSAVEL_OBRA'
              AND ai.obra_id IN (
                SELECT id FROM "Obra" WHERE tenant_id = ${tenantId} AND responsavel_id = ${userId} AND deleted_at IS NULL
              )
            )
          )
      `;
      return {
        status: 'success',
        data: { total: Number(rows[0]?.total ?? 0) },
      };
    }

    // Outros: conta apenas suas próprias solicitações pendentes
    const total = await this.prisma.aprovacaoInstancia.count({
      where: {
        tenantId,
        solicitanteId: userId,
        status: 'EM_APROVACAO',
        deletadoEm: null,
      },
    });
    return { status: 'success', data: { total } };
  }

  // ── Pendentes para mim ─────────────────────────────────────────────────────

  async pendentesParaMim(
    tenantId: number,
    userId: number,
    userRole: string,
  ) {
    if (userRole === 'ADMIN_TENANT' || userRole === 'SUPER_ADMIN') {
      const instancias = await this.prisma.aprovacaoInstancia.findMany({
        where: { tenantId, status: 'EM_APROVACAO', deletadoEm: null },
        include: { template: { select: { nome: true, modulo: true } } },
        orderBy: { criadoEm: 'asc' },
      });
      return { status: 'success', data: instancias };
    }

    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT ai.id
      FROM aprovacao_instancias ai
      JOIN workflow_template_etapas wte
        ON wte.template_id = ai.template_id AND wte.ordem = ai.etapa_atual
      WHERE ai.tenant_id = ${tenantId}
        AND ai.status = 'EM_APROVACAO'
        AND ai.deleted_at IS NULL
        AND (
          (wte.tipo_aprovador = 'ROLE' AND wte.role = ${userRole})
          OR (wte.tipo_aprovador = 'USUARIO_FIXO' AND wte.usuario_fixo_id = ${userId})
          OR (
            wte.tipo_aprovador = 'RESPONSAVEL_OBRA'
            AND ai.obra_id IN (
              SELECT id FROM "Obra" WHERE tenant_id = ${tenantId} AND responsavel_id = ${userId} AND deleted_at IS NULL
            )
          )
        )
    `;

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { status: 'success', data: [] };

    const instancias = await this.prisma.aprovacaoInstancia.findMany({
      where: { id: { in: ids }, deletadoEm: null },
      include: { template: { select: { nome: true, modulo: true } } },
      orderBy: { criadoEm: 'asc' },
    });

    return { status: 'success', data: instancias };
  }

  // ── Reabrir ────────────────────────────────────────────────────────────────

  async reabrir(tenantId: number, instanciaId: number, adminId: number) {
    const instancia = await this.prisma.aprovacaoInstancia.findFirst({
      where: { id: instanciaId, tenantId, deletadoEm: null },
    });

    if (!instancia) {
      throw new NotFoundException(`Instância de aprovação ${instanciaId} não encontrada`);
    }

    if (
      instancia.status !== 'REPROVADO' &&
      instancia.status !== 'CANCELADO'
    ) {
      throw new BadRequestException(
        'Somente aprovações REPROVADAS ou CANCELADAS podem ser reabertas',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.aprovacaoInstancia.update({
        where: { id: instanciaId },
        data: {
          status: 'PENDENTE',
          etapaAtual: 1,
          alertaEscalacaoEnviado: false,
        },
      });

      await tx.aprovacaoDecisao.create({
        data: {
          tenantId,
          instanciaId,
          etapaOrdem: 1,
          usuarioId: adminId,
          decisao: 'REABERTO',
          observacao: 'Aprovação reaberta pelo administrador',
        },
      });
    });

    return { status: 'success', data: { id: instanciaId, status: 'PENDENTE' } };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private encontrarProximaEtapa(
    etapas: WorkflowTemplateEtapa[],
    etapaAtualOrdem: number,
    snapshot: SnapshotJson,
  ): WorkflowTemplateEtapa | null {
    const etapasOrdenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
    const proximas = etapasOrdenadas.filter(
      (e) => e.ordem > etapaAtualOrdem,
    );

    for (const etapa of proximas) {
      if (this.avaliarCondicao(etapa.condicao, snapshot)) {
        return etapa;
      }
    }

    return null;
  }

  private avaliarCondicao(condicao: unknown, snapshot: SnapshotJson): boolean {
    if (!condicao) return true; // sem condição = sempre ativa

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cond = condicao as { campo: string; operador: string; valor: any };
    const { campo, operador, valor } = cond;
    const valorCampo = snapshot[campo];

    switch (operador) {
      case 'eq':
        return valorCampo === valor;
      case 'neq':
        return valorCampo !== valor;
      case 'gt':
        return Number(valorCampo) > Number(valor);
      case 'gte':
        return Number(valorCampo) >= Number(valor);
      case 'lt':
        return Number(valorCampo) < Number(valor);
      case 'lte':
        return Number(valorCampo) <= Number(valor);
      case 'in':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return Array.isArray(valor) && valor.includes(valorCampo);
      case 'not_in':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return Array.isArray(valor) && !valor.includes(valorCampo);
      default:
        return true;
    }
  }

  private async podeDecidir(
    instancia: AprovacaoInstancia,
    etapa: WorkflowTemplateEtapa,
    userId: number,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_TENANT') return true;

    if (etapa.tipoAprovador === 'ROLE') return etapa.role === userRole;

    if (etapa.tipoAprovador === 'USUARIO_FIXO') {
      return etapa.usuarioFixoId === userId;
    }

    if (etapa.tipoAprovador === 'RESPONSAVEL_OBRA') {
      if (!instancia.obraId) return userRole === 'ENGENHEIRO'; // fallback
      const obra = await this.prisma.obra.findUnique({
        where: { id: instancia.obraId },
      });
      // fallback se obra sem responsável configurado
      return obra?.responsavelId === userId || userRole === 'ENGENHEIRO';
    }

    return false;
  }

  private async executarAcaoRejeicao(
    tenantId: number,
    instancia: AprovacaoInstancia & { template: { etapas: WorkflowTemplateEtapa[] } },
    etapa: WorkflowTemplateEtapa,
    userId: number,
    observacao?: string,
  ): Promise<void> {
    const acaoRejeicao = etapa.acaoRejeicao;

    await this.prisma.$transaction(async (tx) => {
      // Registra decisão de reprovação
      await tx.aprovacaoDecisao.create({
        data: {
          tenantId,
          instanciaId: instancia.id,
          etapaOrdem: instancia.etapaAtual,
          usuarioId: userId,
          decisao: 'REPROVADO',
          observacao: observacao ?? null,
        },
      });

      switch (acaoRejeicao) {
        case 'RETORNAR_SOLICITANTE':
          await tx.aprovacaoInstancia.update({
            where: { id: instancia.id },
            data: { status: 'REPROVADO' },
          });
          break;

        case 'RETORNAR_ETAPA_1': {
          const etapa1 = instancia.template.etapas.find((e) => e.ordem === 1);
          await tx.aprovacaoInstancia.update({
            where: { id: instancia.id },
            data: { etapaAtual: 1, status: 'EM_APROVACAO' },
          });
          if (etapa1) {
            await tx.aprovacaoDecisao.create({
              data: {
                tenantId,
                instanciaId: instancia.id,
                etapaOrdem: 1,
                usuarioId: 0, // sistema
                decisao: 'INICIADA',
                observacao: 'Retornado à etapa 1 por reprovação',
              },
            });
          }
          break;
        }

        case 'RETORNAR_ETAPA_ANTERIOR': {
          const ordemAnterior = Math.max(1, instancia.etapaAtual - 1);
          await tx.aprovacaoInstancia.update({
            where: { id: instancia.id },
            data: { etapaAtual: ordemAnterior, status: 'EM_APROVACAO' },
          });
          await tx.aprovacaoDecisao.create({
            data: {
              tenantId,
              instanciaId: instancia.id,
              etapaOrdem: ordemAnterior,
              usuarioId: 0, // sistema
              decisao: 'INICIADA',
              observacao: `Retornado à etapa ${ordemAnterior} por reprovação`,
            },
          });
          break;
        }

        case 'BLOQUEAR':
          await tx.aprovacaoInstancia.update({
            where: { id: instancia.id },
            data: { status: 'REPROVADO' },
          });
          break;

        default:
          await tx.aprovacaoInstancia.update({
            where: { id: instancia.id },
            data: { status: 'REPROVADO' },
          });
      }
    });
  }
}
