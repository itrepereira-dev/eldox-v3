// backend/src/ensaios/alertas/alertas.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EvolutionService } from '../whatsapp/evolution.service';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Busca usuário ENGENHEIRO da obra com whatsapp cadastrado.
   * Retorna null se não encontrado.
   */
  private async buscarEngenheiroDaObra(
    tenantId: number,
    obraId: number,
  ): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<{ whatsapp: string }[]>(
      `SELECT u.whatsapp
       FROM "UsuarioObra" uo
       JOIN "Usuario" u ON u.id = uo."usuarioId" AND u."tenantId" = $2
       JOIN "Obra" o ON o.id = uo."obraId" AND o."tenantId" = $2
       WHERE uo."obraId" = $1
         AND u.role = 'ENGENHEIRO' AND u.ativo = true
         AND u.whatsapp IS NOT NULL
       LIMIT 1`,
      obraId,
      tenantId,
    );
    return rows[0]?.whatsapp ?? null;
  }

  /**
   * Registra resultado do envio em ensaio_alerta_log (fire-and-forget).
   */
  private async logAlerta(
    tenantId: number,
    tipo: string,
    referenciaId: number,
    destinatario: string,
    status: string,
    tentativas: number,
    erro?: string,
  ): Promise<void> {
    await this.prisma
      .$executeRawUnsafe(
        `INSERT INTO ensaio_alerta_log (tenant_id, tipo, referencia_id, destinatario, status, tentativas, erro)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        tenantId,
        tipo,
        referenciaId,
        destinatario,
        status,
        tentativas,
        erro ?? null,
      )
      .catch((e: unknown) =>
        this.logger.error(`Falha ao gravar ensaio_alerta_log: ${e}`),
      );
  }

  /**
   * Envia mensagem com retry (3x, backoff 1s/2s/4s).
   * Retorna 'ENVIADO' | 'FALHOU'.
   */
  private async enviarComRetry(
    numero: string,
    mensagem: string,
  ): Promise<{ status: string; tentativas: number; erro?: string }> {
    // 3 tentativas: delays entre elas = [1s, 2s] → total backoff 1s+2s
    const delays = [1000, 2000];
    let lastError = '';
    for (let i = 0; i < delays.length + 1; i++) {
      try {
        await this.evolution.enviarMensagem(numero, mensagem);
        return { status: 'ENVIADO', tentativas: i + 1 };
      } catch (err) {
        lastError = String(err);
        if (i < delays.length) {
          await new Promise((r) => setTimeout(r, delays[i]));
        }
      }
    }
    return { status: 'FALHOU', tentativas: 3, erro: lastError };
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────

  /**
   * Job diário: verifica ensaios com próximo cupom em <= 3 dias
   * e ensaios vencidos não alertados.
   */
  async verificarProximosCupons(): Promise<void> {
    this.logger.log('Iniciando verificação de próximos cupons...');

    const ensaios = await this.prisma.$queryRawUnsafe<{
      id: number;
      tenant_id: number;
      obra_id: number;
      proximo_ensaio_data: Date;
      tipo_nome: string;
      lote_codigo: string;
    }[]>(
      `SELECT
         e.id, e.tenant_id, e.obra_id, e.proximo_ensaio_data,
         et.nome AS tipo_nome,
         fl.numero_lote AS lote_codigo
       FROM ensaio_laboratorial e
       JOIN ensaio_resultado er ON er.ensaio_id = e.id
       JOIN ensaio_tipo et ON et.id = er.ensaio_tipo_id
       JOIN fvm_lotes fl ON fl.id = e.fvm_lote_id
       WHERE e.proximo_ensaio_data BETWEEN NOW() - INTERVAL '30 days' AND NOW() + INTERVAL '3 days'
         AND e.proximo_ensaio_alertado = FALSE
       ORDER BY e.proximo_ensaio_data ASC`,
    );

    this.logger.log(`${ensaios.length} ensaios para alertar`);

    for (const ensaio of ensaios) {
      // C3: Marcar como alertado PRIMEIRO para evitar retry infinito em caso de crash
      await this.prisma
        .$executeRawUnsafe(
          `UPDATE ensaio_laboratorial SET proximo_ensaio_alertado = TRUE, updated_at = NOW()
           WHERE id = $1`,
          ensaio.id,
        )
        .catch((e: unknown) =>
          this.logger.error(`Falha ao marcar alertado ensaio ${ensaio.id}: ${e}`),
        );

      const dataFmt = new Date(ensaio.proximo_ensaio_data).toLocaleDateString('pt-BR');
      const vencido = new Date(ensaio.proximo_ensaio_data) < new Date();

      const mensagem = vencido
        ? `🚨 Ensaio VENCIDO: ${ensaio.tipo_nome} do lote ${ensaio.lote_codigo} venceu em ${dataFmt}. Providenciar urgente.`
        : `⚠️ Ensaio de ${ensaio.tipo_nome} do lote ${ensaio.lote_codigo} vence em ${dataFmt}. Programe o envio ao laboratório.`;

      const numero = await this.buscarEngenheiroDaObra(ensaio.tenant_id, ensaio.obra_id);

      if (!numero) {
        // C7: fire-and-forget — não bloqueia o loop
        void this.logAlerta(ensaio.tenant_id, 'PROXIMO_CUPOM', ensaio.id, 'N/A', 'SEM_WHATSAPP', 1)
          .catch((e: unknown) => this.logger.error(`logAlerta falhou: ${e}`));
      } else {
        const result = await this.enviarComRetry(numero, mensagem);
        // C7: fire-and-forget
        void this.logAlerta(
          ensaio.tenant_id,
          'PROXIMO_CUPOM',
          ensaio.id,
          numero,
          result.status,
          result.tentativas,
          result.erro,
        ).catch((e: unknown) => this.logger.error(`logAlerta falhou: ${e}`));
      }
    }

    this.logger.log('Verificação de próximos cupons concluída');
  }

  /**
   * Notifica após decisão de revisão de laudo.
   * APROVADO → engenheiro da obra
   * REPROVADO → engenheiro da obra
   */
  async notificarRevisao(params: {
    tenantId: number;
    obraId: number;
    revisaoId: number;
    situacao: 'APROVADO' | 'REPROVADO';
    tiposEnsaio: string;
    loteCodigo: string;
  }): Promise<void> {
    const tipo = params.situacao === 'APROVADO' ? 'LAUDO_APROVADO' : 'LAUDO_REPROVADO';

    const emoji = params.situacao === 'APROVADO' ? '✅' : '🚫';
    const texto = `${emoji} Laudo ${params.situacao === 'APROVADO' ? 'aprovado' : 'reprovado'}: ${params.tiposEnsaio} — lote ${params.loteCodigo}. Acesse o Eldox para detalhes.`;

    const numero = await this.buscarEngenheiroDaObra(params.tenantId, params.obraId);

    if (!numero) {
      void this.logAlerta(params.tenantId, tipo, params.revisaoId, 'N/A', 'SEM_WHATSAPP', 1)
        .catch((e: unknown) => this.logger.error(`logAlerta falhou: ${e}`));
      return;
    }

    const result = await this.enviarComRetry(numero, texto);
    void this.logAlerta(
      params.tenantId,
      tipo,
      params.revisaoId,
      numero,
      result.status,
      result.tentativas,
      result.erro,
    ).catch((e: unknown) => this.logger.error(`logAlerta falhou: ${e}`));
  }
}
