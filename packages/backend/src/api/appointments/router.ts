import { Router } from 'express';
import { z } from 'zod';
import { Prisma, AppointmentStatus } from '../../lib/generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { sendEmail, sendWhatsAppText } from '../../services/messaging';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/** Notifica al admin cuando se agenda una cita nueva */
async function notifyNewAppointment(
  clientName: string,
  propertyTitle: string,
  scheduledAt: Date
) {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.notifyAppointment) return;

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, phone: true },
    });

    const fecha = format(scheduledAt, "d 'de' MMMM 'a las' HH:mm", { locale: es });
    const msg = `📅 Nueva cita agendada: ${clientName} — ${propertyTitle} — ${fecha}`;
    const html = `<p>${msg}</p>`;

    for (const admin of admins) {
      if (admin.email) await sendEmail(admin.email, 'Nueva cita agendada', html).catch(() => {});
      if (admin.phone) await sendWhatsAppText(`+57${admin.phone.replace(/\D/g, '')}`, msg).catch(() => {});
    }
  } catch { /* no bloquea */ }
}

export const appointmentsRouter = Router();

// Verifica si el agente tiene disponibilidad en el horario solicitado (reglas 4 y 5)
const checkAgentAvailability = async (
  agentId: string,
  scheduledAt: Date
): Promise<{ available: boolean; reason?: string }> => {
  const dayOfWeek = scheduledAt.getDay();
  const timeStr = scheduledAt.toTimeString().substring(0, 5); // "HH:MM"

  const slot = await prisma.availability.findFirst({
    where: {
      userId: agentId,
      dayOfWeek,
      isBlocked: false,
      OR: [
        { validFrom: null, validUntil: null },
        { validFrom: { lte: scheduledAt }, validUntil: { gte: scheduledAt } },
      ],
    },
  });

  if (!slot) return { available: false, reason: 'El agente no tiene disponibilidad ese día' };

  if (timeStr < slot.startTime || timeStr >= slot.endTime)
    return {
      available: false,
      reason: `El agente atiende entre ${slot.startTime} y ${slot.endTime}`,
    };

  const conflicto = await prisma.appointment.findFirst({
    where: {
      agentId,
      scheduledAt,
      status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
    },
  });

  if (conflicto) return { available: false, reason: 'El agente ya tiene una cita en ese horario' };

  return { available: true };
};

// GET /api/v1/appointments
appointmentsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const where: Prisma.AppointmentWhereInput = {};

    if (user.role === 'AGENT') where.agentId = user.id;
    if (req.query.status) where.status = req.query.status as AppointmentStatus;
    if (req.query.agentId && user.role !== 'AGENT') where.agentId = req.query.agentId as string;
    if (req.query.clientId) where.clientId = req.query.clientId as string;

    // Filtro de rango de fechas construido de forma segura para evitar claves duplicadas
    const scheduledAtFilter: { gte?: Date; lte?: Date } = {};
    if (req.query.from) scheduledAtFilter.gte = new Date(req.query.from as string);
    if (req.query.to) scheduledAtFilter.lte = new Date(req.query.to as string);
    if (Object.keys(scheduledAtFilter).length) where.scheduledAt = scheduledAtFilter;

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true, email: true } },
          property: { select: { id: true, title: true, address: true, city: true } },
          agent: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return success(res, appointments, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// GET /api/v1/appointments/:id
appointmentsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where: Prisma.AppointmentWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const appointment = await prisma.appointment.findFirst({
      where,
      include: {
        client: true,
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            visitDays: true,
            visitTimeSlots: true,
            visitSpecialInstructions: true,
          },
        },
        agent: { select: { id: true, name: true, phone: true, email: true } },
        rescheduledFrom: { select: { id: true, scheduledAt: true, status: true } },
      },
    });

    if (!appointment) return notFound(res, 'Cita');
    return success(res, appointment);
  })
);

const createAppointmentSchema = z.object({
  clientId: z.string(),
  propertyId: z.string(),
  agentId: z.string(),
  scheduledAt: z.string().transform((v) => new Date(v)),
  durationMinutes: z.number().int().positive().default(60),
  notes: z.string().optional(),
  requestedTimes: z.any().optional(),
  isSpecialCase: z.boolean().default(false),
  specialCaseNotes: z.string().optional(),
});

