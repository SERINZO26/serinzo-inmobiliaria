import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Prisma, SaleStatus, PropertyStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { uploadImage } from '../../services/storage';

export const saleRouter = Router();

// Multer en memoria para el PDF del contrato/escritura (máximo 20 MB)
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Aceptar PDF e imágenes (algunos contratos son fotos escaneadas)
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createSaleSchema = z.object({
  propertyId:       z.string(),
  clientId:         z.string(),
  agentId:          z.string(),
  salePrice:        z.number().positive(),
  saleCurrency:     z.string().default('COP'),
  // Comisión como porcentaje (ej: 3.0 = 3%). Se calcula el monto automáticamente.
  commissionPct:    z.number().min(0).max(100).optional(),
  promiseDate:      z.string().transform((v) => new Date(v)).optional(),
  signDate:         z.string().transform((v) => new Date(v)).optional(),
  registrationDate: z.string().transform((v) => new Date(v)).optional(),
  status:           z.nativeEnum(SaleStatus).default(SaleStatus.BORRADOR),
  notes:            z.string().optional(),
  // Datos del vendedor (propietario que vende)
  sellerName:       z.string().optional(),
  sellerPhone:      z.string().optional(),
  sellerEmail:      z.string().email().optional(),
});

const editSaleSchema = createSaleSchema.partial().omit({ propertyId: true, clientId: true });

const statusSchema = z.object({
  status: z.nativeEnum(SaleStatus),
  notes:  z.string().optional(),
});

// ─── GET /api/v1/contracts/ventas ────────────────────────────────────────────

saleRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user  = req.user!;
    const page  = Math.max(1, parseInt((req.query.page  as string) || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const where: Prisma.SaleContractWhereInput = {};

    if (user.role === 'AGENT') where.agentId = user.id;

    if (req.query.status)     where.status     = req.query.status     as SaleStatus;
    if (req.query.propertyId) where.propertyId = req.query.propertyId as string;
    if (req.query.clientId)   where.clientId   = req.query.clientId   as string;
    if (req.query.agentId && user.role !== 'AGENT') where.agentId = req.query.agentId as string;

    const [contracts, total] = await Promise.all([
      prisma.saleContract.findMany({
        where,
        include: {
          property: { select: { id: true, title: true, address: true, city: true, photos: true } },
          client:   { select: { id: true, name: true, phone: true, email: true } },
          agent:    { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.saleContract.count({ where }),
    ]);

    return success(res, contracts, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

// ─── GET /api/v1/contracts/ventas/:id ────────────────────────────────────────

saleRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user  = req.user!;
    const where: Prisma.SaleContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const contract = await prisma.saleContract.findFirst({
      where,
      include: {
        property: {
          select: {
            id: true, title: true, address: true, city: true,
            photos: true, price: true, priceCurrency: true,
          },
        },
        client: true,
        agent:  { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!contract) return notFound(res, 'Contrato de venta');
    return success(res, contract);
  }),
);

// ─── POST /api/v1/contracts/ventas ───────────────────────────────────────────
// Crea el contrato de venta. Si el status es FIRMADO o REGISTRADO,
// cambia el inmueble a VENDIDO automáticamente.

saleRouter.post(
  '/',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createSaleSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const data = parsed.data;

    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) return notFound(res, 'Inmueble');

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) return notFound(res, 'Cliente');

    // Calcular monto de comisión si se especificó porcentaje
    const commissionAmount =
      data.commissionPct != null
        ? (data.salePrice * data.commissionPct) / 100
        : null;

    // Determinar si hay que marcar el inmueble como VENDIDO
    const marcarVendido =
      data.status === SaleStatus.FIRMADO || data.status === SaleStatus.REGISTRADO;

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.saleContract.create({
        data: {
          propertyId:       data.propertyId,
          clientId:         data.clientId,
          agentId:          data.agentId,
          salePrice:        new Prisma.Decimal(data.salePrice),
          saleCurrency:     data.saleCurrency,
          commissionPct:    data.commissionPct    != null ? new Prisma.Decimal(data.commissionPct)    : undefined,
          commissionAmount: commissionAmount      != null ? new Prisma.Decimal(commissionAmount)      : undefined,
          promiseDate:      data.promiseDate,
          signDate:         data.signDate,
          registrationDate: data.registrationDate,
          status:           data.status,
          notes:            data.notes,
          sellerName:       data.sellerName,
          sellerPhone:      data.sellerPhone,
          sellerEmail:      data.sellerEmail,
        },
      });

      if (marcarVendido) {
        await tx.property.update({
          where: { id: data.propertyId },
          data:  { status: PropertyStatus.VENDIDO },
        });
      }

      return created;
    });

    const full = await prisma.saleContract.findUnique({
      where:   { id: contract.id },
      include: {
        property: { select: { id: true, title: true, address: true, city: true } },
        client:   { select: { id: true, name: true, phone: true, email: true } },
        agent:    { select: { id: true, name: true } },
      },
    });

    return success(res, full, 201);
  }),
);

// ─── PUT /api/v1/contracts/ventas/:id ────────────────────────────────────────
// Edita el contrato. Recalcula commissionAmount si cambia precio o commissionPct.

saleRouter.put(
  '/:id',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user   = req.user!;
    const parsed = editSaleSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const where: Prisma.SaleContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.saleContract.findFirst({ where });
    if (!existing) return notFound(res, 'Contrato de venta');

    if (existing.status === SaleStatus.CANCELADO)
      return error(res, 'No se puede editar un contrato cancelado', 400);

    const data = parsed.data;

    // Recalcular monto de comisión si cambia precio o porcentaje
    const newPrice      = data.salePrice     ?? Number(existing.salePrice);
    const newCommPct    = data.commissionPct !== undefined ? data.commissionPct : Number(existing.commissionPct);
    const newCommAmount = newCommPct != null ? (newPrice * newCommPct) / 100 : null;

    // Si el nuevo status indica venta finalizada, marcar el inmueble como VENDIDO
    // Determinar transiciones de estado del inmueble según el nuevo status solicitado
    const marcarVendido =
      (data.status === SaleStatus.FIRMADO || data.status === SaleStatus.REGISTRADO) &&
      existing.status !== SaleStatus.FIRMADO &&
      existing.status !== SaleStatus.REGISTRADO;

    // Si el contrato pasa a CANCELADO, liberar el inmueble (existing.status != CANCELADO por el guard anterior)
    const marcarDisponible = data.status === SaleStatus.CANCELADO;

    const updated = await prisma.$transaction(async (tx) => {
      const contract = await tx.saleContract.update({
        where: { id: existing.id },
        data: {
          ...(data.agentId          && { agentId:          data.agentId }),
          ...(data.salePrice     != null && { salePrice:     new Prisma.Decimal(data.salePrice) }),
          ...(data.saleCurrency     && { saleCurrency:     data.saleCurrency }),
          ...(data.commissionPct != null && { commissionPct:  new Prisma.Decimal(data.commissionPct) }),
          commissionAmount: newCommAmount != null ? new Prisma.Decimal(newCommAmount) : undefined,
          ...(data.promiseDate      && { promiseDate:      data.promiseDate }),
          ...(data.signDate         && { signDate:         data.signDate }),
          ...(data.registrationDate && { registrationDate: data.registrationDate }),
          ...(data.status           != null && { status:           data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.sellerName  !== undefined && { sellerName:  data.sellerName }),
          ...(data.sellerPhone !== undefined && { sellerPhone: data.sellerPhone }),
          ...(data.sellerEmail !== undefined && { sellerEmail: data.sellerEmail }),
        },
      });

      if (marcarVendido) {
        await tx.property.update({
          where: { id: existing.propertyId },
          data:  { status: PropertyStatus.VENDIDO },
        });
      }

      if (marcarDisponible) {
        await tx.property.update({
          where: { id: existing.propertyId },
          data:  { status: PropertyStatus.DISPONIBLE },
        });
      }

      return contract;
    });

    const full = await prisma.saleContract.findUnique({
      where:   { id: updated.id },
      include: {
        property: { select: { id: true, title: true } },
        client:   { select: { id: true, name: true } },
        agent:    { select: { id: true, name: true } },
      },
    });

    return success(res, full);
  }),
);

