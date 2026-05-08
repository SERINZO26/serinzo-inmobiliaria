'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft, Loader2, AlertCircle, Upload, X, Globe, EyeOff, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { projectsApi } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function EditarProyectoPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['admin-proyecto', id],
    queryFn: async () => (await projectsApi.getById(id)).data.data,
    enabled: !!id,
  });

  const [form, setForm] = useState({
    title: '', slug: '', description: '', location: '', department: '',
    priceFrom: '', deliveryDate: '', status: 'EN_PREVENTA',
    contactPhone: '', contactEmail: '', featured: false, published: false,
  });
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPreviews,   setNewPreviews]   = useState<string[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    if (!projectData) return;
    const p = projectData;
    setForm({
      title:        p.title,
      slug:         p.slug,
      description:  p.description ?? '',
      location:     p.location,
      department:   p.department ?? '',
      priceFrom:    String(p.priceFrom),
      deliveryDate: p.deliveryDate ? p.deliveryDate.split('T')[0] : '',
      status:       p.status,
      contactPhone: p.contactPhone ?? '',
      contactEmail: p.contactEmail ?? '',
      featured:     p.featured,
      published:    p.published,
    });
  }, [projectData]);

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const onDrop = useCallback((accepted: File[]) => {
    const valid = accepted.filter((f) => f.size <= 5 * 1024 * 1024);
    setNewPhotoFiles((prev) => [...prev, ...valid]);
    valid.forEach((f) => setNewPreviews((prev) => [...prev, URL.createObjectURL(f)]));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    multiple: true, maxSize: 5 * 1024 * 1024,
  });

  function removeNewPhoto(i: number) {
    URL.revokeObjectURL(newPreviews[i]);
    setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
    setNewPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleDeletePhoto(url: string) {
    try {
      const current = projectData?.photos ?? [];
      const updated = current.filter((u) => u !== url);
      await projectsApi.update(id, { photos: updated });
      qc.invalidateQueries({ queryKey: ['admin-proyecto', id] });
    } catch {
      setError('No se pudo eliminar la foto.');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);
    if (!form.title.trim())    return setError('El nombre es obligatorio');
    if (!form.slug.trim())     return setError('El slug es obligatorio');
    if (!form.location.trim()) return setError('La ubicación es obligatoria');
    if (!form.priceFrom || Number(form.priceFrom) <= 0)
      return setError('El precio debe ser mayor a 0');

    setSaving(true);
    try {
      await projectsApi.update(id, {
        title: form.title, slug: form.slug, description: form.description || undefined,
        location: form.location, department: form.department || undefined,
        priceFrom: Number(form.priceFrom),
        deliveryDate: form.deliveryDate || undefined,
        status: form.status,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        featured: form.featured, published: form.published,
      });
      if (newPhotoFiles.length > 0) {
        await projectsApi.uploadPhotos(id, newPhotoFiles);
        setNewPhotoFiles([]); setNewPreviews([]);
      }
      qc.invalidateQueries({ queryKey: ['admin-proyecto', id] });
      qc.invalidateQueries({ queryKey: ['admin-proyectos'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm('¿Archivar este proyecto? Dejará de aparecer en el sitio web.')) return;
    setDeleting(true);
    try {
      await projectsApi.delete(id);
      router.push('/admin/proyectos');
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No se encontró el proyecto.</p>
        <Link href="/admin/proyectos"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const existingPhotos = projectData.photos;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/proyectos">
            <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{projectData.title}</h1>
            <p className="text-xs text-slate-400">Creado {formatShortDate(projectData.createdAt)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
          onClick={handleArchive}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Archivar
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Info básica */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Información básica</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Nombre *</label>
              <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Slug (URL)</label>
              <input type="text" value={form.slug} onChange={(e) => set('slug', toSlug(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Descripción</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                rows={4} placeholder="Descripción del proyecto…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E] resize-none" />
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
                <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Departamento</label>
                <input type="text" value={form.department} onChange={(e) => set('department', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Detalles</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Precio desde (COP) *</label>
                <input type="number" min="0" value={form.priceFrom} onChange={(e) => set('priceFrom', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Fecha de entrega</label>
                <input type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Estado</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]">
                <option value="EN_PREVENTA">En preventa</option>
                <option value="EN_CONSTRUCCION">En construcción</option>
                <option value="PROXIMO_LANZAMIENTO">Próximo lanzamiento</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Teléfono contacto</label>
                <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email contacto</label>
                <input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973E]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fotos */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {existingPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {existingPhotos.map((url, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                    <Image src={url} alt={`foto ${i + 1}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(url)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div {...getRootProps()} className={cn(
              'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-[#B8973E] bg-amber-50' : 'border-slate-200 hover:border-[#B8973E]/50',
            )}>
              <input {...getInputProps()} />
              <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1" />
              <p className="text-xs text-slate-500">Agregar más fotos · JPG, PNG, WebP · máx. 5 MB</p>
            </div>
            {newPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {newPreviews.map((url, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                    <Image src={url} alt={`nueva ${i + 1}`} fill className="object-cover" />
                    <button type="button" onClick={() => removeNewPhoto(i)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[9px] px-1 rounded">nuevo</span>
                  </div>
                ))}
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
                <p className="text-sm font-medium text-slate-800">Publicado en el sitio</p>
                <p className="text-xs text-slate-400">Visible para el público</p>
              </div>
              <div onClick={() => set('published', !form.published)}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                  form.published ? 'bg-[#B8973E]' : 'bg-slate-200')}>
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  form.published ? 'translate-x-6' : 'translate-x-1')} />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800">Destacado en home</p>
              </div>
              <div onClick={() => set('featured', !form.featured)}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                  form.featured ? 'bg-[#B8973E]' : 'bg-slate-200')}>
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  form.featured ? 'translate-x-6' : 'translate-x-1')} />
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
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm text-green-700 font-medium">✓ Cambios guardados</p>
          </div>
        )}

        <Button type="submit" disabled={saving} className="w-full bg-[#B8973E] hover:bg-[#9a7d33]">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando…</> : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}
