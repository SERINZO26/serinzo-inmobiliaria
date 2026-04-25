import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { generateToken, requireAuth } from '../../lib/auth';
import { success, error, asyncHandler } from '../../lib/response';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// POST /api/v1/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, parsed.error.errors[0].message, 400);
    }

    const { email, password } = parsed.data;

    // Mismo mensaje siempre: no revelar si el email existe o no (seguridad)
    const MSG_INVALIDO = 'Credenciales incorrectas';

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status === 'INACTIVE') {
      return error(res, MSG_INVALIDO, 401);
    }

    const passwordValida = await bcrypt.compare(password, user.password);
    if (!passwordValida) {
      return error(res, MSG_INVALIDO, 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

// GET /api/v1/auth/me
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        // Excluidos: password, googleCalendarRefreshToken
      },
    });

    if (!user) return error(res, 'Usuario no encontrado', 404);
    return success(res, user);
  })
);
