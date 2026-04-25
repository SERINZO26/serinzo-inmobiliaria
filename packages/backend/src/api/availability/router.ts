import { Router } from 'express';
import { z } from 'zod';
import { AppointmentStatus } from '../../lib/generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';

export const availabilityRouter = Router();

// GET /api/v1/availability/check — debe ir antes de /:userId para que no lo capture
availabilityRouter.get(
  '/check',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { agentId, propertyId, date } = req.query as {
      agentId?: string;
      propertyId?: string;
      date?: string;
    };

    if (!agentId || !date) return error(res, 'Se requieren agentId y date', 400);

    const scheduledAt = new Date(date);
    if (isNaN(scheduledAt.getTime())) return error(res, 'Fecha inválida', 400);

    const dayOfWeek = scheduledAt.getDay();
    const timeStr = scheduledAt.toTimeString().substring(0, 5);

    const [slots, conflictos] = await Promise.all([
      prisma.availability.findMany({
        where: {
          userId: agentId,
          dayOfWeek,
          isBlocked: false,
          OR: [
            { validFrom: null, validUntil: null },
            { validFrom: { lte: scheduledAt }, validUntil: { gte: scheduledAt } },
          ],
        },
      }),
      prisma.appointment.findMany({
        where: {
          agentId,
          scheduledAt,
          status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
        },
        select: { id: true, scheduledAt: true, status: true },
      }),
    ]);

    const enFranja = slots.some(
      (s) => timeStr >= s.startTime && timeStr < s.endTime
    );
    const disponible = enFranja && conflictos.length === 0;

    // Si viene propertyId, incluir las franjas del propietario del inmueble
    let franjasInmueble: { from: string; to: string }[] = [];
    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { visitTimeSlots: true, visitDays: true },
      });
      if (property?.visitTimeSlots) {
        franjasInmueble = property.visitTimeSlots as { from: string; to: string }[];
      }
    }

    return success(res, {
      available: disponible,
      slots: slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
      conflicts: conflictos,
      propertySlots: franjasInmueble,
    });
  })
);

// GET /api/v1/availability/:userId
availabilityRouter.get(
  '/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const availability = await prisma.availability.findMany({
      where: { userId: req.params.userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return success(res, availability);
  })
);

const availabilitySchema = z.object({
  userId: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido, usa HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido, usa HH:MM'),
  validFrom: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  validUntil: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  isBlocked: z.boolean().default(false),
  blockReason: z.string().optional(),
});

// POST /api/v1/availability
availabilityRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const availability = await prisma.availability.create({
      data: parsed.data as Parameters<typeof prisma.availability.create>[0]['data'],
    });

    return success(res, availability, 201);
  })
);

// DELETE /api/v1/availability/:id
availabilityRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.availability.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return notFound(res, 'Franja de disponibilidad');

    await prisma.availability.delete({ where: { id: existing.id } });
    return success(res, { message: 'Franja eliminada correctamente' });
  })
);
