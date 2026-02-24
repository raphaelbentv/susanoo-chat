import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!CONFIG.SMTP.HOST || !CONFIG.SMTP.FROM_EMAIL) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: CONFIG.SMTP.HOST,
      port: CONFIG.SMTP.PORT,
      secure: CONFIG.SMTP.SECURE,
      auth: { user: CONFIG.SMTP.USER, pass: CONFIG.SMTP.PASS },
    });
  }
  return _transporter;
}

export function isEmailConfigured(): boolean {
  return !!(CONFIG.SMTP.HOST && CONFIG.SMTP.FROM_EMAIL);
}

export async function sendWelcomeEmail(
  toEmail: string,
  firstName: string,
  password: string,
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    log('warn', 'email_not_configured', {});
    return false;
  }

  const html = buildWelcomeEmailHtml(firstName, toEmail, password);

  try {
    await transporter.sendMail({
      from: `"${CONFIG.SMTP.FROM_NAME}" <${CONFIG.SMTP.FROM_EMAIL}>`,
      to: toEmail,
      subject: 'Bienvenue sur Hashirama — Vos identifiants',
      html,
    });
    return true;
  } catch (e) {
    log('error', 'email_send_failed', { to: toEmail, error: (e as Error).message });
    return false;
  }
}

function buildWelcomeEmailHtml(firstName: string, email: string, password: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050408;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050408;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:rgba(10,8,5,0.98);border:1px solid rgba(170,120,25,0.20);max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 20px;text-align:center;border-bottom:1px solid rgba(170,120,25,0.12);">
            <div style="font-family:'Cinzel',Georgia,serif;font-size:22px;color:#c8a020;letter-spacing:6px;text-transform:uppercase;">
              HASHIRAMA
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.40);letter-spacing:2px;margin-top:6px;text-transform:uppercase;">
              Interface Imp&eacute;riale
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:rgba(255,255,255,0.95);font-size:15px;margin:0 0 20px;line-height:1.6;">
              Bonjour <strong style="color:#c8a020;">${firstName}</strong>,
            </p>
            <p style="color:rgba(255,255,255,0.70);font-size:14px;margin:0 0 28px;line-height:1.6;">
              Votre compte Hashirama a &eacute;t&eacute; cr&eacute;&eacute;. Voici vos identifiants de connexion&nbsp;:
            </p>

            <!-- Credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(170,120,25,0.06);border:1px solid rgba(170,120,25,0.15);margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="margin-bottom:14px;">
                    <div style="font-size:10px;color:rgba(255,255,255,0.40);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">
                      Identifiant
                    </div>
                    <div style="font-family:'Courier New',monospace;font-size:15px;color:#c8a020;">
                      ${email}
                    </div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.40);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">
                      Mot de passe
                    </div>
                    <div style="font-family:'Courier New',monospace;font-size:15px;color:#c8a020;">
                      ${password}
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            <p style="color:rgba(255,255,255,0.50);font-size:12px;margin:0 0 8px;line-height:1.6;">
              Nous vous recommandons de changer votre mot de passe lors de votre premi&egrave;re connexion.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;text-align:center;border-top:1px solid rgba(170,120,25,0.08);">
            <div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:1px;">
              &copy; Hashirama &mdash; Cet email a &eacute;t&eacute; envoy&eacute; automatiquement.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
