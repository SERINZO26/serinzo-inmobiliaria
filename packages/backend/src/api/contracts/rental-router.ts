import { Router } from 'express';
import { z } from 'zod';
import { Prisma, RentalContractStatus, PropertyStatus } from '../../lib/generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { paymentsRouter } from './payments-router';

export const rentalRouter = Router();

// Montar el router de pagos como sub-ruta. mergeParams está en paymentsRouter.
rentalRouter.use('/:contractId/pagos', paymentsRouter);

// ─── Utilidad: genera las cuotas mensuales de un contrato ────────────────────
// Produce una cuota por cada mes desde startDate hasta endDate (inclusive).
// El día de vencimiento es el mismo día de mes que startDate.

function generatePayments(
  contractId: string,
  startDate: Date,
  endDate: Date,
  monthlyRent: number,
  commissionPct: number | null,
): Prisma.RentalPaymentCreateManyInput[] {
  const payments: Prisma.RentalPaymentCreateManyInput[] = [];
  const current = new Date(startDate);
  let period = 1;

  while (current <= endDate) {
    const commission =
      commissionPct !== null ? (monthlyRent * commissionPct) / 100 : null;
    const ownerPayment =
      commission !== null ? monthlyRent - commission : null;

    payments.push({
      contractId,
      periodNumber: period,
      dueDate: new Date(current),
      amount: new Prisma.Decimal(monthlyRent),
      commission: commission !== null ? new Prisma.Decimal(commission) : null,
      ownerPayment: ownerPayment !== null ? new Prisma.Decimal(ownerPayment) : null,
    });

    // Avanzar exactamente un mes manteniendo el día
    current.setMonth(current.getMonth() + 1);
    period++;
  }

  return payments;
}

// ─── Schemas de validación ────────────────────────────────────────────────────

