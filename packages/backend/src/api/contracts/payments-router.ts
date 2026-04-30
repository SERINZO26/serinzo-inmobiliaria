/**
 * payments-router.ts — Gestión de cuotas de contratos de arriendo.
 *
 * Montado en rental-router.ts como sub-ruta /:contractId/pagos.
 * Usa mergeParams: true para acceder a req.params.contractId del router padre.
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Prisma, PaymentStatus, RentalContractStatus } from '../../lib/generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { uploadImage } from '../../services/storage';

// mergeParams: true — permite acceder a :contractId definido en el router padre
export const paymentsRouter = Router({ mergeParams: true });

// Multer en memoria para el comprobante de pago (máximo 5 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica que el contrato exista y que el usuario tenga acceso */
async function findContract(contractId: string, userId: string, role: string) {
  const where: Prisma.RentalContractWhereInput = { id: contractId };
  if (role === 'AGENT') where.agentId = userId;
  return prisma.rentalContract.findFirst({ where });
}

/** Calcula ownerPayment a partir del monto y la comisión del contrato */
function calcOwnerPayment(amount: number, commissionPct: Prisma.Decimal | null): number | null {
  if (commissionPct === null) return null;
  const comm = (amount * Number(commissionPct)) / 100;
  return amount - comm;
}

// ─── GET /resumen ─────────────────────────────────────────────────────────────
// Montado ANTES de /:id para que Express no lo interprete como un ID.

paymentsRouter.get(
  '/resumen',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user       = req.user!;
    const contractId = req.params.contractId;

    const contract = await findContract(contractId, user.id, user.role);
    if (!contract) return notFound(res, 'Contrato de arriendo');

    const payments = await prisma.rentalPayment.findMany({
      where: { contractId },
    });

    const today = new Date();

    // Calcular estados efectivos considerando la fecha actual
    const resumen = {
      total:             payments.length,
      totalMonto:        0,
      pagados:           0,
      montoPagado:       0,
      pendientes:        0,
      montoPendiente:    0,
      vencidos:          0,
      montoVencido:      0,
      parciales:         0,
      montoParcial:      0,
      // Monto total al propietario (descontada comisión, solo de pagos PAGADO)
      totalPropietario:  0,
      // Comisión total recaudada
      totalComision:     0,
      // Próxima cuota pendiente o vencida
      proximaCuota:      null as null | (typeof payments)[0],
    };

    let proximaFecha: Date | null = null;

    for (const p of payments) {
      const monto = Number(p.amount);
      resumen.totalMonto += monto;

      // Clasificar usando estado almacenado; vencidos implícitos por fecha si sigue PENDIENTE
      const esVencido = p.status === PaymentStatus.PENDIENTE && p.dueDate < today;
      const estadoEfectivo = esVencido ? PaymentStatus.VENCIDO : p.status;

      switch (estadoEfectivo) {
        case PaymentStatus.PAGADO:
          resumen.pagados++;
          resumen.montoPagado       += monto;
          resumen.totalPropietario  += p.ownerPayment ? Number(p.ownerPayment) : 0;
          resumen.totalComision     += p.commission   ? Number(p.commission)   : 0;
          break;
        case PaymentStatus.VENCIDO:
          resumen.vencidos++;
          resumen.montoVencido += monto;
          if (!proximaFecha || p.dueDate < proximaFecha) {
            proximaFecha         = p.dueDate;
            resumen.proximaCuota = p;
          }
          break;
        case PaymentStatus.PARCIAL:
          resumen.parciales++;
          resumen.montoParcial += monto;
          break;
        default: // PENDIENTE
          resumen.pendientes++;
          resumen.montoPendiente += monto;
          if (!proximaFecha || p.dueDate < proximaFecha) {
            proximaFecha         = p.dueDate;
            resumen.proximaCuota = p;
          }
      }
    }

    return success(res, resumen);
  }),
);

// ─── GET / ────────────────────────────────────────────────────────────────────
// Lista todas las cuotas del contrato con estado efectivo calculado al vuelo.

paymentsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user       = req.user!;
    const contractId = req.params.contractId;

    const contract = await findContract(contractId, user.id, user.role);
    if (!contract) return notFound(res, 'Contrato de arriendo');

    const payments = await prisma.rentalPayment.findMany({
      where:   { contractId },
      orderBy: { periodNumber: 'asc' },
    });

    const today = new Date();

    // Enriquecer con estado efectivo (sin escribir en BD — el scheduler lo hace)
    const enriched = payments.map((p) => ({
      ...p,
      estadoEfectivo:
        p.status === PaymentStatus.PENDIENTE && p.dueDate < today
          ? PaymentStatus.VENCIDO
          : p.status,
    }));

    return success(res, enriched);
  }),
);

// ─── GET /:id ─────────────────────────────────────────────────────────────────

paymentsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user       = req.user!;
    const contractId = req.params.contractId;

    const contract = await findContract(contractId, user.id, user.role);
    if (!contract) return notFound(res, 'Contrato de arriendo');

    const payment = await prisma.rentalPayment.findFirst({
      where: { id: req.params.id, contractId },
    });

    if (!payment) return notFound(res, 'Cuota');

    const today = new Date();
    return success(res, {
      ...payment,
      estadoEfectivo:
        payment.status === PaymentStatus.PENDIENTE && payment.dueDate < today
          ? PaymentStatus.VENCIDO
          : payment.status,
    });
  }),
);

