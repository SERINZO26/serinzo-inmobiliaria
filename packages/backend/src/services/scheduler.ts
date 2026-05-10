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
import { Prisma, PaymentStatus, RentalContractStatus, LogStatus, Role, UserStatus, AppointmentStatus } from '../lib/generated/prisma';
import { prisma } from '../lib/prisma';
import { sendEmail, sendWhatsAppText } from './messaging';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Semanas de anticipación para alertar sobre vencimiento de contrato */
const ALERT_WEEKS = 16;

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

// ─── Job 3: Recordatorio de pagos pendientes (lunes 8am) ─────────────────────

/**
 * Construye el HTML del email de recordatorio de pagos próximos.
 */
function buildPendingPaymentsEmail(
  recipientName: string,
  payments: Array<{
    periodNumber: number;
    dueDate:      Date;
    amount:       Prisma.Decimal;
    contract: {
      property: { title: string; address: string; city: string };
      client:   { name: string };
    };
  }>,
): { subject: string; html: string } {
  const count   = payments.length;
  const subject = `⚠️ ${count} pago${count !== 1 ? 's' : ''} de arriendo vence${count === 1 ? 'n' : ''} esta semana`;

  const rows = payments
    .map((p) => {
      const fecha = p.dueDate.toLocaleDateString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'long',
      });
      const vence = new Date(p.dueDate).getTime() < Date.now() ? '🔴 Vencido' : '🟠 Próximo';
      return `
        <tr style="background: #f8fafc;">
          <td style="padding: 8px 12px;">${p.contract.property.title}</td>
          <td style="padding: 8px 12px;">${p.contract.client.name}</td>
          <td style="padding: 8px 12px;">Cuota #${p.periodNumber}</td>
          <td style="padding: 8px 12px;">${fecha}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold;">
            $${Number(p.amount).toLocaleString('es-CO')} COP
          </td>
          <td style="padding: 8px 12px;">${vence}</td>
        </tr>`;
    })
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
      <div style="background: #f59e0b; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">
          ⚠️ Recordatorio semanal — Pagos próximos a vencer
        </h2>
      </div>
      <div style="padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px;">
          Hola <strong>${recipientName}</strong>, este es tu recordatorio de pagos de arriendo
          que vencen en los próximos 7 días:
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #e2e8f0;">
              <th style="padding: 8px 12px; text-align: left;">Inmueble</th>
              <th style="padding: 8px 12px; text-align: left;">Arrendatario</th>
              <th style="padding: 8px 12px; text-align: left;">Período</th>
              <th style="padding: 8px 12px; text-align: left;">Vencimiento</th>
              <th style="padding: 8px 12px; text-align: right;">Valor</th>
              <th style="padding: 8px 12px; text-align: left;">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin: 20px 0 0; font-size: 13px; color: #64748b;">
          Registra los pagos desde el panel en <strong>Contratos → Arriendos</strong>.
        </p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
        Mensaje automático del sistema — ${new Date().toLocaleDateString('es-CO')}
      </p>
    </div>`;

  return { subject, html };
}

/**
 * Busca cuotas PENDIENTE que vencen en los próximos 7 días,
 * agrupa por agente y envía email + WhatsApp a cada agente y a todos los admins.
 * Registra el resultado en AgentLog.
 */
async function remindPendingPayments(): Promise<void> {
  const now     = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);

  try {
    const payments = await prisma.rentalPayment.findMany({
      where: {
        status:  PaymentStatus.PENDIENTE,
        dueDate: { gte: now, lte: horizon },
        contract: { status: RentalContractStatus.ACTIVO },
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true, address: true, city: true } },
            client:   { select: { name: true } },
            agent:    { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (payments.length === 0) {
      console.log(`[scheduler] remindPendingPayments — sin pagos próximos | ${now.toISOString()}`);
      await prisma.agentLog.create({
        data: {
          agentName: 'scheduler',
          action:    'recordatorio_pagos_pendientes',
          input:     { horizon: horizon.toISOString() },
          output:    { paymentsCount: 0, sentOk: 0, sentError: 0 },
          status:    LogStatus.OK,
        },
      });
      return;
    }

    // Agrupar cuotas por agente
    const byAgent = new Map<string, typeof payments>();
    for (const p of payments) {
      const agentId = p.contract.agent.id;
      if (!byAgent.has(agentId)) byAgent.set(agentId, []);
      byAgent.get(agentId)!.push(p);
    }

    // Admins para notificación cruzada
    const admins = await prisma.user.findMany({
      where:  { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { name: true, email: true, phone: true },
    });

    let sentOk = 0;
    let sentError = 0;

    for (const [, agentPayments] of byAgent) {
      const agent = agentPayments[0].contract.agent;
      const { subject, html } = buildPendingPaymentsEmail(agent.name, agentPayments);

      // Texto corto para WhatsApp
      const waTxt =
        `⚠️ Recordatorio: tienes ${agentPayments.length} pago(s) de arriendo que vence(n) esta semana.\n` +
        agentPayments
          .map(
            (p) =>
              `• ${p.contract.property.title} — ${p.dueDate.toLocaleDateString('es-CO')} — $${Number(p.amount).toLocaleString('es-CO')} COP`,
          )
          .join('\n') +
        '\n\nRevisa el panel para registrar los pagos.';

      // Destinatarios: agente propio + admins (sin duplicar si el agente es también admin)
      const recipients = [
        { name: agent.name, email: agent.email, phone: agent.phone },
        ...admins.filter((a) => a.email !== agent.email),
      ];

      for (const recipient of recipients) {
        try {
          await sendEmail(recipient.email, subject, html);
          if (recipient.phone) {
            await sendWhatsAppText(recipient.phone, waTxt);
          } else {
            console.warn(
              `[scheduler] remindPendingPayments — ${recipient.name} sin teléfono, solo email`,
            );
          }
          sentOk++;
        } catch (err) {
          console.error(
            `[scheduler] Error enviando recordatorio de pagos a ${recipient.email}:`,
            err,
          );
          sentError++;
        }
      }
    }

    await prisma.agentLog.create({
      data: {
        agentName:         'scheduler',
        action:            'recordatorio_pagos_pendientes',
        input:             { paymentsCount: payments.length, horizon: horizon.toISOString() },
        output:            { sentOk, sentError, agentCount: byAgent.size },
        status:            sentError === 0 ? LogStatus.OK : LogStatus.ERROR,
        relatedEntityType: 'RentalPayment',
      },
    });

    console.log(
      `[scheduler] remindPendingPayments — ${payments.length} cuota(s) | enviados OK: ${sentOk} | errores: ${sentError} | ${now.toISOString()}`,
    );
  } catch (err) {
    console.error('[scheduler] Error en remindPendingPayments:', err);
    await prisma.agentLog
      .create({
        data: {
          agentName:    'scheduler',
          action:       'recordatorio_pagos_pendientes',
          input:        {},
          output:       {},
          status:       LogStatus.ERROR,
          errorMessage: String(err),
        },
      })
      .catch(() => {});
  }
}

// ─── Job 5: Recordatorio de citas 24h antes ──────────────────────────────────

/**
 * Formatea una fecha en zona horaria Colombia para los mensajes de recordatorio.
 * Ej: "martes 14 de mayo de 2026"
 */
function formatFechaColombia(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formatea la hora en zona horaria Colombia.
 * Ej: "10:00 a. m."
 */
function formatHoraColombia(date: Date): string {
  return date.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Construye el mensaje de recordatorio interactivo para WhatsApp.
 * Incluye opciones de respuesta: CONFIRMO / REAGENDO / CANCELO.
 */
function buildReminderMessage(data: {
  clientName:   string;
  propertyTitle: string;
  scheduledAt:  Date;
  agentName:    string;
}): string {
  const fecha = formatFechaColombia(data.scheduledAt);
  const hora  = formatHoraColombia(data.scheduledAt);

  return (
    `Hola ${data.clientName} 👋\n\n` +
    `Te recordamos tu visita programada para mañana:\n\n` +
    `🏠 *${data.propertyTitle}*\n` +
    `📅 ${fecha}\n` +
    `🕐 ${hora}\n` +
    `👤 Agente: ${data.agentName}\n\n` +
    `¿Puedes confirmar tu asistencia?\n` +
    `Responde con una de estas opciones:\n\n` +
    `✅ *CONFIRMO* — para confirmar tu visita\n` +
    `📅 *REAGENDO* — si necesitas cambiar la fecha\n` +
    `❌ *CANCELO* — si no puedes asistir\n\n` +
    `¡Te esperamos!`
  );
}

/**
 * Envía el recordatorio de una cita específica por su ID.
 * Exportado para el endpoint de prueba `/debug/send-reminder/:id`.
 */
export async function sendAppointmentReminderById(appointmentId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client:   { select: { name: true, phone: true } },
      property: { select: { title: true } },
      agent:    { select: { name: true } },
    },
  });

  if (!appointment) return { success: false, message: 'Cita no encontrada' };
  if (!appointment.client.phone) return { success: false, message: 'El cliente no tiene teléfono registrado' };

  const mensaje = buildReminderMessage({
    clientName:    appointment.client.name,
    propertyTitle: appointment.property.title,
    scheduledAt:   appointment.scheduledAt,
    agentName:     appointment.agent.name,
  });

  await sendWhatsAppText(appointment.client.phone, mensaje);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { reminder24hSent: true },
  });

  console.log(`[scheduler] Recordatorio 24h enviado a ${appointment.client.name} (${appointment.client.phone})`);
  return { success: true, message: `Recordatorio enviado a ${appointment.client.name}` };
}

/**
 * Busca citas que ocurren en las próximas 23–25 horas con reminder24hSent=false
 * y envía el recordatorio interactivo al cliente por WhatsApp.
 * Se ejecuta cada hora.
 */
async function sendAppointmentReminders(): Promise<void> {
  const now = new Date();

  // Ventana: 23h–25h desde ahora (2h de margen para no perderse ninguna cita)
  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const to   = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const statesToSkip: AppointmentStatus[] = ['CANCELADA', 'REALIZADA', 'NO_ASISTIO'];

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt:     { gte: from, lte: to },
        reminder24hSent: false,
        status:          { notIn: statesToSkip },
      },
      include: {
        client:   { select: { name: true, phone: true } },
        property: { select: { title: true } },
        agent:    { select: { name: true } },
      },
    });

    if (appointments.length === 0) return;

    console.log(
      `[scheduler] sendAppointmentReminders — ${appointments.length} recordatorio(s) pendiente(s) | ${now.toISOString()}`,
    );

    for (const appt of appointments) {
      if (!appt.client.phone) {
        console.warn(`[scheduler] Cita ${appt.id}: cliente sin teléfono, saltando`);
        continue;
      }

      try {
        const mensaje = buildReminderMessage({
          clientName:    appt.client.name,
          propertyTitle: appt.property.title,
          scheduledAt:   appt.scheduledAt,
          agentName:     appt.agent.name,
        });

        await sendWhatsAppText(appt.client.phone, mensaje);

        await prisma.appointment.update({
          where: { id: appt.id },
          data:  { reminder24hSent: true },
        });

        console.log(
          `[scheduler] Recordatorio 24h enviado — cita ${appt.id} | cliente: ${appt.client.name}`,
        );
      } catch (err) {
        console.error(`[scheduler] Error enviando recordatorio cita ${appt.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[scheduler] Error en sendAppointmentReminders:', err);
  }
}

