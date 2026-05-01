'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Shield, Building2, Clock, Smartphone, CheckCircle,
  Star, BadgeCheck, Users,
} from 'lucide-react';
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
          className="h-12 px-8 bg-[#B8973E] hover:bg-[#8B6E2E] text-white font-semibold gap-2 flex-shrink-0"
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
  // Propiedades destacadas
  const { data, isLoading } = useQuery({
    queryKey: ['properties', 'public', 'featured'],
    queryFn: () => propertiesApi.getPublic({ featured: 'true', limit: 6 }),
  });

  // Total de inmuebles publicados para el contador dinámico
  const { data: totalData } = useQuery({
    queryKey: ['properties', 'public', 'count'],
    queryFn: () => propertiesApi.getPublic({ limit: 1 }),
    staleTime: 10 * 60 * 1000,
  });

  const featured   = data?.data?.data ?? [];
  const totalInmuebles = (totalData?.data?.meta?.total ?? 0);
  const countLabel = totalInmuebles > 0 ? `${totalInmuebles}+` : '50+';

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-[600px] flex items-center justify-center text-white"
        style={{
          backgroundImage:    'url(/hero-bg.jpg)',
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
        }}
      >
        {/* Overlay para legibilidad del texto */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Contenido */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 drop-shadow-md">
              Sabemos que cada espacio
              <br />
              tiene un propósito.
            </h1>
            <p className="text-lg sm:text-xl text-slate-200 drop-shadow">
              Te ayudamos a encontrar el lugar ideal, con un acompañamiento experto en cada paso.
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ── CAMBIO 2 — Contadores dinámicos ──────────────────────────────── */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              {
                number: countLabel,
                label:  'Inmuebles verificados',
                Icon:   CheckCircle,
              },
              {
                number: '< 5 min',
                label:  'Tiempo de respuesta',
                Icon:   Clock,
              },
              {
                number: '100%',
                label:  'Proceso digital',
                Icon:   Smartphone,
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <stat.Icon className="h-7 w-7 text-[#B8973E] mb-1" />
                <p className="text-5xl font-bold text-[#B8973E]">{stat.number}</p>
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
              className="hidden sm:inline-flex text-[#B8973E] hover:text-[#8B6E2E] font-medium text-sm"
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
            <Button asChild size="lg" variant="outline" className="border-[#B8973E] text-[#B8973E] hover:bg-[#B8973E]/10">
              <Link href="/inmuebles">Ver todos los inmuebles</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── CAMBIO 3 — ¿Por qué elegirnos? ──────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">¿Por qué elegirnos?</h2>
            <p className="text-slate-500 mt-2">
              Comprometidos con hacer tu experiencia inmobiliaria fácil y segura
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                Icon:  Shield,
                title: 'Tu inmueble en buenas manos',
                desc:  'Nos encargamos de administrar tu inmueble garantizando rentabilidad, pagos puntuales y la tranquilidad de contar con pólizas respaldadas por aseguradoras líderes. Con nosotros, tu patrimonio está siempre protegido.',
              },
              {
                Icon:  BadgeCheck,
                title: 'Propiedades verificadas',
                desc:  'Cada inmueble en nuestro portafolio pasa por un proceso de verificación. Te mostramos solo opciones reales, con documentación en regla y condiciones claras desde el primer momento.',
              },
              {
                Icon:  Users,
                title: 'Asesoría en cada paso',
                desc:  'Desde la primera visita hasta la firma del contrato, te acompañamos con asesoría personalizada. Rápido, seguro y completamente digital — sin filas, sin papeles innecesarios.',
              },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-[3px] border-t-[#B8973E] p-7 flex flex-col gap-4"
              >
                <div className="inline-flex items-center justify-center w-13 h-13 bg-[#B8973E]/10 rounded-xl p-3 w-fit">
                  <Icon className="h-7 w-7 text-[#B8973E]" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAMBIO 4 — Testimonios ────────────────────────────────────────── */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Lo que dicen nuestros clientes</h2>
            <p className="text-slate-500 mt-2 flex items-center justify-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#4285F4">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Reseñas verificadas de Google
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                name:     'María González',
                initials: 'MG',
                color:    '#B8973E',
                text:     'Excelente servicio. Sofía me atendió de inmediato a las 10pm y al día siguiente ya tenía la cita agendada. El proceso fue muy ágil y transparente. 100% recomendados.',
              },
              {
                name:     'Carlos Mendoza',
                initials: 'CM',
                color:    '#8B6E2E',
                text:     'Encontré el apartamento perfecto en menos de una semana. El equipo de Serinzo es muy profesional y me acompañaron en todo el proceso hasta firmar el contrato.',
              },
              {
                name:     'Andrea Ruiz',
                initials: 'AR',
                color:    '#D4AF6A',
                text:     'Confié la administración de mi inmueble a Serinzo y ha sido la mejor decisión. Los pagos siempre puntuales y excelente comunicación con el equipo.',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4 relative"
              >
                {/* Badge Google */}
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="#4285F4">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-[10px] text-slate-500 font-medium">Google</span>
                </div>

                {/* Estrellas */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#B8973E] text-[#B8973E]" />
                  ))}
                </div>

                {/* Reseña */}
                <p className="text-slate-600 text-sm leading-relaxed italic flex-1">
                  &ldquo;{t.text}&rdquo;
                </p>

                {/* Autor */}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.initials}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                </div>
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
          <Button asChild size="lg" className="bg-[#B8973E] hover:bg-[#8B6E2E] text-white font-semibold">
            <Link href="/contacto">Contáctanos ahora</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