// ─── PATCH /:id ───────────────────────────────────────────────────────────────
// Edita una cuota (monto, fecha de vencimiento, notas).
// Si cambia el monto, recalcula ownerPayment y commission según la comisión del contrato.

const editPaymentSchema = z.object({
  amount:    z.number().positive().optional(),
  dueDate:   z.string().transform((v) => new Date(v)).optional(),
  notes:     z.string().optional(),
  status:    z.enum(['PENDIENTE', 'PAGADO', 'VENCIDO', 'PARCIAL']).optional(),
});

paymentsRouter.patch(
  '/:id',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user       = req.user!;
    const contractId = req.params.contractId;

    const parsed = editPaymentSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const contract = await findContract(contractId, user.id, user.role);
    if (!contract) return notFound(res, 'Contrato de arriendo');

    const existing = await prisma.rentalPayment.findFirst({
      where: { id: req.params.id, contractId },
    });
    if (!existing) return notFound(res, 'Cuota');

    if (existing.status === PaymentStatus.PAGADO)
      return error(res, 'No se puede editar una cuota ya pagada', 400);

    const data = parsed.data;

    // Recalcular comisión y pago al propietario si el monto cambia
    let commission:   Prisma.Decimal | null = existing.commission;
    let ownerPayment: Prisma.Decimal | null = existing.ownerPayment;

    if (data.amount !== undefined) {
      const newOwner = calcOwnerPayment(data.amount, contract.commissionPct);
      if (newOwner !== null) {
        const commAmt = data.amount - newOwner;
        commission   = new Prisma.Decimal(commAmt);
        ownerPayment = new Prisma.Decimal(newOwner);
      } else {
        commission   = null;
        ownerPayment = null;
      }
    }

    const updated = await prisma.rentalPayment.update({
      where: { id: existing.id },
      data: {
        ...(data.amount  != null && { amount:  new Prisma.Decimal(data.amount) }),
        ...(data.dueDate          && { dueDate: data.dueDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status           && { status:  data.status as PaymentStatus }),
        commission,
        ownerPayment,
      },
    });

    return success(res, updated);
  }),
);

// ─── PATCH /:id/pagar ─────────────────────────────────────────────────────────
// Marca la cuota como PAGADA. Acepta:
//   - comprobante (imagen o PDF, opcional) → Cloudinary
//   - repairAmount (string numérico en el body de FormData)
//   - repairDescription (string en el body de FormData)
// El ownerPayment se calcula: canon - comisión - arreglos

paymentsRouter.patch(
  '/:id/pagar',
  requireAgentOrAdmin,
  upload.single('comprobante'),
  asyncHandler(async (req, res) => {
    const user       = req.user!;
    const contractId = req.params.contractId;

    const contract = await findContract(contractId, user.id, user.role);
    if (!contract) return notFound(res, 'Contrato de arriendo');

    const existing = await prisma.rentalPayment.findFirst({
      where: { id: req.params.id, contractId },
    });
    if (!existing) return notFound(res, 'Cuota');

    if (existing.status === PaymentStatus.PAGADO)
      return error(res, 'Esta cuota ya fue registrada como pagada', 400);

    // Subir comprobante a Cloudinary si se adjuntó uno
    let receiptUrl: string | undefined;
    if (req.file) {
      const filename = `comprobante-periodo-${existing.periodNumber}-${Date.now()}`;
      const result   = await uploadImage(req.file.buffer, `comprobantes/${contractId}`, filename);
      receiptUrl = result.url;
    }

    // Arreglos/imprevistos (vienen como string en FormData)
    const repairAmount      = req.body.repairAmount ? Number(req.body.repairAmount) : 0;
    const repairDescription = req.body.repairDescription || null;

    if (repairAmount < 0) return error(res, 'El valor del arreglo no puede ser negativo', 400);

    // Recalcular commission y ownerPayment definitivos al momento del pago
    // ownerPayment = canon - comisión - arreglos
    const amount     = Number(existing.amount);
    const ownerBase  = calcOwnerPayment(amount, contract.commissionPct);
    const commission = ownerBase !== null ? new Prisma.Decimal(amount - ownerBase) : existing.commission;
    const ownerPay   = ownerBase !== null
      ? new Prisma.Decimal(ownerBase - repairAmount)
      : existing.ownerPayment;

    const updated = await prisma.rentalPayment.update({
      where: { id: existing.id },
      data: {
        status:       PaymentStatus.PAGADO,
        paidAt:       new Date(),
        commission,
        ownerPayment: ownerPay,
        ...(repairAmount > 0 && { repairAmount: new Prisma.Decimal(repairAmount) }),
        ...(repairDescription && { repairDescription }),
        ...(req.body.notes && { notes: req.body.notes }),
        ...(receiptUrl && { receiptUrl }),
      },
    });

    return success(res, updated);
  }),
);
