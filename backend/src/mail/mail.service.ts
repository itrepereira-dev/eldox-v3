import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * MailService — envio de e-mails transacionais.
 *
 * Drivers suportados (via MAIL_DRIVER):
 *   - console (default)   → loga o e-mail no stdout, não envia nada. Uso em
 *                           dev ou ambientes sem SMTP configurado.
 *   - smtp                → Nodemailer via SMTP. Requer MAIL_SMTP_HOST/PORT/
 *                           USER/PASS. Falha fallback para console.
 *
 * Vars de ambiente:
 *   MAIL_DRIVER     console | smtp   (default: console)
 *   MAIL_FROM       endereço do remetente (ex: "Eldox <noreply@eldox.com.br>")
 *   APP_URL         base URL usada nos links (ex: https://sistema.eldox.com.br)
 *   MAIL_SMTP_HOST  host SMTP
 *   MAIL_SMTP_PORT  porta (default 587)
 *   MAIL_SMTP_USER  credencial
 *   MAIL_SMTP_PASS  credencial
 *   MAIL_SMTP_SECURE 'true' para TLS direto (porta 465); default false (STARTTLS)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private readonly driver: 'console' | 'smtp';
  private readonly from: string;
  private readonly appUrl: string;
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const d = (this.config.get<string>('MAIL_DRIVER') ?? 'console').toLowerCase();
    this.driver = d === 'smtp' ? 'smtp' : 'console';
    this.from =
      this.config.get<string>('MAIL_FROM') ?? 'Eldox <noreply@eldox.com.br>';
    this.appUrl =
      this.config.get<string>('APP_URL') ?? 'https://sistema.eldox.com.br';

    if (this.driver === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('MAIL_SMTP_HOST'),
        port: parseInt(this.config.get<string>('MAIL_SMTP_PORT') ?? '587', 10),
        secure: this.config.get<string>('MAIL_SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('MAIL_SMTP_USER'),
          pass: this.config.get<string>('MAIL_SMTP_PASS'),
        },
      });
    }
  }

  getAppUrl(): string {
    return this.appUrl;
  }

  async send(payload: MailPayload): Promise<void> {
    if (this.driver === 'console' || !this.transporter) {
      this.logger.log(
        `[console driver] to=${payload.to} subject="${payload.subject}"`,
      );
      this.logger.log(`[console driver] body=${payload.text ?? payload.html}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    } catch (err) {
      this.logger.error(
        `falha ao enviar e-mail para ${payload.to}: ${(err as Error).message}`,
      );
      // Não relança — e-mail não pode travar o request (spec §Fallback).
    }
  }

  async enviarConvite(email: string, rawToken: string): Promise<void> {
    const link = `${this.appUrl}/aceitar-convite?token=${rawToken}`;
    await this.send({
      to: email,
      subject: 'Você foi convidado para o Eldox',
      text: `Clique no link para finalizar seu cadastro (válido por 72h):\n\n${link}`,
      html: `
        <p>Você foi convidado para acessar o Eldox.</p>
        <p><a href="${link}">Clique aqui para finalizar seu cadastro</a> (válido por 72h).</p>
        <p>Se o link não funcionar, copie e cole no navegador:<br><code>${link}</code></p>
      `,
    });
  }

  async enviarResetSenha(email: string, rawToken: string): Promise<void> {
    const link = `${this.appUrl}/reset-senha?token=${rawToken}`;
    await this.send({
      to: email,
      subject: 'Redefinir senha do Eldox',
      text: `Clique no link para redefinir sua senha (válido por 1h):\n\n${link}`,
      html: `
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p><a href="${link}">Clique aqui para criar uma nova senha</a> (válido por 1h).</p>
        <p>Se você não solicitou este reset, ignore este e-mail.</p>
      `,
    });
  }
}