// POST /api/v1/appointments
appointmentsRouter.post(
  '/',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const { scheduledAt, agentId, isSpecialCase, ...rest } = parsed.data;

    if (scheduledAt < new Date())
      return error(res, 'No se puede agendar una cita en el pasado', 400);

    // Verificar disponibilidad; si es caso especial se permite sin disponibilidad (regla 5)
    if (!isSpecialCase) {
      const disponibilidad = await checkAgentAvailability(agentId, scheduledAt);
      if (!disponibilidad.available)
        return error(res, disponibilidad.reason ?? 'Sin disponibilidad en ese horario', 400);
    }

    const appointment = await prisma.appointment.create({
      data: {
        ...rest,
        agentId,
        scheduledAt,
        isSpecialCase,
        status: AppointmentStatus.PENDIENTE,
      },
      include: {
        client: { select: { id: true, name: true } },
        property: { select: { id: true, title: true } },
        agent: { select: { id: true, name: true } },
      },
    });

    // Notificar al admin en background
    notifyNewAppointment(
      appointment.client?.name ?? 'Cliente',
      appointment.property?.title ?? 'Inmueble',
      scheduledAt
    ).catch(() => {});

    return success(res, appointment, 201);
  })
);

// PATCH /api/v1/appointments/:id/status
appointmentsRouter.patch(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { status, cancellationReason } = req.body as {
      status: AppointmentStatus;
      cancellationReason?: string;
    };

    if (!Object.values(AppointmentStatus).includes(status))
      return error(res, 'Estado de cita inválido', 400);

    if (status === AppointmentStatus.CANCELADA && !cancellationReason)
      return error(res, 'Debes indicar la razón de la cancelación', 400);

    const where: Prisma.AppointmentWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.appointment.findFirst({ where });
    if (!existing) return notFound(res, 'Cita');

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status,
        ...(cancellationReason && { cancellationReason }),
      },
      select: { id: true, status: true, cancellationReason: true },
    });

    return success(res, updated);
  })
);

const rescheduleSchema = z.object({
  scheduledAt: z.string().transform((v) => new Date(v)),
  agentId: z.string().optional(),
  notes: z.string().optional(),
});

// PATCH /api/v1/appointments/:id/reschedule
// Crea una cita nueva apuntando a la anterior; la anterior queda como REAGENDADA (regla 6)
appointmentsRouter.patch(
  '/:id/reschedule',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const where: Prisma.AppointmentWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.appointment.findFirst({ where });
    if (!existing) return notFound(res, 'Cita');

    const { scheduledAt, agentId, notes } = parsed.data;
    const newAgentId = agentId ?? existing.agentId;

    if (scheduledAt < new Date())
      return error(res, 'No se puede reagendar a una fecha en el pasado', 400);

    const disponibilidad = await checkAgentAvailability(newAgentId, scheduledAt);
    if (!disponibilidad.available)
      return error(res, disponibilidad.reason ?? 'Sin disponibilidad en ese horario', 400);

    // Transacción: marcar la anterior y crear la nueva
    const [, nueva] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id: existing.id },
        data: { status: AppointmentStatus.REAGENDADA },
      }),
      prisma.appointment.create({
        data: {
          clientId: existing.clientId,
          propertyId: existing.propertyId,
          agentId: newAgentId,
          scheduledAt,
          durationMinutes: existing.durationMinutes,
          status: AppointmentStatus.PENDIENTE,
          rescheduledFromId: existing.id,
          notes: notes ?? existing.notes ?? undefined,
        },
      }),
    ]);

    return success(res, nueva, 201);
  })
);

// DELETE /api/v1/appointments/:id — cancela con razón obligatoria, nunca elimina (regla 2)
appointmentsRouter.delete(
  '/:id',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { reason } = req.body as { reason?: string };

    if (!reason || reason.trim().length === 0)
      return error(res, 'Debes indicar la razón de la cancelación', 400);

    const where: Prisma.AppointmentWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.appointment.findFirst({ where });
    if (!existing) return notFound(res, 'Cita');

    await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: AppointmentStatus.CANCELADA,
        cancellationReason: reason.trim(),
      },
    });

    return success(res, { message: 'Cita cancelada correctamente' });
  })
);
