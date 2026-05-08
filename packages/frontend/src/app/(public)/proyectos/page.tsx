'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Building2, MapPin, Calendar, Tag, MessageCircle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ProjectStatus = 'EN_PREVENTA' | 'EN_CONSTRUCCION' | 'PROXIMO_LANZAMIENTO';

interface Project {
  id:           string;
  title:        string;
  description:  string | null;
  slug:         string;
  location:     string;
  department:   string | null;
  priceFrom:    number;
  deliveryDate: string | null;
  status:       ProjectStatus;
  photos:       string[];
  featured:     boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  EN_PREVENTA:         'En preventa',
  EN_CONSTRUCCION:     'En construcción',
  PROXIMO_LANZAMIENTO: 'Próximo lanzamiento',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  EN_PREVENTA:         'bg-green-100 text-green-700',
  EN_CONSTRUCCION:     'bg-blue-100 text-blue-700',
  PROXIMO_LANZAMIENTO: 'bg-amber-100 text-amber-700',
};

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const WA_BASE = 'https://wa.me/573182063924';

// ── Modal de interés ──────────────────────────────────────────────────────────

function InteresModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [form, setForm]       = useState({ nombre: '', telefono: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [err, setErr]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API_URL}/api/v1/clients`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:   form.nombre,
          phone:  form.telefono,
          email:  form.email || undefined,
          source: 'WEB',
          additionalRequirements: `Interesado en proyecto ${project.title}`,
        }),
      });
      if (!res.ok) throw new Error('Error al enviar');
      setSent(true);
    } catch {
      setErr('No se pudo enviar. Intenta de nuevo o escríbenos por WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¡Recibimos tu registro!</h3>
            <p className="text-slate-500">Pronto te contactaremos con información del proyecto.</p>
            <Button onClick={onClose} className="mt-6 bg-[#B8973E] hover:bg-[#8B6E2E] text-white">
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Me interesa este proyecto</h3>
            <p className="text-sm text-slate-500 mb-5">{project.title} · {project.location}</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
                <Input
                  required
                  placeholder="Tu nombre completo"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Teléfono *</label>
                <Input
                  required
                  placeholder="+57 300 000 0000"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              {err && <p className="text-red-500 text-sm">{err}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#B8973E] hover:bg-[#8B6E2E] text-white font-semibold"
              >
                {loading ? 'Enviando...' : 'Quiero información'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Card de proyecto ──────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const [modalOpen, setModalOpen] = useState(false);
  const waMsg = encodeURIComponent(`Hola, estoy interesado en el proyecto ${project.title} que vi en su página web`);
  const photo  = project.photos[0] ?? null;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        {/* Foto */}
        <div className="relative aspect-[16/9] bg-slate-200">
          {photo ? (
            <Image src={photo} alt={project.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="h-12 w-12 text-slate-300" />
            </div>
          )}
          {/* Badge de estado */}
          <span className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[project.status]}`}>
            {STATUS_LABELS[project.status]}
          </span>
        </div>

        {/* Info */}
        <div className="p-5 flex flex-col flex-1 gap-3">
          <h3 className="font-bold text-slate-800 text-lg leading-tight">{project.title}</h3>

          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{project.location}{project.department ? `, ${project.department}` : ''}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#B8973E] font-semibold">
            <Tag className="h-4 w-4 flex-shrink-0" />
            <span>Desde {formatPrice(project.priceFrom)}</span>
          </div>

          {project.deliveryDate && (
            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Entrega estimada: {formatDate(project.deliveryDate)}</span>
            </div>
          )}

          {project.description && (
            <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 flex-1">
              {project.description}
            </p>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-2 mt-auto">
            <Button
              onClick={() => setModalOpen(true)}
              className="flex-1 bg-[#B8973E] hover:bg-[#8B6E2E] text-white font-semibold text-sm"
            >
              Me interesa
            </Button>
            <a
              href={`${WA_BASE}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      {modalOpen && <InteresModal project={project} onClose={() => setModalOpen(false)} />}
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ProyectosPage() {
  const { data, isLoading } = useQuery<{ success: boolean; data: Project[] }>({
    queryKey: ['projects', 'public'],
    queryFn:  () => fetch(`${API_URL}/api/v1/projects/public`).then((r) => r.json()),
  });

  const projects = data?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-slate-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Proyectos sobre planos</h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto">
            Invierte desde el inicio y asegura tu patrimonio
          </p>
        </div>
      </section>

      {/* Grid de proyectos */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                <div className="bg-slate-200 aspect-video animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <Building2 className="h-14 w-14 mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold mb-2">Próximamente</h2>
            <p className="text-sm max-w-xs mx-auto">
              Estamos preparando nuevos proyectos. Escríbenos y te notificamos cuando estén disponibles.
            </p>
            <a
              href={`${WA_BASE}?text=${encodeURIComponent('Hola, quisiera recibir información sobre futuros proyectos sobre planos')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Notificarme por WhatsApp
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
