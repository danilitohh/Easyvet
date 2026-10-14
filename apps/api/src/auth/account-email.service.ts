import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';

// Sends verification and password-reset messages through Resend without adding an SDK to the API bundle.
@Injectable()
export class AccountEmailService {
  private readonly logger = new Logger(AccountEmailService.name);

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async ensureAvailable(): Promise<void> {
    if (this.hasProvider()) return;
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') return;
    throw new ServiceUnavailableException({
      code: 'EMAIL_DELIVERY_NOT_CONFIGURED',
      message: 'Account email delivery is not configured',
    });
  }

  async sendVerification(email: string, link: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Confirma tu correo para activar Easyvet',
      heading: 'Activa tu cuenta de Easyvet',
      body: 'Confirma que este correo te pertenece para empezar a organizar tu clínica.',
      link,
      action: 'Verificar mi correo',
      expiration: 'El enlace vence en 24 horas.',
    });
  }

  async sendPasswordReset(email: string, link: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Restablece tu contraseña de Easyvet',
      heading: 'Crea una nueva contraseña',
      body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta.',
      link,
      action: 'Restablecer contraseña',
      expiration:
        'Por seguridad, el enlace vence en 15 minutos. Si no lo solicitaste, ignora este correo.',
    });
  }

  private hasProvider(): boolean {
    return Boolean(
      this.config.get('RESEND_API_KEY', { infer: true }) &&
      this.config.get('RESEND_FROM_EMAIL', { infer: true }),
    );
  }

  private async send(message: {
    to: string;
    subject: string;
    heading: string;
    body: string;
    link: string;
    action: string;
    expiration: string;
  }): Promise<void> {
    await this.ensureAvailable();
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('RESEND_FROM_EMAIL', { infer: true });
    if (!apiKey || !from) {
      this.logger.log(`Local account action link: ${message.link}`);
      return;
    }

    const link = escapeHtml(message.link);
    const heading = escapeHtml(message.heading);
    const body = escapeHtml(message.body);
    const expiration = escapeHtml(message.expiration);
    const action = escapeHtml(message.action);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: `<div style="margin:0;background:#f3f3f3;padding:40px 16px;font-family:Arial,sans-serif;color:#0a0808"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #dfe2e7;border-radius:20px;padding:36px"><p style="margin:0 0 18px;color:#0735d9;font-size:12px;font-weight:700;letter-spacing:2px">EASYVET</p><h1 style="margin:0 0 14px;font-size:25px;letter-spacing:-1px">${heading}</h1><p style="margin:0 0 28px;color:#626b7a;font-size:15px;line-height:1.7">${body}</p><a href="${link}" style="display:inline-block;border-radius:12px;background:#01229e;padding:14px 20px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">${action}</a><p style="margin:24px 0 0;color:#7c8490;font-size:12px;line-height:1.6">${expiration}</p><p style="margin:18px 0 0;color:#7c8490;font-size:11px;line-height:1.6">Si el botón no funciona, copia este enlace en tu navegador:<br><a style="color:#0735d9;overflow-wrap:anywhere" href="${link}">${link}</a></p></div></div>`,
        text: `${message.heading}\n\n${message.body}\n\n${message.action}: ${message.link}\n\n${message.expiration}`,
      }),
    });

    if (!response.ok) {
      this.logger.error(`Resend rejected an account email with status ${response.status}.`);
      throw new ServiceUnavailableException({
        code: 'ACCOUNT_EMAIL_DELIVERY_FAILED',
        message: 'Account email could not be delivered',
      });
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
