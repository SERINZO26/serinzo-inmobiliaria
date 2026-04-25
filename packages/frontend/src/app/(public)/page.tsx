'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Shield, Star, Building2 } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { PublicPropertyCard } from '@/components/property-card/PublicPropertyCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Buscador hero ────────────────────────────────────────────────────────────

function HeroSearch() {
  const router = useRouter();
  const [operacion, setOperacion] = useState('');
  const [tipo, setTipo] = useState('');
  const [ciudad, setCiudad] = useState('');

  const buscar = () => {
    const params = new URLSearchParams();
    if (operacion) params.set('operation', operacion);
    if (tipo) params.set('type', tipo);
    if (ciudad.trim()) params.set('city', ciudad.trim());
    router.push(`/inmuebles?${params.toString()}`);
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/20">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* ¿Qué buscas? */}
        <div className="flex-1">
          <Select value={operacion} onValueChange={setOperacion}>
            <SelectTrigger className="h-12 bg-white text-slate-800 border-0">
              <SelectValue placeholder="¿Qué buscas?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VENTA">Comprar</SelectItem>
              <SelectItem value="ARRIENDO">Arrendar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tipo */}
        <div className="flex-1">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-12 bg-white text-slate-800 border-0">
              <SelectValue placeholder="Tipo de inmueble" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASA">Casa</SelectItem>
              <SelectItem value="APARTAMENTO">Apartamento</SelectItem>
              <SelectItem value="LOCAL">Local comercial</SelectItem>
              <SelectItem value="OFICINA">Oficina</SelectItem>
              <SelectItem value="LOTE">Lote</SelectItem>
              <SelectItem value="BODEGA">Bodega</SelectItem>
              <SelectItem value="FINCA">Finca</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ciudad */}
        <div className="flex-1">
          <Input
            className="h-12 bg-white text-slate-800 border-0 placeholder:text-slate-400"
            placeholder="Ciudad"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>

        {/* Botón */}
        <Button
          onClick={buscar}
          className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 flex-shrink-0"
        >
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['properties', 'public', 'featured'],
    queryFn: () => propertiesApi.getPublic({ featured: 'true', limit: 6 }),
  });

  const featured = data?.data?.data ?? [];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-4">
              Encuentra tu próximo hogar
            </h1>
            <p className="text-lg sm:text-xl text-slate-300">
              Te ayudamos a encontrar el inmueble perfecto para comprar o arrendar
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ── Contadores ───────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { number: '50+', label: 'Inmuebles disponibles' },
              { number: '10', label: 'Años de experiencia' },
              { number: '200+', label: 'Clientes satisfechos' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-5xl font-bold text-blue-600 mb-2">{stat.number}</p>
                <p className="text-slate-600 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Propiedades destacadas ────────────────────────────────────────── */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Propiedades destacadas</h2>
              <p className="text-slate-500 mt-1">Selección especial de nuestro portafolio</p>
            </div>
            <Link
              href="/inmuebles"
              className="hidden sm:inline-flex text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Ver todos →
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                  <div className="bg-slate-200 aspect-[4/3] animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay propiedades destacadas por ahora.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((p) => (
                <PublicPropertyCard key={p.id} property={p} />
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Button asChild size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <Link href="/inmuebles">Ver todos los inmuebles</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── ¿Por qué elegirnos? ───────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">¿Por qué elegirnos?</h2>
            <p className="text-slate-500 mt-2">Comprometidos con hacer tu experiencia inmobiliaria fácil y segura</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                Icon: Shield,
                title: 'Proceso transparente',
                desc: 'Te acompañamos en cada paso con total claridad, sin sorpresas ni letras pequeñas.',
              },
              {
                Icon: Star,
                title: 'Atención personalizada',
                desc: 'Cada cliente es único. Nuestro equipo se adapta a tus necesidades y presupuesto.',
              },
              {
                Icon: Building2,
                title: 'Amplio portafolio',
                desc: 'Casas, apartamentos, locales, oficinas y más. Tenemos la opción que buscas.',
              },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="text-center p-6 rounded-2xl bg-slate-50 hover:bg-blue-50 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl mb-4">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-3">
            ¿Tienes un inmueble para vender o arrendar?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Cuéntanos sobre tu propiedad. Nuestro equipo te asesorará para obtener el mejor resultado.
          </p>
          <Button asChild size="lg" className="bg-white text-slate-800 hover:bg-slate-100 font-semibold">
            <Link href="/contacto">Contáctanos ahora</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
