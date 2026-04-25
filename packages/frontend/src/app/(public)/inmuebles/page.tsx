'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { PublicPropertyCard } from '@/components/property-card/PublicPropertyCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Filtros {
  operation: string;
  types: string[];
  city: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  sortBy: string;
}

const TIPO_OPTS = [
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'LOCAL', label: 'Local comercial' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'LOTE', label: 'Lote' },
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'FINCA', label: 'Finca' },
];

const HABITACIONES = ['1', '2', '3', '4', '5'];

const PAGE_SIZE = 9;

// ─── Panel de filtros ─────────────────────────────────────────────────────────

function FilterPanel({
  filtros,
  onChange,
  onApply,
  onClear,
}: {
  filtros: Filtros;
  onChange: (f: Partial<Filtros>) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const toggleType = (type: string) => {
    const types = filtros.types.includes(type)
      ? filtros.types.filter((t) => t !== type)
      : [...filtros.types, type];
    onChange({ types });
  };

  return (
    <div className="space-y-6">
      {/* Operación */}
      <div>
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
          Operación
        </Label>
        <div className="flex gap-2">
          {[
            { value: 'VENTA', label: 'Comprar' },
            { value: 'ARRIENDO', label: 'Arrendar' },
          ].map((op) => (
            <button
              key={op.value}
              onClick={() => onChange({ operation: filtros.operation === op.value ? '' : op.value })}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                filtros.operation === op.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de inmueble */}
      <div>
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
          Tipo de inmueble
        </Label>
        <div className="space-y-1.5">
          {TIPO_OPTS.map((t) => (
            <label key={t.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filtros.types.includes(t.value)}
                onChange={() => toggleType(t.value)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Ciudad */}
      <div>
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
          Ciudad
        </Label>
        <Input
          placeholder="Ej: Bogotá, Medellín"
          value={filtros.city}
          onChange={(e) => onChange({ city: e.target.value })}
          className="text-sm"
        />
      </div>

      {/* Precio */}
      <div>
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
          Precio (COP)
        </Label>
        <div className="space-y-2">
          <Input
            type="number"
            placeholder="Mínimo"
            value={filtros.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
            className="text-sm"
          />
          <Input
            type="number"
            placeholder="Máximo"
            value={filtros.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>

      {/* Habitaciones mínimas */}
      <div>
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
          Habitaciones mínimas
        </Label>
        <div className="flex gap-1.5 flex-wrap">
          {HABITACIONES.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ minBedrooms: filtros.minBedrooms === n ? '' : n })}
              className={cn(
                'h-9 w-9 rounded-lg text-sm font-semibold border transition-colors',
                filtros.minBedrooms === n
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}
            >
              {n === '5' ? '5+' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Botones */}
      <div className="space-y-2 pt-2">
        <Button onClick={onApply} className="w-full">
          Aplicar filtros
        </Button>
        <Button onClick={onClear} variant="ghost" className="w-full text-slate-500">
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

function InmueblesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Inicializar filtros desde URL params
  const [filtros, setFiltros] = useState<Filtros>({
    operation: searchParams.get('operation') ?? '',
    types: searchParams.get('type') ? [searchParams.get('type')!] : [],
    city: searchParams.get('city') ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    minBedrooms: searchParams.get('minBedrooms') ?? '',
    sortBy: searchParams.get('sortBy') ?? 'newest',
  });

  // Filtros aplicados (los que se usan en la query)
  const [aplicados, setAplicados] = useState<Filtros>(filtros);

  const buildParams = useCallback((f: Filtros, p: number) => {
    const params: Record<string, string | number> = {
      page: p,
      limit: PAGE_SIZE,
      status: 'DISPONIBLE',
    };
    if (f.operation) params.operation = f.operation;
    if (f.types.length === 1) params.type = f.types[0];
    if (f.city.trim()) params.city = f.city.trim();
    if (f.minPrice) params.minPrice = f.minPrice;
    if (f.maxPrice) params.maxPrice = f.maxPrice;
    if (f.minBedrooms) params.minBedrooms = f.minBedrooms;
    if (f.sortBy === 'price_asc') params.sortBy = 'price_asc';
    if (f.sortBy === 'price_desc') params.sortBy = 'price_desc';
    return params;
  }, []);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['properties', 'public', aplicados, page],
    queryFn: () => propertiesApi.getPublic(buildParams(aplicados, page)),
  });

  const properties = data?.data?.data ?? [];
  const meta = data?.data?.meta;
  const total = meta?.total ?? properties.length;
  const totalPages = meta?.totalPages ?? 1;

  const applyFilters = () => {
    setAplicados({ ...filtros });
    setPage(1);
    setFiltersOpen(false);

    // Actualizar URL
    const params = new URLSearchParams();
    if (filtros.operation) params.set('operation', filtros.operation);
    if (filtros.types[0]) params.set('type', filtros.types[0]);
    if (filtros.city) params.set('city', filtros.city);
    if (filtros.minPrice) params.set('minPrice', filtros.minPrice);
    if (filtros.maxPrice) params.set('maxPrice', filtros.maxPrice);
    if (filtros.minBedrooms) params.set('minBedrooms', filtros.minBedrooms);
    if (filtros.sortBy !== 'newest') params.set('sortBy', filtros.sortBy);
    router.push(`/inmuebles?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const empty: Filtros = {
      operation: '',
      types: [],
      city: '',
      minPrice: '',
      maxPrice: '',
      minBedrooms: '',
      sortBy: 'newest',
    };
    setFiltros(empty);
    setAplicados(empty);
    setPage(1);
    router.push('/inmuebles', { scroll: false });
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Barra superior */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Inmuebles</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {isLoading ? '...' : `${total} inmueble${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Ordenar */}
              <Select
                value={filtros.sortBy}
                onValueChange={(v) => {
                  setFiltros({ ...filtros, sortBy: v });
                  setAplicados((a) => ({ ...a, sortBy: v }));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Más reciente</SelectItem>
                  <SelectItem value="price_asc">Menor precio</SelectItem>
                  <SelectItem value="price_desc">Mayor precio</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtros móvil */}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden gap-2"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* ── Sidebar filtros desktop ─────────────────────────────────── */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Filtros</h2>
                <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600">
                  Limpiar
                </button>
              </div>
              <FilterPanel
                filtros={filtros}
                onChange={(f) => setFiltros((prev) => ({ ...prev, ...f }))}
                onApply={applyFilters}
                onClear={clearFilters}
              />
            </div>
          </aside>

          {/* ── Filtros móvil overlay ───────────────────────────────────── */}
          {filtersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">Filtros</h2>
                  <button onClick={() => setFiltersOpen(false)}>
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
                <FilterPanel
                  filtros={filtros}
                  onChange={(f) => setFiltros((prev) => ({ ...prev, ...f }))}
                  onApply={applyFilters}
                  onClear={clearFilters}
                />
              </div>
            </div>
          )}

          {/* ── Grid de tarjetas ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {isLoading || isFetching ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-100">
                    <div className="bg-slate-200 aspect-[4/3] animate-pulse" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-slate-200 rounded animate-pulse" />
                      <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-20">
                <SlidersHorizontal className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  No encontramos inmuebles con esos filtros
                </h3>
                <p className="text-slate-400 mb-6">Intenta con filtros diferentes o más amplios</p>
                <Button onClick={clearFilters} variant="outline">
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {properties.map((p) => (
                  <PublicPropertyCard key={p.id} property={p} />
                ))}
              </div>
            )}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-slate-500">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Suspense boundary requerido por Next.js 14 cuando se usa useSearchParams
export default function InmueblesPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Cargando inmuebles...</p>
          </div>
        </div>
      }
    >
      <InmueblesContent />
    </Suspense>
  );
}
