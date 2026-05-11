/**
 * webhooks/whatsapp.ts — Webhook receptor de mensajes de WhatsApp vía Twilio.
 *
 * Twilio envía un POST a esta ruta cada vez que llega un mensaje.
 * El endpoint responde con TwiML vacío (200 OK) y procesa en background,
 * luego envía la respuesta usando la REST API de Twilio (no TwiML reply).
 *
 * Flujo:
 *   1. Recibir POST de Twilio (texto o audio)
 *   2. Validar firma (solo en producción)
 *   3. Si es audio: descargar → transcribir con Deepgram → procesar texto
 *   4. Si es texto: procesar directamente
 *   5. Enviar respuesta por WhatsApp vía sendWhatsAppText
 */

import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { assistantAgent } from '../../agents/agent-assistant';
import { sendWhatsAppText } from '../../services/messaging';
import { prisma } from '../../lib/prisma';

export const whatsappWebhookRouter = Router();

// ─── Validación de firma Twilio (seguridad en producción) ────────────────────

function validateTwilioSignature(req: Request): boolean {
  // En desarrollo local (ngrok) la validación se salta para facilitar pruebas
  if (process.env.NODE_ENV === 'development') return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature  = req.headers['x-twilio-signature'] as string ?? '';
  const url        = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params     = req.body as Record<string, string>;

  return twilio.validateRequest(authToken, signature, url, params);
}

// ─── Descargar audio de Twilio ───────────────────────────────────────────────

