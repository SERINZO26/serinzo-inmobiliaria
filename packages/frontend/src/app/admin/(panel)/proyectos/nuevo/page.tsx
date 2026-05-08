'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft, Loader2, AlertCircle, Upload, X, ImageIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { projectsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const SLUG_RE = /^[a-z0-9-]+$/;

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function NuevoProyectoPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title:        '',
    slug:         '',
    description:  '',
    location:     '',
    department:   '',
    priceFrom:    '',
    deliveryDate: '',
    status:       'EN_PREVENTA',
    contactPhone: '',
    contactEmail: '',
    featured:     false,
    published:    false,
  });
  const [photoFiles,  setPhotoFiles]  = useState<File[]>([]);
  const [previews,    setPreviews]    = useState<string[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function set(key: string, value: string | boolean) {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'title' && !SLUG_RE.test(f.slug) ? { slug: toSlug(value as string) } : {}),
    }));
  }

  const onDrop = useCallback((accepted: File[]) => {
    const valid = accepted.filter((f) => f.size <= 5 * 1024 * 1024);
    setPhotoFiles((prev) => [...prev, ...valid]);
    valid.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    multiple: true,
    maxSize: 5 * 1024 * 1024,
  });

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i]);
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.title.trim())    return setError('El nombre del proyecto es obligatorio');
    if (!form.slug.trim())     return setError('La URL (slug) es obligatoria');
    if (!form.location.trim()) return setError('La ubicación es obligatoria');
    if (!form.priceFrom || Number(form.priceFrom) <= 0)
      return setError('Ingresa un precio desde válido');

    setSubmitting(true);
    try {
      const res = await projectsApi.create({
        title:        form.title,
        slug:         form.slug,
        description:  form.description || undefined,
        location:     form.location,
        department:   form.department || undefined,
        priceFrom:    Number(form.priceFrom),
        deliveryDate: form.deliveryDate || undefined,
        status:       form.status,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        featured:     form.featured,
        published:    form.published,
      });
      const newId = res.data.data.id;

      if (photoFiles.length > 0) {
        await projectsApi.uploadPhotos(newId, photoFiles);
      }

      router.push(`/admin/proyectos/${newId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo crear el proyecto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/proyectos">
          <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo proyecto</h1>
          <p className="text-sm text-slate-500 mt-0.5">Proyecto de vivienda nueva o sobre planos</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info básica */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Información básica</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Nombre del proyecto *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Ej: Torres del Parque II"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">URL del proyecto (slug) *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => set('slug', toSlug(e.target.value))}
                placeholder="torres-del-parque-ii"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
              />
              <p className="text-xs text-slate-400 mt-1">Solo letras minúsculas, números y guiones</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={4}
                placeholder="Describe el proyecto, sus características y ventajas…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Ubicación */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Ubicación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Ciudad / barrio *</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="Ej: Bogotá - Chapinero"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Departamento</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                  placeholder="Ej: Cundinamarca"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles y estado */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Detalles del proyecto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Precio desde (COP) *</label>
                <input
                  type="number"
                  min="0"
                  value={form.priceFrom}
                  onChange={(e) => set('priceFrom', e.target.value)}
                  placeholder="Ej: 180000000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Fecha de entrega estimada</label>
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => set('deliveryDate', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Estado del proyecto</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
              >
                <option value="EN_PREVENTA">En preventa</option>
                <option value="EN_CONSTRUCCION">En construcción</option>
                <option value="PROXIMO_LANZAMIENTO">Próximo lanzamiento</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Teléfono de contacto</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  placeholder="Ej: 3001234567"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email de contacto</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  placeholder="proyectos@ejemplo.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fotos */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Fotos del proyecto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-[#B8973E] bg-amber-50' : 'border-slate-200 hover:border-[#B8973E]/50',
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-7 w-7 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">Arrastra fotos aquí o haz clic</p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP · máx. 5 MB por foto</p>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((url, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                    <Image src={url} alt={`foto ${i + 1}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {previews.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ImageIcon className="h-4 w-4" />
                <span>No hay fotos seleccionadas</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publicación */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Publicación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800">Publicar en el sitio web</p>
                <p className="text-xs text-slate-400">El proyecto será visible para el público</p>
              </div>
              <div
                onClick={() => set('published', !form.published)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                  form.published ? 'bg-[#B8973E]' : 'bg-slate-200',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  form.published ? 'translate-x-6' : 'translate-x-1',
                )} />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800">Destacar en el home</p>
                <p className="text-xs text-slate-400">Aparece primero en la sección de proyectos</p>
              </div>
              <div
                onClick={() => set('featured', !form.featured)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                  form.featured ? 'bg-[#B8973E]' : 'bg-slate-200',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  form.featured ? 'translate-x-6' : 'translate-x-1',
                )} />
              </div>
            </label>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/admin/proyectos" className="flex-1">
            <Button type="button" variant="outline" className="w-full" disabled={submitting}>Cancelar</Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex-1 bg-[#B8973E] hover:bg-[#9a7d33]">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando…</> : 'Crear proyecto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
