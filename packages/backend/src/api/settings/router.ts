/**
 * settings-router.ts — Configuración del sistema (singleton).
 *
 * GET  /api/v1/settings         — leer configuración (cualquier usuario auth)
 * PUT  /api/v1/settings         — actualizar datos de la empresa y del agente IA (solo admin)
 * PATCH /api/v1/settings/logo   — subir nuevo logo (solo admin)
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin } from '../../lib/auth';
import { success, error, asyncHandler } from '../../lib/response';
import { uploadImage } from '../../services/storage';

export const settingsRouter = Router();

// Multer para el logo (solo imágenes, máximo 2 MB)
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── Zod schema para PUT ──────────────────────────────────────────────────────

const settingsSchema = z.object({
  companyName:    z.string().min(1).max(120).optional(),
  companyPhone:   z.string().max(30).optional().nullable(),
  companyEmail:   z.string().email().max(120).optional().nullable(),
  companyAddress: z.string().max(200).optional().nullable(),
  companyCity:    z.string().max(80).optional().nullable(),
  agentName:      z.string().min(1).max(60).optional(),
  agentTone:      z.enum(['amigable', 'profesional', 'neutral']).optional(),
  agentWelcome:   z.string().max(500).optional().nullable(),
  // Preferencias de notificación
  notifyNewClient:           z.boolean().optional(),
  notifyHighInterest:        z.boolean().optional(),
  notifyAppointment:         z.boolean().optional(),
  notifyAppointmentReminder: z.boolean().optional(),
});

// ─── GET / ────────────────────────────────────────────────────────────────────

settingsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    // Upsert garantiza que siempre existe el registro singleton
    const settings = await prisma.settings.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
    return success(res, settings);
  }),
);

// ─── PATCH /logo — debe estar ANTES de PUT / para que Express no lo interprete mal ──

settingsRouter.patch(
  '/logo',
  requireAdmin,
  logoUpload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) return error(res, 'No se adjuntó ningún archivo de logo', 400);

    const result = await uploadImage(req.file.buffer, 'logo', `logo-${Date.now()}`);

    const settings = await prisma.settings.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton', companyLogoUrl: result.url },
      update: { companyLogoUrl: result.url },
    });

    return success(res, settings);
  }),
);

// ─── PUT / ────────────────────────────────────────────────────────────────────

settingsRouter.put(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const data = parsed.data;

    const settings = await prisma.settings.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });

    return success(res, settings);
  }),
);
