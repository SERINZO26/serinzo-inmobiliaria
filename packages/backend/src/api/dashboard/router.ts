import { Router } from 'express';
import { PropertyStatus, ClientStatus, AppointmentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';
import { success, asyncHandler } from '../../lib/response';

export const dashboardRouter = Router();

// GET /api/v1/dashboard/kpis
dashboardRouter.get(
  '/kpis',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const esAgente = user.role === 'AGENT';

    const filtroAgente = esAgente ? { assignedAgentId: user.id } : {};
    const filtroCitaAgente = esAgente ? { agentId: user.id } : {};

    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const [
      totalInmuebles,
      inmueblesDisponibles,
      clientesPorStatus,
      citasUltimos30Dias,
      citasRealizadas,
      citasCanceladas,
      conversacionesTotal,
    ] = await Promise.all([
      prisma.property.count({ where: { archived: false, ...filtroAgente } }),
      prisma.property.count({
        where: { archived: false, status: PropertyStatus.DISPONIBLE, ...filtroAgente },
      }),
      prisma.client.groupBy({
        by: ['status'],
        where: { archived: false, ...(esAgente ? { assignedAgentId: user.id } : {}) },
        _count: { status: true },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: hace30Dias }, ...filtroCitaAgente },
      }),
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: hace30Dias },
          status: AppointmentStatus.REALIZADA,
          ...filtroCitaAgente,
        },
      }),
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: hace30Dias },
          status: AppointmentStatus.CANCELADA,
          ...filtroCitaAgente,
        },
      }),
      prisma.conversation.count({
        where: {
          createdAt: { gte: hace30Dias },
          ...(esAgente ? { client: { assignedAgentId: user.id } } : {}),
        },
      }),
    ]);

    const porStatus = Object.fromEntries(
      clientesPorStatus.map(({ status, _count }) => [status, _count.status])
    );
    const totalClientes = Object.values(porStatus).reduce((a, b) => a + b, 0);
    const clientesCalificados =
      (porStatus[ClientStatus.CALIFICADO] ?? 0) +
      (porStatus[ClientStatus.VISITO] ?? 0) +
      (porStatus[ClientStatus.OFERTO] ?? 0) +
      (porStatus[ClientStatus.CERRADO] ?? 0);

    return success(res, {
      inmuebles: {
        total: totalInmuebles,
        disponibles: inmueblesDisponibles,
      },
      clientes: {
        total: totalClientes,
        porStatus,
        calificados: clientesCalificados,
      },
      citas: {
        ultimos30Dias: citasUltimos30Dias,
        realizadas: citasRealizadas,
        canceladas: citasCanceladas,
        tasaAsistencia:
          citasUltimos30Dias > 0
            ? Math.round((citasRealizadas / citasUltimos30Dias) * 100)
            : 0,
      },
      conversaciones: {
        ultimos30Dias: conversacionesTotal,
      },
    });
  })
);

// GET /api/v1/dashboard/kpis/history
dashboardRouter.get(
  '/kpis/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const dias = Math.min(90, Math.max(7, parseInt((req.query.days as string) || '30', 10)));
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const snapshots = await prisma.kpiSnapshot.findMany({
      where: { date: { gte: desde } },
      orderBy: { date: 'asc' },
    });

    return success(res, snapshots);
  })
);
