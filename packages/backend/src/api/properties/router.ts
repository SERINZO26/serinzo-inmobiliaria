import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Prisma, PropertyType, Operation, PropertyStatus } from '../../lib/generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { uploadMultipleImages, deleteImage, extractPublicId } from '../../services/storage';

export const propertiesRouter = Router();

// Campos visibles en el sitio público — NUNCA incluyen datos del propietario (regla de negocio 1)
const PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  slug: true,
  type: true,
  operation: true,
  price: true,
  priceCurrency: true,
  priceNegotiable: true,
  administrationFee: true,
  areaTotalM2: true,
  areaBuiltM2: true,
  bedrooms: true,
  bathrooms: true,
  halfBathrooms: true,
  parking: true,
  floor: true,
  totalFloors: true,
  ageYears: true,
  strata: true,
  address: true,
  city: true,
  neighborhood: true,
  department: true,
  lat: true,
  lng: true,
  photos: true,
  videos: true,
  virtualTourUrl: true,
  floorPlanUrl: true,
  status: true,
  featured: true,
  visitDays: true,
  visitTimeSlots: true,
  visitSpecialInstructions: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  features: { select: { id: true, category: true, name: true, value: true } },
  assignedAgent: { select: { id: true, name: true, phone: true } },
};

const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const generateSlug = (title: string, city: string, type: string) =>
  `${normalize(type)}-${normalize(title)}-${normalize(city)}`.substring(0, 120);

const ensureUniqueSlug = async (base: string, excludeId?: string): Promise<string> => {
  let slug = base;
  let n = 0;
  while (true) {
    const exists = await prisma.property.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (!exists) return slug;
    slug = `${base}-${++n}`;
  }
};

// ─── RUTAS PÚBLICAS (sin auth) ────────────────────────────────────────────────

// GET /api/v1/properties/public
propertiesRouter.get(
  '/public',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '12', 10)));

    const where: Prisma.PropertyWhereInput = {
      published: true,
      archived: false,
      status: PropertyStatus.DISPONIBLE,
    };

    if (req.query.type) where.type = req.query.type as PropertyType;
    if (req.query.operation) where.operation = req.query.operation as Operation;
    if (req.query.city)
      where.city = { contains: req.query.city as string, mode: 'insensitive' };
    if (req.query.bedrooms)
      where.bedrooms = { gte: parseInt(req.query.bedrooms as string, 10) };
    if (req.query.minBedrooms)
      where.bedrooms = { gte: parseInt(req.query.minBedrooms as string, 10) };
    if (req.query.minBathrooms)
      where.bathrooms = { gte: parseInt(req.query.minBathrooms as string, 10) };
    if (req.query.minParking)
      where.parking = { gte: parseInt(req.query.minParking as string, 10) };

    const priceFilter: Prisma.DecimalFilter = {};
    if (req.query.minPrice) priceFilter.gte = parseFloat(req.query.minPrice as string);
    if (req.query.maxPrice) priceFilter.lte = parseFloat(req.query.maxPrice as string);
    if (Object.keys(priceFilter).length) where.price = priceFilter;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return success(res, properties, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// GET /api/v1/properties/public/:slug
propertiesRouter.get(
  '/public/:slug',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findFirst({
      where: { slug: req.params.slug, published: true, archived: false },
      select: PUBLIC_SELECT,
    });
    if (!property) return notFound(res, 'Inmueble');
    return success(res, property);
  })
);

// ─── RUTAS PRIVADAS (requireAuth) ─────────────────────────────────────────────

