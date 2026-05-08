'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building, Plus, Eye, Trash2, Globe, EyeOff,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { projectsApi, type Project, type ProjectStatus } from '@/lib/api';
import { formatPrice, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  EN_PREVENTA:          'En preventa',
  EN_CONSTRUCCION:      'En construcción',
  PROXIMO_LANZAMIENTO:  'Próximo lanzamiento',
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  EN_PREVENTA:          'bg-blue-100 text-blue-800 border-blue-200',
  EN_CONSTRUCCION:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROXIMO_LANZAMIENTO:  'bg-purple-100 text-purple-800 border-purple-200',
};

export default function ProyectosAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [publishFilter, setPublishFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-proyectos', page, statusFilter, publishFilter],
    queryFn: async () => (await projectsApi.getAll({
      page, limit: 20,
      ...(statusFilter  && { status:    statusFilter }),
      ...(publishFilter && { published: publishFilter }),
    })).data,
  });

  const projects: Project[] = data?.data ?? [];
  const meta = data?.meta;

  const deleteMut = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-proyectos'] }),
  });

  const togglePublish = async (p: Project) => {
    await projectsApi.update(p.id, { published: !p.published });
    qc.invalidateQueries({ queryKey: ['admin-proyectos'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proyectos sobre planos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vivienda nueva y proyectos de inversión</p>
        </div>
        <Link href="/admin/proyectos/nuevo">
          <Button className="gap-2 bg-[#B8973E] hover:bg-[#9a7d33]">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
        >
          <option value="">Todos los estados</option>
          <option value="EN_PREVENTA">En preventa</option>
          <option value="EN_CONSTRUCCION">En construcción</option>
          <option value="PROXIMO_LANZAMIENTO">Próximo lanzamiento</option>
        </select>
        <select
          value={publishFilter}
          onChange={(e) => { setPublishFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
        >
          <option value="">Publicados y borradores</option>
          <option value="true">Solo publicados</option>
          <option value="false">Solo borradores</option>
        </select>
        {(statusFilter || publishFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setPublishFilter(''); setPage(1); }}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
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
                {['Foto', 'Nombre', 'Ubicación', 'Precio desde', 'Entrega', 'Estado', 'Publicado', 'Acciones'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left first:w-16">
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
              {!isLoading && projects.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Building className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No hay proyectos registrados</p>
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    {p.photos[0] ? (
                      <div className="relative w-12 h-9 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                        <Image src={p.photos[0]} alt={p.title} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-9 rounded bg-slate-100 flex items-center justify-center">
                        <Building className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 truncate max-w-[180px]">{p.title}</p>
                    <p className="text-xs text-slate-400">{formatShortDate(p.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{p.location}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                    {formatPrice(Number(p.priceFrom), 'COP')}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {p.deliveryDate ? formatShortDate(p.deliveryDate) : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_COLOR[p.status])}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublish(p)}
                      className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors',
                        p.published
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                      )}
                    >
                      {p.published ? <><Globe className="h-3 w-3" /> Publicado</> : <><EyeOff className="h-3 w-3" /> Borrador</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/proyectos/${p.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver / editar">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="Archivar proyecto"
                        onClick={() => {
                          if (confirm(`¿Archivar el proyecto "${p.title}"? Dejará de aparecer en el sitio.`)) {
                            deleteMut.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">{meta.total} proyecto{meta.total !== 1 ? 's' : ''} · página {meta.page} de {meta.totalPages}</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-7 w-7 p-0">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 p-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
