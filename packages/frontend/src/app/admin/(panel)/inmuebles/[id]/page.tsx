'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyForm } from '@/components/property-form/PropertyForm';
import { propertiesApi } from '@/lib/api';

export default function EditarInmueblePage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => (await propertiesApi.getById(id)).data.data,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No se pudo cargar el inmueble. Verifica que el enlace sea correcto.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 truncate">{data.title}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Edita la información del inmueble.</p>
      </div>
      <PropertyForm property={data} mode="edit" />
    </div>
  );
}