// GET /api/v1/properties
propertiesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const where: Prisma.PropertyWhereInput = { archived: false };

    // Agente solo ve sus inmuebles asignados
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    if (req.query.status) where.status = req.query.status as PropertyStatus;
    if (req.query.type) where.type = req.query.type as PropertyType;
    if (req.query.operation) where.operation = req.query.operation as Operation;
    if (req.query.city)
      where.city = { contains: req.query.city as string, mode: 'insensitive' };
    if (req.query.published !== undefined)
      where.published = req.query.published === 'true';
    if (req.query.featured !== undefined)
      where.featured = req.query.featured === 'true';
    if (req.query.assignedAgentId && user.role !== 'AGENT')
      where.assignedAgentId = req.query.assignedAgentId as string;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        select: {
          ...PUBLIC_SELECT,
          ownerName: true,
          ownerPhone: true,
          ownerEmail: true,
          ownerNotes: true,
          published: true,
          archived: true,
          source: true,
          addedById: true,
          assignedAgentId: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return success(res, properties, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// GET /api/v1/properties/:id
propertiesRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where: Prisma.PropertyWhereInput = {
      id: req.params.id,
      archived: false,
    };
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    const property = await prisma.property.findFirst({
      where,
      include: {
        features: true,
        assignedAgent: { select: { id: true, name: true, phone: true, email: true } },
        addedBy: { select: { id: true, name: true } },
        appointments: {
          where: { status: { not: 'CANCELADA' } },
          select: { id: true, scheduledAt: true, status: true, clientId: true },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        },
      },
    });

    if (!property) return notFound(res, 'Inmueble');
    return success(res, property);
  })
);

// NOTA: El frontend envía `null` para campos opcionales vacíos (comportamiento
// estándar de JSON). Zod `.optional()` solo acepta `undefined`, no `null`.
// Por eso todos los campos opcionales usan `.nullish()` = nullable + optional,
// que acepta el valor esperado, `null` o `undefined` indistintamente.
const propertySchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  type: z.nativeEnum(PropertyType),
  operation: z.nativeEnum(Operation),
  price: z.number().positive('El precio debe ser mayor a 0'),
  priceCurrency: z.string().default('COP'),
  priceNegotiable: z.boolean().default(false),
  administrationFee: z.number().nullish(),
  areaTotalM2: z.number().positive().nullish(),
  areaBuiltM2: z.number().positive().nullish(),
  bedrooms: z.number().int().min(0).nullish(),
  bathrooms: z.number().int().min(0).nullish(),
  halfBathrooms: z.number().int().min(0).nullish(),
  parking: z.number().int().min(0).nullish(),
  floor: z.number().int().nullish(),
  totalFloors: z.number().int().nullish(),
  ageYears: z.number().int().min(0).nullish(),
  strata: z.number().int().min(0).max(6).nullish(),
  address: z.string().min(5),
  city: z.string().min(2),
  neighborhood: z.string().nullish(),
  department: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  photos: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
  virtualTourUrl: z.string().url().nullish().or(z.literal('')),
  floorPlanUrl: z.string().url().nullish().or(z.literal('')),
  ownerName: z.string().nullish(),
  ownerPhone: z.string().nullish(),
  ownerEmail: z.string().email().nullish().or(z.literal('')),
  ownerNotes: z.string().nullish(),
  visitDays: z.array(z.string()).default([]),
  visitTimeSlots: z.any().optional(),
  visitSpecialInstructions: z.string().nullish(),
  assignedAgentId: z.string().nullish(),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
});

// POST /api/v1/properties
propertiesRouter.post(
  '/',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const parsed = propertySchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const { price, lat, lng, administrationFee, areaTotalM2, areaBuiltM2, ...rest } =
      parsed.data;

    const baseSlug = generateSlug(rest.title, rest.city, rest.type);
    const slug = await ensureUniqueSlug(baseSlug);

    const property = await prisma.property.create({
      data: {
        ...rest,
        slug,
        price,
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(administrationFee !== undefined && { administrationFee }),
        ...(areaTotalM2 !== undefined && { areaTotalM2 }),
        ...(areaBuiltM2 !== undefined && { areaBuiltM2 }),
        addedById: req.user!.id,
        assignedAgentId: rest.assignedAgentId || req.user!.id,
      },
      include: { features: true },
    });

    return success(res, property, 201);
  })
);

// PUT /api/v1/properties/:id
propertiesRouter.put(
  '/:id',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where: Prisma.PropertyWhereInput = {
      id: req.params.id,
      archived: false,
    };
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    const existing = await prisma.property.findFirst({ where });
    if (!existing) return notFound(res, 'Inmueble');

    const parsed = propertySchema.partial().safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const data = parsed.data;
    let slug = existing.slug;
    if (data.title && data.title !== existing.title) {
      const base = generateSlug(
        data.title,
        data.city || existing.city,
        data.type || existing.type
      );
      slug = await ensureUniqueSlug(base, existing.id);
    }

    const updated = await prisma.property.update({
      where: { id: existing.id },
      data: { ...data, slug },
      include: { features: true },
    });

    return success(res, updated);
  })
);

