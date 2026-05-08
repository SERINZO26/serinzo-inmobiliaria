import { Router } from 'express';
import { z } from 'zod';
import { ProjectStatus } from '../../lib/generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';

export const projectsRouter = Router();

// ── Validación ────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  title:        z.string().min(2),
  description:  z.string().optional(),
  slug:         z.string().min(2),
  location:     z.string().min(2),
  department:   z.string().optional(),
  priceFrom:    z.number().positive(),
  deliveryDate: z.string().optional(),
  status:       z.nativeEnum(ProjectStatus).optional(),
  photos:       z.array(z.string()).optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  featured:     z.boolean().optional(),
  published:    z.boolean().optional(),
});

// ── GET /api/v1/projects/public — proyectos publicados (sin auth) ─────────────
projectsRouter.get('/public', asyncHandler(async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { published: true, archived: false },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  });
  return success(res, projects);
}));

// ── GET /api/v1/projects — todos (requireAuth) ────────────────────────────────
projectsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const page  = parseInt(String(req.query.page  ?? '1'));
  const limit = parseInt(String(req.query.limit ?? '20'));
  const skip  = (page - 1) * limit;

  const where = { archived: false as const };
  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.project.count({ where }),
  ]);

  return success(res, projects, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
}));

// ── GET /api/v1/projects/:id — detalle (requireAuth) ─────────────────────────
projectsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.archived) return notFound(res, 'Proyecto no encontrado');
  return success(res, project);
}));

// ── POST /api/v1/projects — crear (requireAgentOrAdmin) ───────────────────────
projectsRouter.post('/', requireAgentOrAdmin, asyncHandler(async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 'Datos inválidos', 400);

  const { priceFrom, deliveryDate, ...rest } = parsed.data;
  const project = await prisma.project.create({
    data: {
      ...rest,
      priceFrom,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
    },
  });
  return success(res, project, 201);
}));

// ── PUT /api/v1/projects/:id — editar (requireAgentOrAdmin) ───────────────────
projectsRouter.put('/:id', requireAgentOrAdmin, asyncHandler(async (req, res) => {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return error(res, 'Datos inválidos', 400);

  const { priceFrom, deliveryDate, ...rest } = parsed.data;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(priceFrom !== undefined && { priceFrom }),
      ...(deliveryDate !== undefined && { deliveryDate: new Date(deliveryDate) }),
    },
  });
  return success(res, project);
}));

// ── DELETE /api/v1/projects/:id — archivar (requireAdmin) ─────────────────────
projectsRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.project.update({
    where: { id: req.params.id },
    data:  { archived: true, published: false },
  });
  return success(res, { message: 'Proyecto archivado' });
}));
