import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { requireAdmin } from '../../lib/auth';
import { success, error, notFound, asyncHandler } from '../../lib/response';
import { Role } from '../../lib/generated/prisma';

export const staffRouter = Router();

// Campos que nunca se devuelven al cliente
const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  // Excluidos: password, googleCalendarRefreshToken
};

const createSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  role: z.enum([Role.ADMIN, Role.AGENT, Role.ASSISTANT], {
    errorMap: () => ({ message: 'Rol inválido' }),
  }),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const editSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum([Role.ADMIN, Role.AGENT, Role.ASSISTANT]).optional(),
});

// GET /api/v1/staff — lista de usuarios internos
// Por defecto solo devuelve usuarios ACTIVOS. Pasar ?includeInactive=true para ver todos.
staffRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { role, status, includeInactive } = req.query as {
      role?: string;
      status?: string;
      includeInactive?: string;
    };

    const where: Record<string, unknown> = {};

    if (role && Object.values(Role).includes(role as Role)) {
      where.role = role as Role;
    }

    // Filtro de status: si se pasa explícitamente se usa ese valor.
    // Si no se pasa y tampoco includeInactive=true, filtra solo ACTIVE por defecto.
    // Esto evita que usuarios INACTIVE aparezcan en los selectores del panel.
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.status = status;
    } else if (includeInactive !== 'true') {
      where.status = 'ACTIVE';
    }

    const users = await prisma.user.findMany({
      where,
      select: SAFE_SELECT,
      orderBy: { name: 'asc' },
    });

    return success(res, users, 200, { total: users.length });
  })
);

// POST /api/v1/staff — crear usuario
staffRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, parsed.error.errors[0].message, 400);
    }

    const { name, email, phone, role, password } = parsed.data;

    // Verificar que el email no esté en uso
    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      return error(res, 'Ya existe un usuario con ese email', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        role,
        password: hashedPassword,
        status: 'ACTIVE',
      },
      select: SAFE_SELECT,
    });

    // Los agentes reciben disponibilidad L-V 08:00-18:00 por defecto al crearse,
    // para que el sistema les permita recibir citas desde el primer día.
    if (role === Role.AGENT) {
      await prisma.availability.createMany({
        data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          userId: user.id,
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
          isBlocked: false,
        })),
      });
    }

    return success(res, user);
  })
);

// PATCH /api/v1/staff/:id — editar datos del usuario
staffRouter.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, parsed.error.errors[0].message, 400);
    }

    const existente = await prisma.user.findUnique({ where: { id } });
    if (!existente) return notFound(res, 'Usuario');

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      },
      select: SAFE_SELECT,
    });

    return success(res, user);
  })
);

// PATCH /api/v1/staff/:id/status — activar o desactivar
staffRouter.patch(
  '/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Un admin no puede desactivarse a sí mismo
    if (req.user!.id === id) {
      return error(res, 'No puedes desactivar tu propia cuenta', 400);
    }

    const existente = await prisma.user.findUnique({ where: { id } });
    if (!existente) return notFound(res, 'Usuario');

    // Alterna entre ACTIVE e INACTIVE
    const nuevoStatus = existente.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const user = await prisma.user.update({
      where: { id },
      data: { status: nuevoStatus },
      select: SAFE_SELECT,
    });

    return success(res, user);
  })
);
