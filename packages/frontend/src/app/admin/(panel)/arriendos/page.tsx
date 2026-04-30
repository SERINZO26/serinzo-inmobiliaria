'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText, Plus, AlertTriangle, Bell, TrendingUp, Building2,
  Eye, RefreshCw, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { rentalApi, type RentalContract, type RentalContractStatus } from '@/lib/api';
import { formatPrice, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: RentalContractStatus) {
  const map: Record<RentalContractStatus, string> = {
    ACTIVO:   'bg-green-100 text-green-800 border-green-200',
    VENCIDO:  'bg-red-100 text-red-800 border-red-200',
    RENOVADO: 'bg-blue-100 text-blue-800 border-blue-200',
    BORRADOR: 'bg-slate-100 text-slate-700 border-slate-200',
    CANCELADO:'bg-gray-100 text-gray-600 border-gray-200',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function statusLabel(status: RentalContractStatus) {
  const map: Record<RentalContractStatus, string> = {
    ACTIVO: 'Activo', VENCIDO: 'Vencido', RENOVADO: 'Renovado',
    BORRADOR: 'Borrador', CANCELADO: 'Cancelado',
  };
  return map[status] ?? status;
}

function weeksUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24 * 7));
}

/** Horizonte de 10 días para badge "Pago próximo" */
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

function paymentBadge(payments?: Array<{ status: string; dueDate: string }>) {
  if (!payments) return null;
  const now = Date.now();

  // "Pago atrasado": cuota VENCIDO (marcada por el cron diario)
  const atrasado = payments.some((p) => p.status === 'VENCIDO');
  if (atrasado) return 'atrasado' as const;

  // "Pago próximo": cuota PENDIENTE cuyo vencimiento es en ≤ 10 días
  const proximo = payments.some(
    (p) => p.status === 'PENDIENTE' && new Date(p.dueDate).getTime() - now <= TEN_DAYS_MS,
  );
  if (proximo) return 'proximo' as const;

  return null;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiBox({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl', color.includes('red') ? 'bg-red-50' : color.includes('orange') ? 'bg-orange-50' : color.includes('green') ? 'bg-green-50' : 'bg-blue-50')}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArriendosPage() {
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [soloProximos, setSoloProximos] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['arriendos', page, statusFilter],
    queryFn: async () => (await rentalApi.getAll({
      page,
      limit: 20,
      ...(statusFilter && { status: statusFilter }),
    })).data,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['rental-alerts'],
    queryFn: async () => (await rentalApi.getAlerts()).data.data,
    staleTime: 5 * 60 * 1000,
  });

  const contratos: RentalContract[] = data?.data ?? [];
  const meta = data?.meta;
  const alerts = alertsData ?? [];

  // KPIs calculados desde los datos cargados
  const activos   = contratos.filter((c) => c.status === 'ACTIVO').length;
  const proximosBadge = alerts.length;
  const canonTotal = contratos
    .filter((c) => c.status === 'ACTIVO')
    .reduce((sum, c) => sum + Number(c.monthlyRent), 0);

  // Pagos pendientes este mes: aproximación por contratos activos sin última cuota pagada
  const pendientesEsteMes = contratos.filter(
    (c) => c.status === 'ACTIVO' && c.payments?.some((p) => p.status === 'PENDIENTE'),
  ).length;

  const displayContracts = soloProximos
    ? contratos.filter((c) => c.status === 'ACTIVO' && weeksUntil(c.endDate) <= 15)
    : contratos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contratos de Arriendo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de arrendamientos activos y vencidos</p>
        </div>
        <Link href="/admin/arriendos/nuevo">
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" />
            Nuevo contrato
          </Button>
        </Link>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox
          label="Contratos activos"
          value={isLoading ? '–' : activos}
          color="text-blue-700"
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        />
        <KpiBox
          label="Vencen pronto"
          value={isLoading ? '–' : proximosBadge}
          sub="en menos de 15 semanas"
          color="text-red-700"
          icon={<Bell className="h-5 w-5 text-red-500" />}
        />
        <KpiBox
          label="Pagos pendientes"
          value={isLoading ? '–' : pendientesEsteMes}
          sub="contratos con cuota pendiente"
          color="text-orange-700"
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
        />
        <KpiBox
          label="Canon mensual total"
          value={isLoading ? '–' : formatPrice(canonTotal, 'COP')}
          sub="contratos activos"
          color="text-green-700"
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="VENCIDO">Vencido</option>
          <option value="RENOVADO">Renovado</option>
          <option value="CANCELADO">Cancelado</option>
          <option value="BORRADOR">Borrador</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloProximos}
            onChange={(e) => setSoloProximos(e.target.checked)}
            className="rounded accent-green-600"
          />
          Solo próximos a vencer
        </label>

        {(statusFilter || soloProximos) && (
          <button
            onClick={() => { setStatusFilter(''); setSoloProximos(false); setPage(1); }}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Inmueble</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Arrendatario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fin</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Canon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Agente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && displayContracts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No hay contratos que mostrar</p>
                  </td>
                </tr>
              )}

              {displayContracts.map((c) => {
                const weeks   = weeksUntil(c.endDate);
                const isAlert = c.status === 'ACTIVO' && weeks <= 15 && weeks >= 0;
                const badge   = c.status === 'ACTIVO' ? paymentBadge(c.payments as Array<{ status: string; dueDate: string }>) : null;
                return (
                  <tr key={c.id} className={cn('hover:bg-slate-50 transition-colors', isAlert && 'bg-red-50/40')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isAlert && (
                          <span title={`Vence en ${weeks} semana(s) — contactar propietario y arrendatario`}>
                            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-slate-800 truncate max-w-[160px]">{c.property?.title ?? '–'}</p>
                          <p className="text-xs text-slate-400">{c.property?.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{c.client?.name ?? '–'}</p>
                      <p className="text-xs text-slate-400">{c.client?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatShortDate(c.startDate)}</td>
                    <td className="px-4 py-3">
                      <p className={cn('text-slate-600', isAlert && 'font-semibold text-red-600')}>
                        {formatShortDate(c.endDate)}
                      </p>
                      {isAlert && (
                        <p className="text-[10px] text-red-500">{weeks} sem. restantes</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatPrice(Number(c.monthlyRent), c.rentCurrency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit', statusColor(c.status))}>
                          {statusLabel(c.status)}
                        </span>
                        {badge === 'atrasado' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 w-fit">
                            Pago atrasado
                          </span>
                        )}
                        {badge === 'proximo' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 w-fit">
                            Pago próximo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{c.agent?.name ?? '–'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/arriendos/${c.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver detalle">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {c.status === 'ACTIVO' && (
                          <Link href={`/admin/arriendos/${c.id}?accion=renovar`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" title="Renovar">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              {meta.total} contrato{meta.total !== 1 ? 's' : ''} · página {meta.page} de {meta.totalPages}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 w-7 p-0">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)} className="h-7 w-7 p-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
