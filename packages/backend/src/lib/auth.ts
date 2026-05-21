import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { Role } from '@prisma/client';

export interface JwtPayload {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// Extiende el tipo de Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);
  if (!token) {
    res
      .status(401)
      .json({ success: false, error: 'Token de autenticación requerido' });
    return;
  }
  try {
    req.user = jwt.verify(token, env.API_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  requireAuth(req, res, () => {
    if (req.user?.role !== Role.ADMIN) {
      res
        .status(403)
        .json({ success: false, error: 'Acceso restringido a administradores' });
      return;
    }
    next();
  });
};

export const requireAgentOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  requireAuth(req, res, () => {
    if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.AGENT) {
      res.status(403).json({
        success: false,
        error: 'Acceso restringido a agentes y administradores',
      });
      return;
    }
    next();
  });
};

export const generateToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.API_SECRET, { expiresIn: '8h' });
