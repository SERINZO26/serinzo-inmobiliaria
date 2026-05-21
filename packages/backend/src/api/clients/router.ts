import { Router } from 'express';
import { z } from 'zod';
import { Prisma, ClientSource, ClientStatus, Operation } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { sendEmail, sendWhatsAppText } from '../../services/messaging';

/** Envía notificación al admin cuando se registra un cliente nuevo */
async function notifyNewClient(clientName: string, clientPhone: string) {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.notifyNewClient) return;

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, phone: true },
    });

    const msg = `🆕 Nuevo cliente registrado: ${clientName} — ${clientPhone}`;
    const html = `<p>${msg}</p>`;

    for (const admin of admins) {
      if (admin.email) {
        await sendEmail(admin.email, 'Nuevo cliente registrado', html).catch(() => {});
      }
      if (admin.phone) {
        await sendWhatsAppText(`+57${admin.phone.replace(/\D/g, '')}`, msg).catch(() => {});
      }
    }
  } catch {
    // Las notificaciones no deben bloquear la respuesta
  }
}

export const clientsRouter = Router();

// GET /api/v1/clients
clientsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const where: Prisma.ClientWhereInput = { archived: false };

    // Agente solo ve sus clientes
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    if (req.query.status) where.status = req.query.status as ClientStatus;
    if (req.query.interestLevel)
      where.interestLevel = parseInt(req.query.interestLevel as string, 10);
    if (req.query.source) where.source = req.query.source as ClientSource;
    if (req.query.assignedAgentId && user.role !== 'AGENT')
      where.assignedAgentId = req.query.assignedAgentId as string;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          assignedAgent: { select: { id: true, name: true } },
        },
        orderBy: { lastContactAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    return success(res, clients, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// GET /api/v1/clients/:id
clientsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where: Prisma.ClientWhereInput = {
      id: req.params.id,
      archived: false,
    };
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    const client = await prisma.client.findFirst({
      where,
      include: {
        assignedAgent: { select: { id: true, name: true, phone: true } },
        appointments: {
          include: {
            property: { select: { id: true, title: true, city: true } },
            agent: { select: { id: true, name: true } },
          },
          orderBy: { scheduledAt: 'desc' },
        },
        conversations: {
          select: {
            id: true,
            channel: true,
            startedAt: true,
            outcome: true,
            interestDetected: true,
            summary: true,
          },
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!client) return notFound(res, 'Cliente');
    return success(res, client);
  })
);

const clientSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  idNumber: z.string().optional(),
  source: z.nativeEnum(ClientSource),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  budgetCurrency: z.string().default('COP'),
  preferredType: z.array(z.string()).default([]),
  preferredZones: z.array(z.string()).default([]),
  preferredOperation: z.nativeEnum(Operation).optional(),
  minBedrooms: z.number().int().min(0).optional(),
  minBathrooms: z.number().int().min(0).optional(),
  additionalRequirements: z.string().optional(),
  interestLevel: z.number().int().min(1).max(5).default(1),
  qualificationNotes: z.string().optional(),
  status: z.nativeEnum(ClientStatus).default('NUEVO'),
  assignedAgentId: z.string().optional(),
});

// POST /api/v1/clients
clientsRouter.post(
  '/',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const client = await prisma.client.create({
      data: {
        ...parsed.data,
        assignedAgentId: parsed.data.assignedAgentId || req.user!.id,
      } as any,
    });

    // Notificar al admin en background (no bloquea la respuesta)
    notifyNewClient(client.name, client.phone ?? '').catch(() => {});

    return success(res, client, 201);
  })
);

// PUT /api/v1/clients/:id
clientsRouter.put(
  '/:id',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where: Prisma.ClientWhereInput = {
      id: req.params.id,
      archived: false,
    };
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    const existing = await prisma.client.findFirst({ where });
    if (!existing) return notFound(res, 'Cliente');

    const parsed = clientSchema.partial().safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const updated = await prisma.client.update({
      where: { id: existing.id },
      data: { ...parsed.data, lastContactAt: new Date() },
    });

    return success(res, updated);
  })
);

// PATCH /api/v1/clients/:id/interest
// Regla de negocio 10: siempre exigir nota al modificar el nivel calculado por IA
clientsRouter.patch(
  '/:id/interest',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const { interestLevel, overrideNote } = req.body as {
      interestLevel: number;
      overrideNote: string;
    };

    if (typeof interestLevel !== 'number' || interestLevel < 1 || interestLevel > 5)
      return error(res, 'El nivel de interés debe ser un número entre 1 y 5', 400);

    if (!overrideNote || overrideNote.trim().length === 0)
      return error(
        res,
        'Debes agregar una nota explicando por qué modificas el nivel de interés',
        400
      );

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, archived: false },
    });
    if (!existing) return notFound(res, 'Cliente');

    const updated = await prisma.client.update({
      where: { id: existing.id },
      data: {
        interestLevel,
        qualificationNotes: overrideNote.trim(),
        lastContactAt: new Date(),
      },
      select: { id: true, interestLevel: true, qualificationNotes: true },
    });

    return success(res, updated);
  })
);

// DELETE /api/v1/clients/:id — soft delete, nunca eliminar (regla de negocio 2)
clientsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, archived: false },
    });
    if (!existing) return notFound(res, 'Cliente');

    await prisma.client.update({
      where: { id: existing.id },
      data: { archived: true },
    });

    return success(res, { message: 'Cliente archivado correctamente' });
  })
);
