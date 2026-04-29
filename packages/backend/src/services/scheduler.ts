/**
 * scheduler.ts — Tareas programadas del sistema inmobiliario.
 *
 * Jobs definidos:
 *  1. markOverduePayments  — diario a las 07:50 AM
 *     Marca como VENCIDO toda cuota PENDIENTE cuya dueDate ya pasó.
 *
 *  2. alertExpiringContracts — diario a las 08:00 AM
 *     Detecta contratos de arriendo activos que vencen en ≤15 semanas
 *     y envía un email de alerta al agente asignado.
 *     Usa lastAlertSentAt para no repetir la alerta el mismo día.
 *
 * Inicializar con initScheduler() en src/index.ts.
 */

import cron from 'node-cron';
import { Prisma, PaymentStatus, RentalContractStatus } from '../lib/generated/prisma';
import { prisma } from '../lib/prisma';
import { sendEmail } from './messaging';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Semanas de anticipación para alertar sobre vencimiento de contrato */
const ALERT_WEEKS = 15;

/** Días de aviso antes del vencimiento donde la alerta se considera "urgente" */
const URGENT_DAYS = 30;

// ─── Job 1: Marcar cuotas vencidas ───────────────────────────────────────────

/**
 * Marca como VENCIDO todas las cuotas PENDIENTE cuya fecha de vencimiento
 * ya pasó. Se ejecuta a las 07:50 AM para que cuando lleguen las alertas
 * de contratos (08:00 AM) el estado de pagos esté al día.
 */
async function markOverduePayments(): Promise<void> {
  const now = new Date();

  try {
    const result = await prisma.rentalPayment.updateMany({
      where: {
        status:  PaymentStatus.PENDIENTE,
        dueDate: { lt: now },
      },
      data: { status: PaymentStatus.VENCIDO },
    });

    if (result.count > 0) {
      console.log(
        `[scheduler] markOverduePayments — ${result.count} cuota(s) marcada(s) como VENCIDO | ${now.toISOString()}`,
      );
    }
  } catch (err) {
    console.error('[scheduler] Error en markOverduePayments:', err);
  }
}

// ─── Job 2: Alertas de contratos por vencer ──────────────────────────────────

/**
 * Construye el HTML del email de alerta con los datos del contrato.
 * Lenguaje simple — destinatario es el agente inmobiliario, no un técnico.
 */
function buildAlertEmail(contract: {
  id:          string;
  endDate:     Date;
  daysLeft:    number;
  monthlyRent: Prisma.Decimal;
  rentCurrency: string;
  property: { title: string; address: string; city: string };
  client:   { name: string; phone: string | null; email: string | null };
  agent:    { name: string };
}): { subject: string; html: string } {
  const { property, client, daysLeft, endDate } = contract;

  const esUrgente    = daysLeft <= URGENT_DAYS;
  const fechaFin     = endDate.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const urgenciaTag  = esUrgente ? '🔴 URGENTE — ' : '⚠️ ';
  const subject      = `${urgenciaTag}Contrato por vencer en ${daysLeft} día(s) — ${property.title}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background: ${esUrgente ? '#dc2626' : '#f59e0b'}; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">
          ${esUrgente ? '🔴 Contrato URGENTE por vencer' : '⚠️ Contrato próximo a vencer'}
        </h2>
      </div>

      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; font-size: 15px;">
          Hola <strong>${contract.agent.name}</strong>, te informamos que el siguiente contrato de arriendo
          vence en <strong>${daysLeft} día(s)</strong> (el ${fechaFin}).
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background: #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: bold; width: 40%;">Inmueble</td>
            <td style="padding: 8px 12px;">${property.title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; background: #f1f5f9;">Dirección</td>
            <td style="padding: 8px 12px; background: #f1f5f9;">${property.address}, ${property.city}</td>
          </tr>
          <tr style="background: #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: bold;">Arrendatario</td>
            <td style="padding: 8px 12px;">${client.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; background: #f1f5f9;">Teléfono</td>
            <td style="padding: 8px 12px; background: #f1f5f9;">${client.phone ?? 'No registrado'}</td>
          </tr>
          <tr style="background: #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: bold;">Canon mensual</td>
            <td style="padding: 8px 12px;">
              ${Number(contract.monthlyRent).toLocaleString('es-CO')} ${contract.rentCurrency}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; background: #f1f5f9;">Fecha de vencimiento</td>
            <td style="padding: 8px 12px; background: #f1f5f9;">${fechaFin}</td>
          </tr>
        </table>

        <div style="background: ${esUrgente ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${esUrgente ? '#dc2626' : '#f59e0b'}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px;">
            ${esUrgente
              ? '⚠️ El contrato vence en menos de 30 días. Contacta al arrendatario a la brevedad para confirmar renovación o desocupación.'
              : 'Tienes tiempo suficiente para gestionar la renovación. Te recomendamos contactar al arrendatario pronto.'}
          </p>
        </div>

        <p style="margin: 0; font-size: 13px; color: #64748b;">
          Puedes renovar el contrato directamente desde el panel de administración en la sección
          <strong>Contratos → Arriendos</strong>.
        </p>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
        Este es un mensaje automático del sistema. ID de contrato: ${contract.id}
      </p>
    </div>
  `;

  return { subject, html };
}

