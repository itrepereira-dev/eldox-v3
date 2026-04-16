// backend/src/concretagem/concretagens/email-concretagem.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface EmailConcrtagemPayload {
  tipo: 'NOVA_CONCRETAGEM' | 'CONCRETAGEM_CANCELADA';
  concretagem: {
    id: number;
    numero: string;
    elemento_estrutural: string;
    data_programada: string;
    hora_programada: string | null;
    volume_previsto: number;
    fck_especificado: number;
    traco_especificado: string | null;
    bombeado: boolean;
    intervalo_min_caminhoes: number | null;
    cancelamento_solicitante: string | null;
    cancelamento_multa: boolean;
  };
  fornecedor: {
    nome: string;
    email: string | null;
  };
  obra: {
    nome: string;
  };
}

@Injectable()
export class EmailConcrtagemService {
  private readonly logger = new Logger(EmailConcrtagemService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Envio de notificação para usina ──────────────────────────────────────────

  async enviarNotificacaoUsina(
    tenantId: number,
    concrtagemId: number,
    tipo: 'NOVA_CONCRETAGEM' | 'CONCRETAGEM_CANCELADA',
  ): Promise<void> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
           b.id, b.numero, b.elemento_estrutural, b.data_programada, b.hora_programada,
           b.volume_previsto, b.fck_especificado, b.traco_especificado,
           b.bombeado, b.intervalo_min_caminhoes,
           b.cancelamento_solicitante, b.cancelamento_multa,
           b.fornecedor_id,
           o.nome AS obra_nome
         FROM concretagens b
         JOIN "Obra" o ON o.id = b.obra_id
         WHERE b.tenant_id = $1 AND b.id = $2`,
        tenantId,
        concrtagemId,
      );

      if (!rows[0]) {
        this.logger.warn(`Concretagem ${concrtagemId} não encontrada para envio de email`);
        return;
      }

      const row = rows[0];

      // Gera token do portal para nova concretagem
      let portalUrl: string | null = null;
      if (tipo === 'NOVA_CONCRETAGEM') {
        portalUrl = await this.gerarTokenPortal(tenantId, concrtagemId);
      }

      const assunto =
        tipo === 'NOVA_CONCRETAGEM'
          ? `[Eldox] Nova Concretagem Programada — ${row.numero as string} — ${row.obra_nome as string}`
          : `[Eldox] CANCELAMENTO de Concretagem — ${row.numero as string} — ${row.obra_nome as string}`;

      const corpo =
        tipo === 'NOVA_CONCRETAGEM'
          ? this.templateNovaBetonada(row, portalUrl)
          : this.templateCancelamento(row);

      this.logger.log(
        `Email usina [${tipo}] concretagem=${row.numero as string} obra="${row.obra_nome as string}"`,
      );

      // Gera XLS apenas para NOVA_CONCRETAGEM
      const xlsBuffer =
        tipo === 'NOVA_CONCRETAGEM'
          ? this.gerarXlsConcretagem(row)
          : null;

      await this.tryEnviarEmail(
        assunto,
        corpo,
        row.fornecedor_id as number,
        tenantId,
        xlsBuffer,
        `Concretagem_${row.numero as string}.xlsx`,
      );

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
         VALUES ($1, 0, $2, 'concretagem', $3, NULL::jsonb, $4::jsonb)`,
        tenantId,
        `EMAIL_USINA_${tipo}`,
        concrtagemId,
        JSON.stringify({ assunto, tipo }),
      );
    } catch (e: unknown) {
      this.logger.error(`Falha ao enviar email usina: ${e}`);
    }
  }

  // ── Gerar token de portal do fornecedor ─────────────────────────────────────

  async gerarTokenPortal(tenantId: number, concrtagemId: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO fornecedor_portal_tokens (tenant_id, concretagem_id, token)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      tenantId,
      concrtagemId,
      token,
    );
    const appUrl = process.env.APP_URL ?? 'https://app.eldox.com.br';
    return `${appUrl}/portal-fornecedor?token=${token}`;
  }

  // ── Geração de XLS ───────────────────────────────────────────────────────────

  private gerarXlsConcretagem(row: Record<string, unknown>): Buffer | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const XLSX = require('xlsx') as any;

      const dados = [
        ['Campo', 'Valor'],
        ['Número da Concretagem', row.numero],
        ['Obra', row.obra_nome],
        ['Elemento Estrutural', row.elemento_estrutural],
        ['Data Programada', row.data_programada],
        ['Hora Programada', row.hora_programada ?? 'A definir'],
        ['Volume Previsto (m³)', row.volume_previsto],
        ['FCK Especificado (MPa)', row.fck_especificado],
        ['Traço', row.traco_especificado ?? 'Não especificado'],
        ['Bombeado', row.bombeado ? 'Sim' : 'Não'],
        ['Intervalo Mínimo entre Caminhões (min)', row.intervalo_min_caminhoes ?? 'Não definido'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Programação');

      // Style header row
      ws['A1'].s = { font: { bold: true } };
      ws['B1'].s = { font: { bold: true } };

      const buf: Buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      return buf;
    } catch (e: unknown) {
      this.logger.warn(`Falha ao gerar XLS: ${e}`);
      return null;
    }
  }

  // ── Templates de texto ───────────────────────────────────────────────────────

  private templateNovaBetonada(row: Record<string, unknown>, portalUrl: string | null): string {
    return `
Nova concretagem programada no sistema Eldox:

Número: ${row.numero as string}
Obra: ${row.obra_nome as string}
Elemento: ${row.elemento_estrutural as string}
Data: ${row.data_programada as string}
Hora: ${row.hora_programada ?? 'A definir'}
Volume: ${row.volume_previsto as number} m³
FCK: ${row.fck_especificado as number} MPa
Traço: ${row.traco_especificado ?? 'Não especificado'}
Bombeado: ${row.bombeado ? 'Sim' : 'Não'}
Intervalo mínimo entre caminhões: ${row.intervalo_min_caminhoes ? `${row.intervalo_min_caminhoes as number} min` : 'Não definido'}
${portalUrl ? `\nAcesse o portal da programação:\n${portalUrl}` : ''}

Planilha com dados detalhados em anexo.
    `.trim();
  }

  private templateCancelamento(row: Record<string, unknown>): string {
    return `
ATENÇÃO: Concretagem CANCELADA no sistema Eldox:

Número: ${row.numero as string}
Obra: ${row.obra_nome as string}
Elemento: ${row.elemento_estrutural as string}
Data programada: ${row.data_programada as string}
Volume: ${row.volume_previsto as number} m³

Cancelamento solicitado por: ${row.cancelamento_solicitante ?? 'Não informado'}
Possui multa: ${row.cancelamento_multa ? 'SIM' : 'Não'}

Acesse o sistema Eldox para mais detalhes.
    `.trim();
  }

  // ── Envio via nodemailer ─────────────────────────────────────────────────────

  private async tryEnviarEmail(
    assunto: string,
    corpo: string,
    fornecedorId: number,
    tenantId: number,
    xlsBuffer: Buffer | null,
    xlsFileName: string,
  ): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      this.logger.warn('SMTP_HOST não configurado — email não enviado');
      return;
    }

    const emailRows = await this.prisma
      .$queryRawUnsafe<{ email: string }[]>(
        `SELECT email FROM fornecedores WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        tenantId,
        fornecedorId,
      )
      .catch(() => [] as { email: string }[]);

    const emailDestino = emailRows[0]?.email;
    if (!emailDestino) {
      this.logger.warn(`Fornecedor ${fornecedorId} sem email cadastrado — email não enviado`);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const nodemailer = require('nodemailer') as any;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const attachments: object[] = [];
      if (xlsBuffer) {
        attachments.push({
          filename: xlsFileName,
          content: xlsBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }

      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@eldox.app',
        to: emailDestino,
        subject: assunto,
        text: corpo,
        attachments,
      });

      this.logger.log(`Email com XLS enviado para ${emailDestino}`);
    } catch (e: unknown) {
      this.logger.warn(`Erro ao enviar email via nodemailer: ${e}`);
    }
  }
}
