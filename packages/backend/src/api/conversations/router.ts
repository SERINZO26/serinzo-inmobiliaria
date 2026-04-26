/**
 * conversations/router.ts — Historial de conversaciones con el agente IA.
 *
 * Endpoints:
 *   GET  /api/v1/conversations        — listado paginado con filtros
 *   GET  /api/v1/conversations/:id    — detalle con transcript completo
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

export const conversationsRouter = Router();

// Aplicar autenticación a todas las rutas
conversationsRouter.use(requireAuth);

// ─── GET /api/v1/conversations ────────────────────────────────────────────────

conversationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      channel,
      outcome,
      interestLevel,
      search,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (channel)       where.channel = channel.toUpperCase();
    if (outcome)       where.outcome = outcome;
    if (interestLevel) where.interestDetected = parseInt(interestLevel, 10);

    // Búsqueda por nombre del cliente
    if (search?.trim()) {
      where.client = { name: { contains: search.trim(), mode: 'insensitive' } };
    }

    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where: where as any }),
      prisma.conversation.findMany({
        where: where as any,
        skip,
        take: limitNum,
        orderBy: { startedAt: 'desc' },
        select: {
          id:               true,
          channel:          true,
          startedAt:        true,
          endedAt:          true,
          durationSeconds:  true,
          summary:          true,
          interestDetected: true,
          interestOverride: true,
          topics:           true,
          outcome:          true,
          recordingUrl:     true,
          client: {
            select: { id: true, name: true, phone: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: conversations,
      meta: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[conversations] Error listando conversaciones:', err);
    res.status(500).json({ success: false, error: 'Error al obtener conversaciones' });
  }
});

// ─── GET /api/v1/conversations/:id ───────────────────────────────────────────

conversationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        turns: {
          orderBy: { timestamp: 'asc' },
          select: {
            id:            true,
            role:          true,
            content:       true,
            timestamp:     true,
            intentDetected: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversación no encontrada' });
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    console.error('[conversations] Error obteniendo conversación:', err);
    res.status(500).json({ success: false, error: 'Error al obtener la conversación' });
  }
});