const createRentalSchema = z.object({
  propertyId: z.string(),
  clientId: z.string(),
  agentId: z.string(),
  startDate: z.string().transform((v) => new Date(v)),
  endDate: z.string().transform((v) => new Date(v)),
  monthlyRent: z.number().positive(),
  rentCurrency: z.string().default('COP'),
  adminFee: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
  depositCurrency: z.string().default('COP'),
  commissionPct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const editRentalSchema = createRentalSchema.partial().omit({ propertyId: true, clientId: true });

const renewSchema = z.object({
  newEndDate: z.string().transform((v) => new Date(v)),
  monthlyRent: z.number().positive().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

// ─── GET /api/v1/contracts/arriendos ─────────────────────────────────────────
// Lista contratos con filtros opcionales. El agente solo ve los suyos.

rentalRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const page  = Math.max(1, parseInt((req.query.page  as string) || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const where: Prisma.RentalContractWhereInput = {};

    // Agente solo accede a sus contratos
    if (user.role === 'AGENT') where.agentId = user.id;

    if (req.query.status)     where.status     = req.query.status     as RentalContractStatus;
    if (req.query.propertyId) where.propertyId = req.query.propertyId as string;
    if (req.query.clientId)   where.clientId   = req.query.clientId   as string;
    if (req.query.agentId && user.role !== 'AGENT') where.agentId = req.query.agentId as string;

    const [contracts, total] = await Promise.all([
      prisma.rentalContract.findMany({
        where,
        include: {
          property: { select: { id: true, title: true, address: true, city: true } },
          client:   { select: { id: true, name: true, phone: true, email: true } },
          agent:    { select: { id: true, name: true } },
          // Solo incluye conteo de pagos para el listado
          payments: { select: { id: true, status: true }, orderBy: { periodNumber: 'asc' } },
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rentalContract.count({ where }),
    ]);

    return success(res, contracts, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

// ─── GET /api/v1/contracts/arriendos/alerts ───────────────────────────────────
// Contratos activos que vencen en los próximos N días (default 105 días = ~15 semanas).
// Montado ANTES de /:id para que Express no lo interprete como un ID.

rentalRouter.get(
  '/alerts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user    = req.user!;
    const weeks   = parseInt((req.query.weeks as string) || '15', 10);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + weeks * 7);

    const where: Prisma.RentalContractWhereInput = {
      status:  RentalContractStatus.ACTIVO,
      endDate: { lte: horizon, gte: new Date() },
    };

    if (user.role === 'AGENT') where.agentId = user.id;

    const contracts = await prisma.rentalContract.findMany({
      where,
      include: {
        property: { select: { id: true, title: true, address: true, city: true } },
        client:   { select: { id: true, name: true, phone: true, email: true } },
        agent:    { select: { id: true, name: true, email: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    // Enriquecer con días restantes para facilitar la UI
    const enriched = contracts.map((c) => ({
      ...c,
      daysUntilExpiry: Math.ceil(
        (c.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    }));

    return success(res, enriched);
  }),
);

// ─── GET /api/v1/contracts/arriendos/:id ─────────────────────────────────────

rentalRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user  = req.user!;
    const where: Prisma.RentalContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const contract = await prisma.rentalContract.findFirst({
      where,
      include: {
        property: { select: { id: true, title: true, address: true, city: true, photos: true } },
        client:   true,
        agent:    { select: { id: true, name: true, phone: true, email: true } },
        payments: { orderBy: { periodNumber: 'asc' } },
      },
    });

    if (!contract) return notFound(res, 'Contrato de arriendo');
    return success(res, contract);
  }),
);

// ─── POST /api/v1/contracts/arriendos ────────────────────────────────────────
// Crea el contrato y genera automáticamente todas las cuotas mensuales.
// Cambia el estado del inmueble a ARRENDADO.

rentalRouter.post(
  '/',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createRentalSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const data = parsed.data;

    if (data.startDate >= data.endDate)
      return error(res, 'La fecha de inicio debe ser anterior a la fecha de fin', 400);

    // Verificar que el inmueble exista y esté disponible
    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) return notFound(res, 'Inmueble');
    if (property.status !== PropertyStatus.DISPONIBLE && property.status !== PropertyStatus.RESERVADO)
      return error(res, `El inmueble tiene estado "${property.status}" y no puede arrendarse`, 400);

    // Verificar que el cliente exista
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) return notFound(res, 'Cliente');

    // Crear contrato + cuotas + actualizar inmueble en una sola transacción
    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.rentalContract.create({
        data: {
          propertyId:      data.propertyId,
          clientId:        data.clientId,
          agentId:         data.agentId,
          startDate:       data.startDate,
          endDate:         data.endDate,
          monthlyRent:     new Prisma.Decimal(data.monthlyRent),
          rentCurrency:    data.rentCurrency,
          adminFee:        data.adminFee        != null ? new Prisma.Decimal(data.adminFee)        : undefined,
          depositAmount:   data.depositAmount   != null ? new Prisma.Decimal(data.depositAmount)   : undefined,
          depositCurrency: data.depositCurrency,
          commissionPct:   data.commissionPct   != null ? new Prisma.Decimal(data.commissionPct)   : undefined,
          status:          RentalContractStatus.ACTIVO,
          notes:           data.notes,
        },
      });

      // Generar cuotas mensuales automáticamente
      const payments = generatePayments(
        created.id,
        data.startDate,
        data.endDate,
        data.monthlyRent,
        data.commissionPct ?? null,
      );

      await tx.rentalPayment.createMany({ data: payments });

      // Marcar el inmueble como ARRENDADO
      await tx.property.update({
        where: { id: data.propertyId },
        data:  { status: PropertyStatus.ARRENDADO },
      });

      return created;
    });

    // Devolver contrato con pagos incluidos
    const full = await prisma.rentalContract.findUnique({
      where:   { id: contract.id },
      include: {
        property: { select: { id: true, title: true, address: true, city: true } },
        client:   { select: { id: true, name: true, phone: true, email: true } },
        agent:    { select: { id: true, name: true } },
        payments: { orderBy: { periodNumber: 'asc' } },
      },
    });

    return success(res, full, 201);
  }),
);

// ─── PUT /api/v1/contracts/arriendos/:id ─────────────────────────────────────
// Edita el contrato. Si cambian precio, fechas o comisión, recalcula las cuotas
// pendientes (sin tocar las ya pagadas).

rentalRouter.put(
  '/:id',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user   = req.user!;
    const parsed = editRentalSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const where: Prisma.RentalContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.rentalContract.findFirst({ where });
    if (!existing) return notFound(res, 'Contrato de arriendo');

    if (existing.status === RentalContractStatus.CANCELADO)
      return error(res, 'No se puede editar un contrato cancelado', 400);

    const data = parsed.data;

    // Determinar si hay que recalcular las cuotas pendientes
    const startChanged     = data.startDate    && data.startDate.getTime()    !== existing.startDate.getTime();
    const endChanged       = data.endDate      && data.endDate.getTime()      !== existing.endDate.getTime();
    const rentChanged      = data.monthlyRent  && data.monthlyRent            !== Number(existing.monthlyRent);
    const commissionChanged = data.commissionPct !== undefined;
    const shouldRecalculate = startChanged || endChanged || rentChanged || commissionChanged;

    const updated = await prisma.$transaction(async (tx) => {
      const contract = await tx.rentalContract.update({
        where: { id: existing.id },
        data: {
          ...(data.agentId       && { agentId:         data.agentId }),
          ...(data.startDate     && { startDate:        data.startDate }),
          ...(data.endDate       && { endDate:          data.endDate }),
          ...(data.monthlyRent   != null && { monthlyRent:  new Prisma.Decimal(data.monthlyRent) }),
          ...(data.rentCurrency  && { rentCurrency:     data.rentCurrency }),
          ...(data.adminFee      != null && { adminFee:     new Prisma.Decimal(data.adminFee) }),
          ...(data.depositAmount != null && { depositAmount: new Prisma.Decimal(data.depositAmount) }),
          ...(data.depositCurrency && { depositCurrency: data.depositCurrency }),
          ...(data.commissionPct != null && { commissionPct: new Prisma.Decimal(data.commissionPct) }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      });

      if (shouldRecalculate) {
        // Eliminar solo las cuotas pendientes (no tocar las ya pagadas o vencidas)
        await tx.rentalPayment.deleteMany({
          where: {
            contractId: existing.id,
            status:     { in: ['PENDIENTE', 'VENCIDO'] },
          },
        });

        // Regenerar desde el primer pendiente hacia adelante
        // Tomar como fecha de inicio la más tardía entre hoy y la startDate del contrato
        const recalcStart = new Date(
          Math.max(
            (data.startDate ?? existing.startDate).getTime(),
            Date.now(),
          ),
        );
        // Ajustar al mismo día del mes que startDate para mantener la fecha de pago
        recalcStart.setDate((data.startDate ?? existing.startDate).getDate());

        const newPayments = generatePayments(
          existing.id,
          recalcStart,
          data.endDate ?? existing.endDate,
          data.monthlyRent ?? Number(existing.monthlyRent),
          data.commissionPct !== undefined ? data.commissionPct : Number(existing.commissionPct),
        );

        // Re-numerar desde el último período ya registrado
        const lastPaid = await tx.rentalPayment.findFirst({
          where:   { contractId: existing.id },
          orderBy: { periodNumber: 'desc' },
        });
        const startPeriod = (lastPaid?.periodNumber ?? 0) + 1;
        const renumbered  = newPayments.map((p, i) => ({
          ...p,
          periodNumber: startPeriod + i,
        }));

        if (renumbered.length > 0) {
          await tx.rentalPayment.createMany({ data: renumbered });
        }
      }

      return contract;
    });

    const full = await prisma.rentalContract.findUnique({
      where:   { id: updated.id },
      include: {
        property: { select: { id: true, title: true } },
        client:   { select: { id: true, name: true } },
        agent:    { select: { id: true, name: true } },
        payments: { orderBy: { periodNumber: 'asc' } },
      },
    });

    return success(res, full);
  }),
);

// ─── POST /api/v1/contracts/arriendos/:id/renew ───────────────────────────────
// Renueva el contrato: extiende la fecha de fin y genera las nuevas cuotas.
// El contrato original queda en estado RENOVADO y se crea uno nuevo ACTIVO.

rentalRouter.post(
  '/:id/renew',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user   = req.user!;
    const parsed = renewSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const where: Prisma.RentalContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.rentalContract.findFirst({ where });
    if (!existing) return notFound(res, 'Contrato de arriendo');

    if (existing.status !== RentalContractStatus.ACTIVO && existing.status !== RentalContractStatus.VENCIDO)
      return error(res, 'Solo se pueden renovar contratos activos o vencidos', 400);

    const { newEndDate, monthlyRent, commissionPct, notes } = parsed.data;

    if (newEndDate <= existing.endDate)
      return error(res, 'La nueva fecha de fin debe ser posterior a la actual', 400);

    const newContract = await prisma.$transaction(async (tx) => {
      // Marcar el contrato anterior como RENOVADO
      await tx.rentalContract.update({
        where: { id: existing.id },
        data:  { status: RentalContractStatus.RENOVADO },
      });

      // El nuevo contrato comienza donde termina el anterior + 1 día
      const newStart = new Date(existing.endDate);
      newStart.setDate(newStart.getDate() + 1);

      const newRent       = monthlyRent     ?? Number(existing.monthlyRent);
      const newCommission = commissionPct   !== undefined ? commissionPct : Number(existing.commissionPct);

      const created = await tx.rentalContract.create({
        data: {
          propertyId:      existing.propertyId,
          clientId:        existing.clientId,
          agentId:         existing.agentId,
          startDate:       newStart,
          endDate:         newEndDate,
          monthlyRent:     new Prisma.Decimal(newRent),
          rentCurrency:    existing.rentCurrency,
          adminFee:        existing.adminFee ?? undefined,
          depositAmount:   existing.depositAmount ?? undefined,
          depositCurrency: existing.depositCurrency,
          commissionPct:   newCommission != null ? new Prisma.Decimal(newCommission) : undefined,
          status:          RentalContractStatus.ACTIVO,
          notes:           notes ?? existing.notes ?? undefined,
        },
      });

      const payments = generatePayments(
        created.id,
        newStart,
        newEndDate,
        newRent,
        newCommission,
      );

      await tx.rentalPayment.createMany({ data: payments });

      return created;
    });

    const full = await prisma.rentalContract.findUnique({
      where:   { id: newContract.id },
      include: {
        property: { select: { id: true, title: true } },
        client:   { select: { id: true, name: true } },
        agent:    { select: { id: true, name: true } },
        payments: { orderBy: { periodNumber: 'asc' } },
      },
    });

    return success(res, full, 201);
  }),
);

// ─── PATCH /api/v1/contracts/arriendos/:id/cancel ────────────────────────────
// Cancela el contrato y devuelve el inmueble a estado DISPONIBLE.

rentalRouter.patch(
  '/:id/cancel',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user  = req.user!;
    const { notes } = req.body as { notes?: string };

    const where: Prisma.RentalContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.rentalContract.findFirst({ where });
    if (!existing) return notFound(res, 'Contrato de arriendo');

    if (existing.status === RentalContractStatus.CANCELADO)
      return error(res, 'El contrato ya está cancelado', 400);

    await prisma.$transaction([
      prisma.rentalContract.update({
        where: { id: existing.id },
        data:  {
          status: RentalContractStatus.CANCELADO,
          ...(notes && { notes }),
        },
      }),
      // Liberar el inmueble para nuevos arriendos
      prisma.property.update({
        where: { id: existing.propertyId },
        data:  { status: PropertyStatus.DISPONIBLE },
      }),
    ]);

    return success(res, { message: 'Contrato cancelado. El inmueble vuelve a estado Disponible.' });
  }),
);
