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
      // Action links contain bearer tokens; never write them to logs, even in local environments.
      this.logger.warn('Account email provider is not configured; action link omitted from logs.');
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
        html: renderAccountEmailHtml({ ...message, link, heading, body, expiration, action }),
        text: renderAccountEmailText(message),
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

type AccountEmailMessage = {
  subject: string;
  heading: string;
  body: string;
  link: string;
  action: string;
  expiration: string;
};

function renderAccountEmailHtml(
  message: AccountEmailMessage & {
    link: string;
    heading: string;
    body: string;
    action: string;
    expiration: string;
  },
): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#eef3fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#101522">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${message.heading}. ${message.expiration}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;border-collapse:collapse">
            <tr>
              <td style="padding:4px 8px 22px">
                <p style="margin:0;color:#123a9e;font-size:14px;font-weight:800;letter-spacing:2.5px">EASYVET</p>
                <p style="margin:7px 0 0;color:#68748a;font-size:12px;line-height:1.4">Gestión veterinaria más clara</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #d7e0ef;border-radius:24px;padding:38px 34px 32px;box-shadow:0 16px 42px rgba(34,58,112,.12)">
                <p style="margin:0 0 14px;color:#0a43d8;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase">SEGURIDAD DE TU CUENTA</p>
                <h1 style="margin:0 0 14px;color:#111522;font-size:30px;line-height:1.12;letter-spacing:-.8px;font-weight:700">${message.heading}</h1>
                <p style="margin:0;color:#5f6c80;font-size:16px;line-height:1.65">${message.body}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:28px 0">
                  <tr>
                    <td align="center">
                      <a href="${message.link}" style="display:inline-block;background:#082eb8;border-radius:14px;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none">${message.action} &nbsp;↗</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f4f7fd;border:1px solid #e0e7f3;border-radius:14px">
                  <tr>
                    <td style="padding:15px 16px;color:#44536b;font-size:13px;line-height:1.55"><strong style="color:#192943">Tiempo limitado</strong><br>${message.expiration}</td>
                  </tr>
                </table>
                <p style="margin:25px 0 0;color:#7a8597;font-size:12px;line-height:1.65">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:7px 0 0;font-size:12px;line-height:1.55;overflow-wrap:anywhere;word-break:break-word"><a href="${message.link}" style="color:#0a43d8;text-decoration:underline">${message.link}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 8px 0;color:#7a8597;font-size:11px;line-height:1.6;text-align:center">Este mensaje fue enviado automáticamente por Easyvet. Si no solicitaste este cambio, puedes ignorarlo.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderAccountEmailText(message: AccountEmailMessage): string {
  return `${message.heading}\n\n${message.body}\n\n${message.action}: ${message.link}\n\n${message.expiration}\n\nSi no solicitaste este cambio, puedes ignorar este mensaje.`;
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
