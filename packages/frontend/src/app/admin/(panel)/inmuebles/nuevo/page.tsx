'use client';

import { PropertyForm } from '@/components/property-form/PropertyForm';

export default function NuevoInmueblePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Agregar inmueble</h1>
        <p className="text-slate-500 text-sm mt-0.5">Completa la información del nuevo inmueble.</p>
      </div>
      <PropertyForm mode="new" />
    </div>
  );
}
