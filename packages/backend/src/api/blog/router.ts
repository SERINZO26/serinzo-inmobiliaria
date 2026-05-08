import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin, requireAgentOrAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';

export const blogRouter = Router();

// ── Validación ────────────────────────────────────────────────────────────────

const blogSchema = z.object({
  title:         z.string().min(2),
  slug:          z.string().min(2),
  excerpt:       z.string().optional(),
  content:       z.string().min(10),
  coverImageUrl: z.string().url().optional(),
  published:     z.boolean().optional(),
});

// ── GET /api/v1/blog — posts publicados (sin auth) ────────────────────────────
blogRouter.get('/', asyncHandler(async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    where:   { published: true },
    select:  { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, createdAt: true,
               author: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, posts);
}));

// ── GET /api/v1/blog/admin — todos (requireAuth) — DEBE IR ANTES de /:slug ────
blogRouter.get('/admin', requireAuth, asyncHandler(async (req, res) => {
  const page  = parseInt(String(req.query.page  ?? '1'));
  const limit = parseInt(String(req.query.limit ?? '20'));
  const skip  = (page - 1) * limit;

  const [posts, total] = await prisma.$transaction([
    prisma.blogPost.findMany({
      skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true } } },
    }),
    prisma.blogPost.count(),
  ]);
  return success(res, posts, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
}));

// ── GET /api/v1/blog/:slug — detalle público ──────────────────────────────────
blogRouter.get('/:slug', asyncHandler(async (req, res) => {
  const post = await prisma.blogPost.findUnique({
    where:   { slug: req.params.slug },
    include: { author: { select: { name: true } } },
  });
  if (!post || !post.published) return notFound(res, 'Artículo no encontrado');
  return success(res, post);
}));

// ── POST /api/v1/blog — crear (requireAgentOrAdmin) ───────────────────────────
blogRouter.post('/', requireAgentOrAdmin, asyncHandler(async (req, res) => {
  const parsed = blogSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 'Datos inválidos', 400);

  const user  = (req as any).user;
  const post  = await prisma.blogPost.create({
    data: { ...parsed.data, authorId: user?.id },
  });
  return success(res, post, 201);
}));

// ── PUT /api/v1/blog/:id — editar (requireAgentOrAdmin) ───────────────────────
blogRouter.put('/:id', requireAgentOrAdmin, asyncHandler(async (req, res) => {
  const parsed = blogSchema.partial().safeParse(req.body);
  if (!parsed.success) return error(res, 'Datos inválidos', 400);

  const post = await prisma.blogPost.update({
    where: { id: req.params.id },
    data:  parsed.data,
  });
  return success(res, post);
}));

// ── DELETE /api/v1/blog/:id — archivar lógicamente (requireAdmin) ─────────────
blogRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.blogPost.update({
    where: { id: req.params.id },
    data:  { published: false },
  });
  return success(res, { message: 'Artículo despublicado' });
}));
