/**
 * messaging.ts — Servicio de comunicaciones salientes.
 * Cubre WhatsApp (Twilio) y email (Resend) para el agente Sofía.
 */

import twilio from 'twilio';
import { Resend } from 'resend';

// ─── Clientes (inicialización lazy para no crashear si faltan vars en pruebas) ──

function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no configuradas');
  return twilio(sid, token);
}

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY no configurada');
  return new Resend(key);
}

function getWhatsAppFrom(): string {
  const num = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!num) throw new Error('TWILIO_WHATSAPP_NUMBER no configurada');
  // Aseguramos formato whatsapp:+XXXXXXXXXXX
  return num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;
}

// ─── formatWhatsAppNumber ─────────────────────────────────────────────────────

/**
 * Normaliza cualquier formato de teléfono colombiano a whatsapp:+57XXXXXXXXXX.
 *
 * Acepta:
 *   3001234567          → whatsapp:+573001234567
 *   +573001234567       → whatsapp:+573001234567
 *   573001234567        → whatsapp:+573001234567
 *   57 300 123 4567     → whatsapp:+573001234567
 *   (300) 123-4567      → whatsapp:+573001234567
 */
export function formatWhatsAppNumber(phone: string): string {
  // Eliminar todo lo que no sea dígito o el + inicial
  const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  let normalized: string;

  if (digits.startsWith('57') && digits.length === 12) {
    // 573001234567 → ya tiene indicativo
    normalized = `+${digits}`;
  } else if (digits.startsWith('3') && digits.length === 10) {
    // 3001234567 → número colombiano sin indicativo
    normalized = `+57${digits}`;
  } else if (digits.startsWith('0057')) {
    // 00573001234567 → formato internacional con 00
    normalized = `+${digits.slice(2)}`;
  } else {
    // Fallback: asumir que ya viene bien formado con +
    normalized = phone.trim().startsWith('+') ? phone.trim() : `+${digits}`;
  }

  return `whatsapp:${normalized}`;
}

// ─── sendWhatsAppText ─────────────────────────────────────────────────────────

/**
 * Envía mensaje de texto por WhatsApp.
 * @param to  Número en formato +57XXXXXXXXXX (se convierte internamente)
 * @param body Cuerpo del mensaje
 */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const client   = getTwilioClient();
  const from     = getWhatsAppFrom();
  const toFormatted = formatWhatsAppNumber(to);

  const message = await client.messages.create({
    from,
    to: toFormatted,
    body,
  });

  console.log(`[messaging] WhatsApp enviado a ${toFormatted} | SID: ${message.sid} | ${new Date().toISOString()}`);
}

// ─── sendWhatsAppMedia ────────────────────────────────────────────────────────

/**
 * Envía mensaje con imagen adjunta por WhatsApp.
 * @param mediaUrl URL pública accesible (Cloudinary, S3, etc.)
 */
export async function sendWhatsAppMedia(
  to: string,
  body: string,
  mediaUrl: string,
): Promise<void> {
  const client      = getTwilioClient();
  const from        = getWhatsAppFrom();
  const toFormatted = formatWhatsAppNumber(to);

  try {
    const message = await client.messages.create({
      from,
      to: toFormatted,
      body,
      mediaUrl: [mediaUrl],
    });
    console.log(`[messaging] WhatsApp+media enviado a ${toFormatted} | SID: ${message.sid} | ${new Date().toISOString()}`);
  } catch (mediaErr) {
    // Si Twilio rechaza la URL del media, enviar solo el texto con el enlace
    console.error(`[messaging] Twilio rechazó mediaUrl "${mediaUrl}" — enviando enlace en texto:`, mediaErr);
    const fallbackBody = body
      ? `${body}\n\n🔗 Ver foto: ${mediaUrl}`
      : `🔗 Ver foto: ${mediaUrl}`;
    const fallback = await client.messages.create({
      from,
      to: toFormatted,
      body: fallbackBody,
    });
    console.log(`[messaging] Fallback texto enviado a ${toFormatted} | SID: ${fallback.sid}`);
  }
}

// ─── sendWhatsAppTemplate ─────────────────────────────────────────────────────

/**
 * Envía mensaje reemplazando variables {{nombre}}, {{inmueble}}, etc.
 * @param template Texto con placeholders: "Hola {{nombre}}, tu cita es el {{fecha}}"
 * @param variables { nombre: 'María', fecha: '15 de mayo' }
 */
export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  variables: Record<string, string>,
): Promise<void> {
  // Reemplazar todos los {{key}} por su valor
  const body = template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
  await sendWhatsAppText(to, body);
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

/**
 * Envía email transaccional usando Resend.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resend = getResendClient();
  const from   = process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM no configurada');

  const { data, error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    throw new Error(`Resend error: ${(error as any).message ?? JSON.stringify(error)}`);
  }

  console.log(`[messaging] Email enviado a ${to} | ID: ${(data as any)?.id} | ${new Date().toISOString()}`);
}