async function downloadTwilioMedia(mediaUrl: string): Promise<Buffer> {
  const sid   = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';

  // Twilio requiere autenticación básica para descargar media
  const credentials = Buffer.from(`${sid}:${token}`).toString('base64');
  const response    = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!response.ok) {
    throw new Error(`Error descargando media de Twilio: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Responder con TwiML vacío inmediatamente ────────────────────────────────

function respondEmpty(res: Response): void {
  res.set('Content-Type', 'text/xml');
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

// ─── Handler principal ───────────────────────────────────────────────────────

whatsappWebhookRouter.post('/', async (req: Request, res: Response) => {
  console.log('🔔 WEBHOOK RECIBIDO:', new Date().toISOString(), req.body);

  // Validar firma — rechazar si no es legítimo
  if (!validateTwilioSignature(req)) {
    console.warn('[webhook] Firma Twilio inválida — rechazando');
    res.status(403).send('Forbidden');
    return;
  }

  // Twilio envía los campos como strings en el body
  const body    = req.body as Record<string, string>;
  const from    = body.From ?? '';      // whatsapp:+573001234567
  const msgBody = body.Body ?? '';      // texto del mensaje
  const numMedia = parseInt(body.NumMedia ?? '0', 10);

  // Extraer número limpio: whatsapp:+573001234567 → +573001234567
  const phone = from.replace(/^whatsapp:/, '');

  console.log(`[webhook] Mensaje de ${phone} | texto: "${msgBody.slice(0, 60)}" | media: ${numMedia}`);

  // Responder inmediatamente a Twilio (timeout 15s)
  respondEmpty(res);

  // Procesar en background (no bloquear la respuesta HTTP)
  setImmediate(async () => {
    try {
      let agentResponse: string;

      // ── Mensaje con audio ────────────────────────────────────────────────────
      if (numMedia > 0 && body.MediaContentType0?.startsWith('audio/')) {
        const mediaUrl  = body.MediaUrl0 ?? '';
        const mimeType  = body.MediaContentType0 ?? 'audio/ogg';

        try {
          const audioBuffer = await downloadTwilioMedia(mediaUrl);
          agentResponse = await assistantAgent.processVoiceMessage(phone, audioBuffer, mimeType);
        } catch (err) {
          console.error('[webhook] Error procesando audio:', err);
          agentResponse = 'Recibí tu nota de voz pero hubo un problema al procesarla. ¿Puedes escribirme?';
        }
      }
      // ── Mensaje con imagen u otro media ─────────────────────────────────────
      else if (numMedia > 0) {
        agentResponse = await assistantAgent.processMessage(
          phone,
          msgBody || `[El cliente envió una imagen o archivo adjunto]`,
        );
      }
      // ── Mensaje de texto ─────────────────────────────────────────────────────
      else {
        if (!msgBody.trim()) {
          console.log('[webhook] Mensaje vacío ignorado');
          return;
        }

        // ── Pre-filtro: interceptar respuestas al recordatorio de cita ────────
        // Se resuelven directamente en BD sin pasar por el agente IA,
        // evitando que el historial en memoria confunda el contexto.
        const confirmKeywords    = ['confirmo', 'confirmar', 'confirma', 'si confirmo', 'sí confirmo'];
        const rescheduleKeywords = ['reagendo', 'reagendar', 'cambiar cita', 'reprogramar'];
        const cancelKeywords     = ['cancelo', 'cancelar', 'no puedo', 'no voy'];

        const msgLower    = msgBody.toLowerCase().trim();
        const isConfirm   = confirmKeywords.some(k => msgLower.includes(k));
        const isReschedule = rescheduleKeywords.some(k => msgLower.includes(k));
        const isCancel    = cancelKeywords.some(k => msgLower.includes(k));

        if (isConfirm || isReschedule || isCancel) {
          // Buscar la cita pendiente más próxima del número entrante
          const phoneDigits = phone.replace(/\D/g, '').slice(-10);

          const appointment = await prisma.appointment.findFirst({
            where: {
              status: { in: ['PENDIENTE', 'REAGENDADA'] },
              reminder24hSent: true,   // solo citas que recibieron el recordatorio
              client: { phone: { contains: phoneDigits } },
              scheduledAt: { gte: new Date() },
            },
            include: {
              client:   { select: { name: true } },
              property: { select: { title: true } },
              agent:    { select: { name: true, phone: true } },
            },
            orderBy: { scheduledAt: 'asc' },
          });

          const fmtFecha = (d: Date) =>
            d.toLocaleDateString('es-CO', {
              timeZone: 'America/Bogota',
              weekday: 'long', day: 'numeric', month: 'long',
            });
          const fmtHora = (d: Date) =>
            d.toLocaleTimeString('es-CO', {
              timeZone: 'America/Bogota',
              hour: '2-digit', minute: '2-digit',
            });

          if (appointment) {
            if (isConfirm) {
              await prisma.appointment.update({
                where: { id: appointment.id },
                data:  { status: 'CONFIRMADA', confirmationSent: true },
              });

              if (appointment.agent?.phone) {
                await sendWhatsAppText(
                  appointment.agent.phone,
                  `✅ Cita confirmada\n\nCliente: ${appointment.client.name}\n` +
                  `Inmueble: ${appointment.property.title}\n` +
                  `Fecha: ${fmtFecha(appointment.scheduledAt)}\n` +
                  `Hora: ${fmtHora(appointment.scheduledAt)}`,
                );
              }

              await sendWhatsAppText(
                phone,
                `✅ ¡Perfecto ${appointment.client.name}! Tu visita al ${appointment.property.title} quedó confirmada.\n\n` +
                `📅 ${fmtFecha(appointment.scheduledAt)}\n` +
                `🕐 ${fmtHora(appointment.scheduledAt)}\n\n` +
                `¡Te esperamos! 😊`,
              );

              console.log(`✅ [webhook] Cita ${appointment.id} confirmada directamente para ${appointment.client.name}`);
              return;
            }

            if (isCancel) {
              await prisma.appointment.update({
                where: { id: appointment.id },
                data:  { status: 'CANCELADA', cancellationReason: 'Cancelada por el cliente via WhatsApp' },
              });

              await sendWhatsAppText(
                phone,
                `Entendido ${appointment.client.name}, cancelamos tu visita al ${appointment.property.title}. ` +
                `Si deseas reprogramarla en el futuro, escríbenos. ¡Hasta pronto! 😊`,
              );

              if (appointment.agent?.phone) {
                await sendWhatsAppText(
                  appointment.agent.phone,
                  `❌ Cita cancelada\n\nCliente: ${appointment.client.name}\n` +
                  `Inmueble: ${appointment.property.title}`,
                );
              }

              console.log(`❌ [webhook] Cita ${appointment.id} cancelada para ${appointment.client.name}`);
              return;
            }

            if (isReschedule) {
              await prisma.appointment.update({
                where: { id: appointment.id },
                data:  { status: 'REAGENDADA' },
              });

              await sendWhatsAppText(
                phone,
                `Entendido ${appointment.client.name}, quieres reagendar tu visita al ${appointment.property.title}.\n\n` +
                `¿Para qué fecha y hora te quedaría mejor?`,
              );

              console.log(`📅 [webhook] Reagendamiento iniciado para ${appointment.client.name}`);
              return;
            }
          } else {
            // Keyword detectada pero sin cita pendiente — respuesta directa sin agente
            await sendWhatsAppText(
              phone,
              `Hola! No encontré citas pendientes a tu nombre. ¿En qué puedo ayudarte?`,
            );
            console.log(`[webhook] Keyword de cita detectada pero sin cita pendiente para ${phone}`);
            return;
          }
        }

        // Sin keyword de cita o no interceptado — pasar al agente normalmente
        agentResponse = await assistantAgent.processMessage(phone, msgBody);
      }

      // Enviar respuesta al cliente
      await sendWhatsAppText(phone, agentResponse);

    } catch (err) {
      console.error('[webhook] Error inesperado procesando mensaje:', err);
      try {
        await sendWhatsAppText(
          phone,
          'Lo siento, tuve un inconveniente técnico. Por favor escríbeme de nuevo en un momento.',
        );
      } catch (sendErr) {
        console.error('[webhook] Error enviando mensaje de error:', sendErr);
      }
    }
  });
});

// ─── Endpoint de status (para verificar que el webhook está activo) ──────────

whatsappWebhookRouter.get('/status', (_req, res) => {
  res.json({
    status:          'ok',
    agent:           'Sofía',
    activeSessions:  assistantAgent.activeSessionCount,
    timestamp:       new Date().toISOString(),
  });
});
