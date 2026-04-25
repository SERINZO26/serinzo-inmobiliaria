'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, LayoutGrid, List, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyCard } from '@/components/property-card/PropertyCard';
import { propertiesApi, type Property, type PropertyStatus } from '@/lib/api';
import {
  formatPrice, propertyStatusColor, propertyStatusLabel,
  propertyTypeLabel, propertyOperationLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'RESERVADO', label: 'Reservado' },
  { value: 'VENDIDO', label: 'Vendido' },
  { value: 'ARRENDADO', label: 'Arrendado' },
  { value: 'INACTIVO', label: 'Inactivo' },
];

const TYPE_OPTIONS = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'LOTE', label: 'Lote' },
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'FINCA', label: 'Finca' },
];

const OP_OPTIONS = [
  { value: 'todos', label: 'Toda operación' },
  { value: 'VENTA', label: 'Venta' },
  { value: 'ARRIENDO', label: 'Arriendo' },
  { value: 'VENTA_O_ARRIENDO', label: 'Venta o Arriendo' },
];

export default function InmueblesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [filters, setFilters] = useState({ type: 'todos', operation: 'todos', status: 'todos', city: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem('inmuebles-view');
    if (saved === 'table' || saved === 'cards') setView(saved);
  }, []);

  function switchView(v: 'cards' | 'table') {
    setView(v);
    localStorage.setItem('inmuebles-view', v);
  }

  const params: Record<string, string | number> = { page, limit: 12 };
  if (filters.type !== 'todos') params.type = filters.type;
  if (filters.operation !== 'todos') params.operation = filters.operation;
  if (filters.status !== 'todos') params.status = filters.status;
  if (filters.city.trim()) params.city = filters.city.trim();

  const { data: response, isLoading } = useQuery({
    queryKey: ['properties', params],
    queryFn: async () => (await propertiesApi.getAll(params)).data,
  });

  const properties = response?.data ?? [];
  const total = response?.meta?.total ?? 0;
  const totalPages = response?.meta?.totalPages ?? 1;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PropertyStatus }) =>
      propertiesApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['properties'] }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.togglePublish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['properties'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['properties'] }),
  });

  function clearFilters() {
    setFilters({ type: 'todos', operation: 'todos', status: 'todos', city: '' });
    setPage(1);
  }

  const hasFilters = filters.type !== 'todos' || filters.operation !== 'todos' || filters.status !== 'todos' || filters.city;

  function getCardActions(p: Property) {
    return [
      { label: 'Ver detalle', onClick: () => router.push(`/admin/inmuebles/${p.id}`) },
      { label: 'Editar', onClick: () => router.push(`/admin/inmuebles/${p.id}`) },
      {
        label: p.published ? 'Quitar del sitio web' : 'Publicar en sitio web',
        onClick: () => publishMutation.mutate(p.id),
      },
      {
        label: p.status === 'DISPONIBLE' ? 'Marcar como reservado' : 'Marcar como disponible',
        onClick: () => statusMutation.mutate({
          id: p.id,
          status: p.status === 'DISPONIBLE' ? 'RESERVADO' : 'DISPONIBLE',
        }),
      },
      { label: 'Archivar', onClick: () => { if (window.confirm('¿Archivar este inmueble?')) archiveMutation.mutate(p.id); }, destructive: true },
    ];
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inmuebles</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} inmueble{total !== 1 ? 's' : ''} en total</p>
        </div>
        <Button onClick={() => router.push('/inmuebles/nuevo')} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="h-4 w-4" />
          Agregar inmueble
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Select value={filters.type} onValueChange={(v) => { setFilters(f => ({ ...f, type: v })); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.operation} onValueChange={(v) => { setFilters(f => ({ ...f, operation: v })); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{OP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => { setFilters(f => ({ ...f, status: v })); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-8 w-44"
              placeholder="Ciudad..."
              value={filters.city}
              onChange={(e) => { setFilters(f => ({ ...f, city: e.target.value })); setPage(1); }}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 gap-1">
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          )}

          {/* Toggle de vista */}
          <div className="ml-auto flex gap-1 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => switchView('cards')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => switchView('table')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600')}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Vista tarjetas */}
      {view === 'cards' && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium">No hay inmuebles con estos filtros</p>
              <p className="text-sm mt-1">Prueba cambiando los filtros o agrega un inmueble nuevo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} actions={getCardActions(p)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vista tabla */}
      {view === 'table' && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-14">Foto</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    No hay inmuebles con estos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="h-9 w-12 rounded bg-slate-100 overflow-hidden">
                        {p.photos?.[0]
                          ? <img src={p.photos[0]} alt="" className="h-full w-full object-cover" />  // eslint-disable-line
                          : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 max-w-[200px] truncate">{p.title}</TableCell>
                    <TableCell className="text-sm text-slate-500">{propertyTypeLabel(p.type)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.city}</TableCell>
                    <TableCell className="text-sm font-medium">{formatPrice(p.price, p.priceCurrency)}</TableCell>
                    <TableCell>
                      <Badge className={cn('border-0 text-xs', propertyStatusColor(p.status))}>
                        {propertyStatusLabel(p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/inmuebles/${p.id}`)}>Ver / Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => publishMutation.mutate(p.id)}>
                            {p.published ? 'Quitar del sitio' : 'Publicar en sitio'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => statusMutation.mutate({ id: p.id, status: p.status === 'DISPONIBLE' ? 'RESERVADO' : 'DISPONIBLE' })}
                          >
                            {p.status === 'DISPONIBLE' ? 'Marcar reservado' : 'Marcar disponible'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => { if (window.confirm('¿Archivar este inmueble?')) archiveMutation.mutate(p.id); }}
                          >
                            Archivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-slate-500 self-center">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}
