'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  DollarSign, Plus, TrendingUp, Clock, CheckCircle2,
  Eye, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { saleApi, type SaleContract, type SaleStatus } from '@/lib/api';
import { formatPrice, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function saleStatusColor(status: SaleStatus) {
  const map: Record<SaleStatus, string> = {
    BORRADOR:   'bg-slate-100 text-slate-600 border-slate-200',
    EN_PROCESO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    FIRMADO:    'bg-blue-100 text-blue-800 border-blue-200',
    REGISTRADO: 'bg-green-100 text-green-800 border-green-200',
    CANCELADO:  'bg-gray-100 text-gray-500 border-gray-200',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function saleStatusLabel(status: SaleStatus) {
  const map: Record<SaleStatus, string> = {
    BORRADOR: 'Borrador', EN_PROCESO: 'En proceso',
    FIRMADO: 'Firmado', REGISTRADO: 'Registrado', CANCELADO: 'Cancelado',
  };
  return map[status] ?? status;
}

function KpiBox({ label, value, sub, colorClass, icon }: {
  label: string; value: string | number; sub?: string; colorClass: string; icon: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={cn('text-2xl font-bold mt-1', colorClass)}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('p-2.5 rounded-xl', colorClass.includes('green') ? 'bg-green-50' : colorClass.includes('yellow') ? 'bg-yellow-50' : 'bg-blue-50')}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VentasPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ventas', page, statusFilter],
    queryFn: async () => (await saleApi.getAll({
      page, limit: 20,
      ...(statusFilter && { status: statusFilter }),
    })).data,
  });

  const contratos: SaleContract[] = data?.data ?? [];
  const meta = data?.meta;

  const thisYear = new Date().getFullYear();
  const completadas = contratos.filter((c) => c.status === 'REGISTRADO' || c.status === 'FIRMADO').length;
  const enProceso   = contratos.filter((c) => c.status === 'EN_PROCESO').length;
  const comisionAnual = contratos
    .filter((c) => new Date(c.createdAt).getFullYear() === thisYear && c.commissionAmount)
    .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contratos de Venta</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de ventas de inmuebles</p>
        </div>
        <Link href="/admin/ventas/nuevo">
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiBox label="Ventas completadas" value={isLoading ? '–' : completadas}
          colorClass="text-green-700" icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        <KpiBox label="En proceso" value={isLoading ? '–' : enProceso}
          colorClass="text-yellow-700" icon={<Clock className="h-5 w-5 text-yellow-600" />} />
        <KpiBox label="Comisión total este año" value={isLoading ? '–' : formatPrice(comisionAnual, 'COP')}
          sub={`año ${thisYear}`} colorClass="text-blue-700"
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="FIRMADO">Firmado</option>
          <option value="REGISTRADO">Registrado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="text-xs text-slate-500 hover:text-slate-800 underline">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Inmueble', 'Comprador', 'Fecha', 'Precio de venta', 'Comisión', 'Estado', 'Agente', 'Acciones'].map((h) => (
                  <th key={h} className={cn('px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide', h === 'Precio de venta' || h === 'Comisión' ? 'text-right' : 'text-left', h === 'Acciones' ? 'text-right' : '')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                ))}</tr>
              ))}
              {!isLoading && contratos.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No hay contratos de venta registrados</p>
                  </td>
                </tr>
              )}
              {contratos.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 truncate max-w-[160px]">{c.property?.title ?? '–'}</p>
                    <p className="text-xs text-slate-400">{c.property?.city}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{c.client?.name ?? '–'}</p>
                    <p className="text-xs text-slate-400">{c.client?.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatShortDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {formatPrice(Number(c.salePrice), c.saleCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {c.commissionAmount ? formatPrice(Number(c.commissionAmount), 'COP') : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', saleStatusColor(c.status))}>
                      {saleStatusLabel(c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.agent?.name ?? '–'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/ventas/${c.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver detalle">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">{meta.total} venta{meta.total !== 1 ? 's' : ''} · página {meta.page} de {meta.totalPages}</p>
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