// ─── Job 4: Recordatorio semanal de contratos por vencer (lunes 8am) ──────────

/**
 * Detecta contratos ACTIVO en los hitos de aviso: 14-15 sem, 7-8 sem y 0-1 sem
 * hasta vencimiento, y envía email + WhatsApp al agente y a todos los admins.
 * Complementa alertExpiringContracts (diario) con avisos de hito específicos.
 */
async function remindExpiringContractsWeekly(): Promise<void> {
  const now = new Date();

  // Ventanas de días que corresponden a los hitos (inclusive)
  // Hitos: 16 semanas, 13 semanas, 1 semana
  const milestones = [
    { label: '16 semanas', min: 112, max: 119 },
    { label: '13 semanas', min: 91,  max: 98  },
    { label: '1 semana',   min: 0,   max: 7   },
  ];

  try {
    // Recopilar contratos en cualquiera de los hitos
    const allContracts: Array<{
      id: string; endDate: Date; daysLeft: number; milestone: string;
      monthlyRent: Prisma.Decimal; rentCurrency: string;
      property: { title: string; address: string; city: string };
      client:   { name: string; phone: string | null; email: string | null };
      agent:    { id: string; name: string; email: string; phone: string | null };
    }> = [];

    for (const ms of milestones) {
      const dateMin = new Date();
      dateMin.setDate(dateMin.getDate() + ms.min);
      const dateMax = new Date();
      dateMax.setDate(dateMax.getDate() + ms.max);

      const contracts = await prisma.rentalContract.findMany({
        where: {
          status:  RentalContractStatus.ACTIVO,
          endDate: { gte: dateMin, lte: dateMax },
        },
        include: {
          property: { select: { title: true, address: true, city: true } },
          client:   { select: { name: true, phone: true, email: true } },
          agent:    { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      for (const c of contracts) {
        const daysLeft = Math.ceil(
          (c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        allContracts.push({ ...c, daysLeft, milestone: ms.label });
      }
    }

    if (allContracts.length === 0) {
      console.log(
        `[scheduler] remindExpiringContractsWeekly — sin contratos en hitos de aviso | ${now.toISOString()}`,
      );
      await prisma.agentLog.create({
        data: {
          agentName: 'scheduler',
          action:    'recordatorio_contrato_por_vencer',
          input:     { milestonesChecked: milestones.length },
          output:    { contractsCount: 0, sentOk: 0, sentError: 0 },
          status:    LogStatus.OK,
        },
      });
      return;
    }

    const admins = await prisma.user.findMany({
      where:  { role: Role.ADMIN, status: UserStatus.ACTIVE },
      select: { name: true, email: true, phone: true },
    });

    let sentOk = 0;
    let sentError = 0;

    for (const contract of allContracts) {
      const esUrgente = contract.daysLeft <= 7;
      const fechaFin  = contract.endDate.toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      const subject = `${esUrgente ? '🔴 URGENTE — ' : '⚠️ '}Contrato vence en ${contract.daysLeft} día(s) [${contract.milestone}] — ${contract.property.title}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b;">
          <div style="background: ${esUrgente ? '#dc2626' : '#f59e0b'}; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">
              ${esUrgente ? '🔴 Contrato URGENTE por vencer' : '⚠️ Aviso de hito — Contrato por vencer'}
            </h2>
          </div>
          <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 16px;">
              Alerta de hito <strong>${contract.milestone}</strong> antes del vencimiento del contrato:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr style="background: #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold; width: 40%;">Inmueble</td>
                <td style="padding: 8px 12px;">${contract.property.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; background: #f1f5f9;">Dirección</td>
                <td style="padding: 8px 12px; background: #f1f5f9;">${contract.property.address}, ${contract.property.city}</td>
              </tr>
              <tr style="background: #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Arrendatario</td>
                <td style="padding: 8px 12px;">${contract.client.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; background: #f1f5f9;">Canon mensual</td>
                <td style="padding: 8px 12px; background: #f1f5f9;">
                  $${Number(contract.monthlyRent).toLocaleString('es-CO')} ${contract.rentCurrency}
                </td>
              </tr>
              <tr style="background: #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Vence el</td>
                <td style="padding: 8px 12px;">${fechaFin} (${contract.daysLeft} día(s))</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; background: #f1f5f9;">Hito</td>
                <td style="padding: 8px 12px; background: #f1f5f9;">${contract.milestone}</td>
              </tr>
            </table>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              Gestiona la renovación desde el panel en <strong>Contratos → Arriendos</strong>.
            </p>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
            Mensaje automático del sistema. ID contrato: ${contract.id}
          </p>
        </div>`;

      const waTxt =
        `${esUrgente ? '🔴 URGENTE' : '⚠️ Aviso'} — Contrato por vencer (${contract.milestone})\n` +
        `Inmueble: ${contract.property.title}\n` +
        `Arrendatario: ${contract.client.name}\n` +
        `Vence el: ${fechaFin} (${contract.daysLeft} día(s))\n` +
        `Canon: $${Number(contract.monthlyRent).toLocaleString('es-CO')} COP\n\n` +
        `Gestiona la renovación en el panel.`;

      const recipients = [
        { name: contract.agent.name, email: contract.agent.email, phone: contract.agent.phone },
        ...admins.filter((a) => a.email !== contract.agent.email),
      ];

      for (const recipient of recipients) {
        try {
          await sendEmail(recipient.email, subject, html);
          if (recipient.phone) {
            await sendWhatsAppText(recipient.phone, waTxt);
          } else {
            console.warn(
              `[scheduler] remindExpiringContractsWeekly — ${recipient.name} sin teléfono, solo email`,
            );
          }
          sentOk++;
        } catch (err) {
          console.error(
            `[scheduler] Error enviando aviso de contrato ${contract.id} a ${recipient.email}:`,
            err,
          );
          sentError++;
        }
      }
    }

    await prisma.agentLog.create({
      data: {
        agentName:         'scheduler',
        action:            'recordatorio_contrato_por_vencer',
        input:             { milestonesChecked: milestones.length },
        output:            { contractsCount: allContracts.length, sentOk, sentError },
        status:            sentError === 0 ? LogStatus.OK : LogStatus.ERROR,
        relatedEntityType: 'RentalContract',
      },
    });

    console.log(
      `[scheduler] remindExpiringContractsWeekly — ${allContracts.length} contrato(s) en hitos | OK: ${sentOk} | errores: ${sentError} | ${now.toISOString()}`,
    );
  } catch (err) {
    console.error('[scheduler] Error en remindExpiringContractsWeekly:', err);
    await prisma.agentLog
      .create({
        data: {
          agentName:    'scheduler',
          action:       'recordatorio_contrato_por_vencer',
          input:        {},
          output:       {},
          status:       LogStatus.ERROR,
          errorMessage: String(err),
        },
      })
      .catch(() => {});
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

  // Job 2 — 08:00 AM Colombia: alertas de contratos próximos a vencer (diario)
  cron.schedule('0 8 * * *', alertExpiringContracts, {
    timezone: 'America/Bogota',
  });

  // Job 3 — 08:00 AM Colombia, solo lunes: recordatorio de cuotas que vencen esta semana
  cron.schedule('0 8 * * 1', remindPendingPayments, {
    timezone: 'America/Bogota',
  });

  // Job 4 — 08:00 AM Colombia, solo lunes: aviso de contratos en hitos de vencimiento
  cron.schedule('0 8 * * 1', remindExpiringContractsWeekly, {
    timezone: 'America/Bogota',
  });

  // Job 5 — cada hora en punto: recordatorio de citas 24h antes
  // Busca citas en ventana 23-25h y envía mensaje interactivo al cliente por WhatsApp
  cron.schedule('0 * * * *', sendAppointmentReminders, {
    timezone: 'America/Bogota',
  });

  console.log(
    '[scheduler] 5 jobs registrados — ' +
    'markOverduePayments (07:50 diario) | ' +
    'alertExpiringContracts (08:00 diario) | ' +
    'remindPendingPayments (08:00 lunes) | ' +
    'remindExpiringContractsWeekly (08:00 lunes) | ' +
    'sendAppointmentReminders (cada hora) — timezone: America/Bogota',
  );
}

// ─── Exportar jobs para pruebas manuales ─────────────────────────────────────
// Permite invocarlos desde el panel de admin o en pruebas sin esperar el cron.

export {
  markOverduePayments,
  alertExpiringContracts,
  remindPendingPayments,
  remindExpiringContractsWeekly,
  sendAppointmentReminders,
  // sendAppointmentReminderById ya se exporta como named export arriba
};