/**
 * Busca contratos activos próximos a vencer y envía alertas por email
 * al agente asignado. Evita duplicados con lastAlertSentAt.
 */
async function alertExpiringContracts(): Promise<void> {
  const now     = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + ALERT_WEEKS * 7);

  // Inicio del día actual (para comparar lastAlertSentAt)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const contracts = await prisma.rentalContract.findMany({
      where: {
        status:  RentalContractStatus.ACTIVO,
        endDate: { lte: horizon, gte: now },
        // Solo alertar si no se envió alerta hoy (o nunca se ha enviado)
        OR: [
          { lastAlertSentAt: null },
          { lastAlertSentAt: { lt: startOfToday } },
        ],
      },
      include: {
        property: { select: { title: true, address: true, city: true } },
        client:   { select: { name: true, phone: true, email: true } },
        agent:    { select: { name: true, email: true } },
      },
    });

    if (contracts.length === 0) {
      console.log(`[scheduler] alertExpiringContracts — sin contratos por alertar | ${now.toISOString()}`);
      return;
    }

    console.log(`[scheduler] alertExpiringContracts — procesando ${contracts.length} contrato(s) | ${now.toISOString()}`);

    for (const contract of contracts) {
      const daysLeft = Math.ceil(
        (contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      try {
        const { subject, html } = buildAlertEmail({ ...contract, daysLeft });

        await sendEmail(contract.agent.email, subject, html);

        // Registrar que se envió la alerta hoy
        await prisma.rentalContract.update({
          where: { id: contract.id },
          data:  { lastAlertSentAt: now },
        });

        console.log(
          `[scheduler] Alerta enviada — contrato ${contract.id} | agente: ${contract.agent.email} | vence en ${daysLeft} día(s)`,
        );
      } catch (emailErr) {
        // Error por contrato — loguear sin detener los demás
        console.error(
          `[scheduler] Error enviando alerta para contrato ${contract.id}:`,
          emailErr,
        );
      }
    }
  } catch (err) {
    console.error('[scheduler] Error en alertExpiringContracts:', err);
  }
}

// ─── initScheduler ────────────────────────────────────────────────────────────

/**
 * Registra todos los jobs del scheduler.
 * Llamar una sola vez desde index.ts al arrancar el servidor.
 *
 * Zona horaria: America/Bogota (UTC-5, Colombia).
 */
export function initScheduler(): void {
  // Job 1 — 07:50 AM Colombia: marcar cuotas vencidas ANTES de enviar alertas
  cron.schedule('50 7 * * *', markOverduePayments, {
    timezone: 'America/Bogota',
  });

  // Job 2 — 08:00 AM Colombia: alertas de contratos próximos a vencer
  cron.schedule('0 8 * * *', alertExpiringContracts, {
    timezone: 'America/Bogota',
  });

  console.log('[scheduler] Jobs registrados — markOverduePayments (07:50) y alertExpiringContracts (08:00) America/Bogota');
}

// ─── Exportar jobs para pruebas manuales ─────────────────────────────────────
// Permite invocarlos desde el panel de admin o en pruebas sin esperar el cron.

export { markOverduePayments, alertExpiringContracts };
