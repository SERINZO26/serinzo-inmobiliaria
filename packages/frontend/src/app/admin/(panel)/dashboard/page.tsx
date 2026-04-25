'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, CalendarCheck, TrendingUp, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/kpi-card/KpiCard';
import { dashboardApi, clientsApi, propertiesApi, type Client } from '@/lib/api';
import {
  interestColor, clientStatusLabel, clientStatusColor,
  formatRelative, formatPrice, propertyTypeLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface KpiSnapshot {
  date: string;
  appointmentsScheduled?: number;
  appointmentsCompleted?: number;
  newClients?: number;
}

// ─── Embudo CRM ──────────────────────────────────────────────────────────────

const CRM_STAGES = [
  { key: 'NUEVO', label: 'Nuevos', color: 'bg-blue-400' },
  { key: 'CONTACTADO', label: 'Contactados', color: 'bg-indigo-400' },
  { key: 'CALIFICADO', label: 'Calificados', color: 'bg-purple-400' },
  { key: 'VISITO', label: 'Visitaron', color: 'bg-orange-400' },
  { key: 'OFERTO', label: 'Ofertaron', color: 'bg-yellow-400' },
  { key: 'CERRADO', label: 'Cerrados', color: 'bg-green-500' },
];

function CrmFunnel({ porStatus, total }: { porStatus: Record<string, number>; total: number }) {
  const max = Math.max(...CRM_STAGES.map((s) => porStatus[s.key] ?? 0), 1);
  return (
    <div className="space-y-2.5">
      {CRM_STAGES.map(({ key, label, color }) => {
        const count = porStatus[key] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>{label}</span>
              <span className="font-medium">{count}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', color)}
                style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tarjeta cliente reciente ─────────────────────────────────────────────────

function RecentClientRow({ client }: { client: Client }) {
  return (
    <Link href={`/clientes/${client.id}`} className="flex items-center gap-3 py-2 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors group">
      <div className={cn('h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold', interestColor(client.interestLevel))}>
        {client.interestLevel}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{client.name}</p>
        <p className="text-xs text-slate-400">{client.phone}</p>
      </div>
      <Badge className={cn('text-xs border-0 shrink-0', clientStatusColor(client.status))}>
        {clientStatusLabel(client.status)}
      </Badge>
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
    </Link>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => (await dashboardApi.getKpis()).data.data,
  });

  const { data: history } = useQuery({
    queryKey: ['dashboard-history'],
    queryFn: async () => (await dashboardApi.getKpiHistory(30)).data.data as KpiSnapshot[],
  });

  const { data: recentClients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-recent'],
    queryFn: async () => (await clientsApi.getAll({ limit: 5, page: 1 })).data.data,
  });

  const { data: recentProperties, isLoading: propsLoading } = useQuery({
    queryKey: ['properties-recent'],
    queryFn: async () => (await propertiesApi.getAll({ limit: 5, page: 1 })).data.data,
  });

  // Datos para el gráfico de barras: últimos 7 días
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const snap = (history ?? []).find((s) => s.date?.startsWith(dateStr));
    return {
      dia: format(date, 'EEE', { locale: es }),
      Citas: snap?.appointmentsScheduled ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Resumen de actividad de los últimos 30 días.</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Inmuebles disponibles"
          value={kpis?.inmuebles.disponibles ?? 0}
          icon={Building2}
          color="blue"
          loading={kpisLoading}
        />
        <KpiCard
          title="Total de clientes"
          value={kpis?.clientes.total ?? 0}
          icon={Users}
          color="green"
          loading={kpisLoading}
        />
        <KpiCard
          title="Citas últimos 30 días"
          value={kpis?.citas.ultimos30Dias ?? 0}
          icon={CalendarCheck}
          color="orange"
          loading={kpisLoading}
        />
        <KpiCard
          title="Tasa de asistencia"
          value={`${kpis?.citas.tasaAsistencia ?? 0}%`}
          icon={TrendingUp}
          color="purple"
          loading={kpisLoading}
        />
      </div>

      {/* ── Fila media ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de citas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">Citas por día (últimos 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="Citas" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Clientes recientes */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">Clientes recientes</CardTitle>
            <Link href="/admin/clientes" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (recentClients ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin clientes registrados aún.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {(recentClients ?? []).slice(0, 5).map((c) => (
                  <RecentClientRow key={c.id} client={c} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila inferior ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inmuebles recientes */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">Inmuebles recientes</CardTitle>
            <Link href="/admin/inmuebles" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
          </CardHeader>
          <CardContent>
            {propsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Skeleton className="h-10 w-14 rounded-md flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (recentProperties ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin inmuebles registrados aún.</p>
            ) : (
              <div className="space-y-2">
                {(recentProperties ?? []).slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/inmuebles/${p.id}`}
                    className="flex items-center gap-3 py-1.5 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors group"
                  >
                    <div className="h-10 w-14 rounded-md bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {p.photos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photos[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.title}</p>
                      <p className="text-xs text-slate-400">{p.city} · {propertyTypeLabel(p.type)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 shrink-0">
                      {formatPrice(p.price, p.priceCurrency)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Embudo CRM */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">Embudo de clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <CrmFunnel
                porStatus={kpis?.clientes.porStatus ?? {}}
                total={kpis?.clientes.total ?? 0}
              />
            )}
            <p className="text-xs text-slate-400 mt-4 text-right">
              {kpis?.clientes.calificados ?? 0} de {kpis?.clientes.total ?? 0} clientes calificados
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