// PATCH /api/v1/properties/:id/status
propertiesRouter.patch(
  '/:id/status',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { status } = req.body as { status: PropertyStatus };

    if (!Object.values(PropertyStatus).includes(status))
      return error(res, 'Estado de inmueble inválido', 400);

    const where: Prisma.PropertyWhereInput = { id: req.params.id, archived: false };
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    const existing = await prisma.property.findFirst({ where });
    if (!existing) return notFound(res, 'Inmueble');

    const updated = await prisma.property.update({
      where: { id: existing.id },
      data: { status },
      select: { id: true, status: true },
    });

    return success(res, updated);
  })
);

// PATCH /api/v1/properties/:id/publish
propertiesRouter.patch(
  '/:id/publish',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where: Prisma.PropertyWhereInput = { id: req.params.id, archived: false };
    if (user.role === 'AGENT') where.assignedAgentId = user.id;

    const existing = await prisma.property.findFirst({ where });
    if (!existing) return notFound(res, 'Inmueble');

    const updated = await prisma.property.update({
      where: { id: existing.id },
      data: { published: !existing.published },
      select: { id: true, published: true },
    });

    return success(res, updated);
  })
);

// DELETE /api/v1/properties/:id — soft delete, nunca eliminar (regla de negocio 2)
propertiesRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, archived: false },
    });
    if (!existing) return notFound(res, 'Inmueble');

    await prisma.property.update({
      where: { id: existing.id },
      data: { archived: true, published: false },
    });

    return success(res, { message: 'Inmueble archivado correctamente' });
  })
);

// ─── FOTOS ────────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no permitido: ${file.mimetype}. Solo JPEG, PNG y WebP.`));
    }
  },
});

// POST /api/v1/properties/:id/photos
propertiesRouter.post(
  '/:id/photos',
  requireAgentOrAdmin,
  photoUpload.array('photos', 10),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0)
      return error(res, 'No se recibieron archivos. Envía el campo "photos" con al menos una imagen.', 400);

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, archived: false },
      select: { id: true, photos: true },
    });
    if (!property) return notFound(res, 'Inmueble');

    // Subir a Cloudinary en paralelo — carpeta = ID del inmueble
    const uploaded = await uploadMultipleImages(files, property.id);
    const newUrls  = uploaded.map((u) => u.url);

    // Agregar las nuevas URLs al array existente de fotos en la BD
    const updated = await prisma.property.update({
      where: { id: property.id },
      data:  { photos: [...property.photos, ...newUrls] },
      select: { id: true, photos: true },
    });

    console.log(`[properties] ${newUrls.length} foto(s) subidas al inmueble ${property.id}`);

    return success(res, {
      photos: updated.photos,
      added:  newUrls,
    }, 201);
  })
);

// DELETE /api/v1/properties/:id/photos
propertiesRouter.delete(
  '/:id/photos',
  requireAgentOrAdmin,
  asyncHandler(async (req, res) => {
    const { photoUrl } = req.body as { photoUrl?: string };
    if (!photoUrl) return error(res, 'El campo photoUrl es requerido', 400);

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, archived: false },
      select: { id: true, photos: true },
    });
    if (!property) return notFound(res, 'Inmueble');

    if (!property.photos.includes(photoUrl))
      return error(res, 'La foto indicada no pertenece a este inmueble', 400);

    // Eliminar de Cloudinary (no bloquea aunque falle)
    const publicId = extractPublicId(photoUrl);
    if (publicId) {
      await deleteImage(publicId);
    }

    // Quitar la URL del array en BD
    const updated = await prisma.property.update({
      where: { id: property.id },
      data:  { photos: property.photos.filter((p) => p !== photoUrl) },
      select: { id: true, photos: true },
    });

    console.log(`[properties] Foto eliminada del inmueble ${property.id}: ${publicId ?? photoUrl}`);

    return success(res, { photos: updated.photos });
  })
);