// ─── PATCH /api/v1/contracts/ventas/:id/estado ───────────────────────────────
// Cambia solo el estado del contrato (avance rápido en el flujo de venta).
// Aplica la misma lógica de actualización del inmueble que el PUT.

saleRouter.patch(
  '/:id/estado',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user   = req.user!;
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const where: Prisma.SaleContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.saleContract.findFirst({ where });
    if (!existing) return notFound(res, 'Contrato de venta');

    if (existing.status === SaleStatus.CANCELADO && parsed.data.status !== SaleStatus.CANCELADO)
      return error(res, 'Un contrato cancelado no puede cambiar de estado', 400);

    const { status, notes } = parsed.data;

    const marcarVendido =
      (status === SaleStatus.FIRMADO || status === SaleStatus.REGISTRADO) &&
      existing.status !== SaleStatus.FIRMADO &&
      existing.status !== SaleStatus.REGISTRADO;

    const marcarDisponible =
      status === SaleStatus.CANCELADO && existing.status !== SaleStatus.CANCELADO;

    await prisma.$transaction(async (tx) => {
      await tx.saleContract.update({
        where: { id: existing.id },
        data:  { status, ...(notes !== undefined && { notes }) },
      });

      if (marcarVendido) {
        await tx.property.update({
          where: { id: existing.propertyId },
          data:  { status: PropertyStatus.VENDIDO },
        });
      }

      if (marcarDisponible) {
        await tx.property.update({
          where: { id: existing.propertyId },
          data:  { status: PropertyStatus.DISPONIBLE },
        });
      }
    });

    return success(res, {
      id:     existing.id,
      status,
      ...(notes !== undefined && { notes }),
    });
  }),
);

// ─── PATCH /api/v1/contracts/ventas/:id/pdf ──────────────────────────────────
// Sube o reemplaza el documento PDF/imagen del contrato a Cloudinary.

saleRouter.patch(
  '/:id/pdf',
  requireAgentOrAdmin,
  uploadPdf.single('documento'),
  asyncHandler(async (req, res) => {
    const user  = req.user!;
    const where: Prisma.SaleContractWhereInput = { id: req.params.id };
    if (user.role === 'AGENT') where.agentId = user.id;

    const existing = await prisma.saleContract.findFirst({ where });
    if (!existing) return notFound(res, 'Contrato de venta');

    if (!req.file) return error(res, 'Debes adjuntar un archivo (PDF o imagen)', 400);

    const filename = `contrato-venta-${Date.now()}`;
    const result   = await uploadImage(req.file.buffer, `contratos-venta/${existing.id}`, filename);

    const updated = await prisma.saleContract.update({
      where: { id: existing.id },
      data:  { pdfUrl: result.url },
      select: { id: true, pdfUrl: true, status: true },
    });

    return success(res, updated);
  }),
);
