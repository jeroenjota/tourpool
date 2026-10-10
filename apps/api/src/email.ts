import nodemailer from 'nodemailer';
import { HttpError } from './auth.js';

interface RegistrationDetails {
  username: string;
  email: string;
  fullName: string;
}

const requiredSetting = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(503, `E-mail is niet geconfigureerd (${name}).`);
  return value;
};

function createTransport() {
  const host = requiredSetting('SMTP_HOST');
  const user = requiredSetting('SMTP_USER');
  const password = requiredSetting('SMTP_PASSWORD');
  const port = Number(requiredSetting('SMTP_PORT'));
  const secureValue = requiredSetting('SMTP_SECURE').toLowerCase();
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(503, 'SMTP_PORT moet een poortnummer zijn tussen 1 en 65535.');
  }
  if (secureValue !== 'true' && secureValue !== 'false') {
    throw new HttpError(503, 'SMTP_SECURE moet true of false zijn.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: secureValue === 'true',
    auth: { user, pass: password }
  });
}

const fromAddress = () => process.env.SMTP_FROM?.trim() || requiredSetting('SMTP_USER');

export function smtpFailureMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
  const responseCode = error && typeof error === 'object' && 'responseCode' in error &&
    typeof error.responseCode === 'number'
    ? error.responseCode
    : undefined;

  if (code === 'EAUTH' || responseCode === 535) {
    return 'De SMTP-server weigert de aanmeldgegevens. Controleer SMTP_USER en SMTP_PASSWORD en of SMTP-toegang voor dit account is toegestaan.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'De SMTP-host kon niet worden gevonden. Controleer SMTP_HOST en de DNS-configuratie van de server.';
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(code)) {
    return 'De API kan geen verbinding maken met de SMTP-server. Controleer SMTP_HOST, SMTP_PORT, SMTP_SECURE en of uitgaand SMTP-verkeer is toegestaan.';
  }
  if (code === 'ETLS') {
    return 'De TLS-verbinding met de SMTP-server is mislukt. Controleer SMTP_PORT en SMTP_SECURE (poort 465: true; poort 587: false).';
  }
  if (code === 'EENVELOPE' || code === 'EMESSAGE') {
    return 'De SMTP-server heeft de afzender of ontvanger geweigerd. Controleer SMTP_FROM en CONTACT_RECEIVER.';
  }
  return `De SMTP-server kon de testmail niet versturen${code !== 'UNKNOWN' ? ` (${code})` : ''}. Controleer de API-log voor details.`;
}

const verificationLink = (token: string) => {
  const apiUrl = requiredSetting('PUBLIC_API_URL').replace(/\/+$/, '');
  let link: URL;
  try {
    link = new URL(`${apiUrl}/auth/verify-email`);
  } catch {
    throw new HttpError(503, 'PUBLIC_API_URL moet een geldige URL zijn.');
  }
  if (process.env.NODE_ENV === 'production' && link.protocol !== 'https:') {
    throw new HttpError(503, 'PUBLIC_API_URL moet in productie HTTPS gebruiken.');
  }
  link.searchParams.set('token', token);
  return link.toString();
};

// The participant app handles ?reset=TOKEN; defaults to /deelnemen/ next to the API in production.
const passwordResetLink = (token: string) => {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  const fallback = process.env.NODE_ENV === 'production'
    ? requiredSetting('PUBLIC_API_URL').replace(/\/+$/, '').replace(/\/api$/, '/deelnemen/')
    : 'http://localhost:5174/';
  let link: URL;
  try {
    link = new URL(configured || fallback);
  } catch {
    throw new HttpError(503, 'PUBLIC_APP_URL moet een geldige URL zijn.');
  }
  if (process.env.NODE_ENV === 'production' && link.protocol !== 'https:') {
    throw new HttpError(503, 'PUBLIC_APP_URL moet in productie HTTPS gebruiken.');
  }
  link.searchParams.set('reset', token);
  return link.toString();
};

export const emailService = {
  async sendPasswordReset(email: string, token: string) {
    const link = passwordResetLink(token);
    await createTransport().sendMail({
      from: fromAddress(),
      to: email,
      subject: 'Nieuw wachtwoord voor je Tourpool-account',
      text: `Er is een nieuw wachtwoord aangevraagd voor je Tourpool-account. Kies een nieuw wachtwoord via deze link:\n${link}\n\nDe link is 1 uur geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.`,
      html: `<p>Er is een nieuw wachtwoord aangevraagd voor je Tourpool-account.</p><p><a href="${escapeHtml(link)}">Nieuw wachtwoord kiezen</a></p><p>De link is 1 uur geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>`
    });
  },

  async sendVerification(email: string, token: string) {
    const link = verificationLink(token);
    await createTransport().sendMail({
      from: fromAddress(),
      to: email,
      subject: 'Bevestig je Tourpool-account',
      text: `Bevestig je e-mailadres via deze link:\n${link}\n\nDe link is 24 uur geldig.`,
      html: `<p>Bevestig je e-mailadres via deze link:</p><p><a href="${link}">E-mailadres bevestigen</a></p><p>De link is 24 uur geldig.</p>`
    });
  },

  async sendRegistrationNotice(details: RegistrationDetails) {
    const receiver = requiredSetting('CONTACT_RECEIVER');
    await createTransport().sendMail({
      from: fromAddress(),
      to: receiver,
      subject: 'Nieuwe Tourpool-registratie',
      text: `Er is een nieuw account geregistreerd.\nGebruikersnaam: ${details.username}\nE-mailadres: ${details.email}\nNaam: ${details.fullName}`,
      html: `<p>Er is een nieuw account geregistreerd.</p><ul><li>Gebruikersnaam: ${escapeHtml(details.username)}</li><li>E-mailadres: ${escapeHtml(details.email)}</li><li>Naam: ${escapeHtml(details.fullName)}</li></ul>`
    });
  },

  async sendTestEmail() {
    const receiver = requiredSetting('CONTACT_RECEIVER');
    try {
      await createTransport().sendMail({
        from: fromAddress(),
        to: receiver,
        subject: 'Tourpool - test e-mail',
        text: 'Dit is een testbericht vanuit de Tourpool-adminmodule. De SMTP-configuratie werkt.',
        html: '<p>Dit is een testbericht vanuit de Tourpool-adminmodule.</p><p>De SMTP-configuratie werkt.</p>'
      });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'UNKNOWN';
      const responseCode = error && typeof error === 'object' && 'responseCode' in error &&
        typeof error.responseCode === 'number'
        ? error.responseCode
        : undefined;
      console.error('Test email delivery failed:', { code, responseCode });
      throw new HttpError(502, smtpFailureMessage(error));
    }
  }
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]!);
}
