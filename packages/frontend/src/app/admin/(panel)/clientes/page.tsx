'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, MoreVertical } from 'lucide-react';
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
import { clientsApi, type ClientStatus } from '@/lib/api';
import {
  interestColor, clientStatusColor, clientStatusLabel, formatRelative,
} from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Opciones de filtros ──────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'CALIFICADO', label: 'Calificado' },
  { value: 'VISITO', label: 'Visitó' },
  { value: 'OFERTO', label: 'Ofertó' },
  { value: 'CERRADO', label: 'Cerrado' },
  { value: 'PERDIDO', label: 'Perdido' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los orígenes' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'web', label: 'Web' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'referido', label: 'Referido' },
  { value: 'campaña', label: 'Campaña' },
  { value: 'visita_directa', label: 'Visita directa' },
];

function sourceLabel(source: string): string {
  const found = SOURCE_OPTIONS.find((o) => o.value === source);
  return found?.label ?? source;
}

const INTEREST_LEVELS = [1, 2, 3, 4, 5];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedInterest, setSelectedInterest] = useState<number | null>(null);
  const [status, setStatus] = useState('todos');
  const [source, setSource] = useState('todos');
  const [page, setPage] = useState(1);

  // Debounce del buscador — 400 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reiniciar página cuando cambian los filtros
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedInterest, status, source]);

  const params: Record<string, string | number> = { page, limit: 20 };
  if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
  if (selectedInterest) params.interestLevel = selectedInterest;
  if (status !== 'todos') params.status = status;
  if (source !== 'todos') params.source = source;

  const { data: response, isLoading } = useQuery({
    queryKey: ['clients', params],
    queryFn: async () => (await clientsApi.getAll(params)).data,
  });

  const clients = response?.data ?? [];
  const total = response?.meta?.total ?? 0;
  const totalPages = response?.meta?.totalPages ?? 1;

  const lostMutation = useMutation({
    mutationFn: (id: string) => clientsApi.update(id, { status: 'PERDIDO' as ClientStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setSelectedInterest(null);
    setStatus('todos');
    setSource('todos');
    setPage(1);
  }

  const hasFilters = search || selectedInterest !== null || status !== 'todos' || source !== 'todos';

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} cliente{total !== 1 ? 's' : ''} en total</p>
        </div>
        <Button
          onClick={() => router.push('/admin/clientes/nuevo')}
          className="bg-green-600 hover:bg-green-700 gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar cliente
        </Button>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Buscador */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre, teléfono o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Fila de filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Nivel de interés */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Interés:</span>
            {INTEREST_LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedInterest(selectedInterest === lvl ? null : lvl)}
                className={cn(
                  'h-7 w-7 rounded-full text-white text-xs font-bold transition-all ring-2',
                  interestColor(lvl),
                  selectedInterest === lvl ? 'ring-slate-800 scale-110' : 'ring-transparent opacity-70 hover:opacity-100',
                )}
              >
                {lvl}
              </button>
            ))}
          </div>

          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 gap-1">
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-12">Interés</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Estado CRM</TableHead>
              <TableHead>Último contacto</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-slate-400">
                  <p className="text-base font-medium">No hay clientes con estos filtros</p>
                  <p className="text-sm mt-1">Prueba cambiando los filtros o agrega un cliente nuevo</p>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => router.push(`/admin/clientes/${client.id}`)}
                >
                  {/* Indicador de interés */}
                  <TableCell>
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
                      interestColor(client.interestLevel),
                    )}>
                      {client.interestLevel}
                    </div>
                  </TableCell>

                  {/* Nombre y teléfono */}
                  <TableCell>
                    <p className="font-medium text-slate-800">{client.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{client.phone}</p>
                  </TableCell>

                  {/* Origen */}
                  <TableCell className="text-sm text-slate-600">
                    {sourceLabel(client.source)}
                  </TableCell>

                  {/* Estado CRM */}
                  <TableCell>
                    <Badge className={cn('border-0 text-xs', clientStatusColor(client.status))}>
                      {clientStatusLabel(client.status)}
                    </Badge>
                  </TableCell>

                  {/* Último contacto */}
                  <TableCell className="text-sm text-slate-500">
                    {client.lastContactAt
                      ? formatRelative(client.lastContactAt)
                      : <span className="text-slate-300 italic">Sin contacto</span>}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/admin/clientes/${client.id}`)}>
                          Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/admin/clientes/${client.id}`)}>
                          Editar datos
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            if (window.confirm(`¿Marcar a ${client.name} como perdido?`)) {
                              lostMutation.mutate(client.id);
                            }
                          }}
                        >
                          Marcar como perdido
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

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-slate-500 self-center">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
