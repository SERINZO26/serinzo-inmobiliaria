'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { blogApi } from '@/lib/api';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function NuevoArticuloPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title:         '',
    slug:          '',
    excerpt:       '',
    content:       '',
    coverImageUrl: '',
    published:     false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string | boolean) {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'title' ? { slug: toSlug(value as string) } : {}),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.title.trim())   return setError('El título es obligatorio');
    if (!form.slug.trim())    return setError('El slug es obligatorio');
    if (!form.content.trim()) return setError('El contenido es obligatorio');

    setSubmitting(true);
    try {
      const res = await blogApi.create({
        title:         form.title,
        slug:          form.slug,
        excerpt:       form.excerpt || undefined,
        content:       form.content,
        coverImageUrl: form.coverImageUrl || undefined,
        published:     form.published,
      });
      router.push(`/admin/blog/${res.data.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo crear el artículo.');
    } finally {
      setSubmitting(false);
    }
  }

  const excerptLen = form.excerpt.length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/blog">
          <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo artículo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Crea contenido de valor para tus clientes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Datos principales */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Información del artículo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Ej: Guía para comprar tu primera vivienda"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">URL del artículo (slug) *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => set('slug', toSlug(e.target.value))}
                placeholder="guia-primera-vivienda"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
              <p className="text-xs text-slate-400 mt-1">Solo minúsculas, números y guiones</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Imagen de portada (URL)</label>
              <input
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => set('coverImageUrl', e.target.value)}
                placeholder="https://res.cloudinary.com/…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
              <p className="text-xs text-slate-400 mt-1">Pega la URL de la imagen (Cloudinary, etc.)</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">Extracto (resumen)</label>
                <span className={`text-xs ${excerptLen > 160 ? 'text-red-500' : 'text-slate-400'}`}>
                  {excerptLen}/160
                </span>
              </div>
              <textarea
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Breve descripción que aparece en el listado del blog (máx. 160 caracteres)…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contenido */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contenido del artículo *</CardTitle></CardHeader>
          <CardContent>
            <textarea
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              rows={16}
              placeholder="Escribe aquí el contenido completo del artículo.

Puedes usar saltos de línea para separar párrafos.

Tip: incluye consejos prácticos, información del mercado y guías útiles para tus clientes."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 resize-none font-sans"
            />
            <p className="text-xs text-slate-400 mt-1">{form.content.length} caracteres</p>
          </CardContent>
        </Card>

        {/* Publicación */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Publicación</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800">Publicar ahora</p>
                <p className="text-xs text-slate-400">El artículo será visible en el blog del sitio web</p>
              </div>
              <div
                onClick={() => set('published', !form.published)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${form.published ? 'bg-slate-800' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.published ? 'translate-x-6' : 'translate-x-1'}`} />
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
          <Link href="/admin/blog" className="flex-1">
            <Button type="button" variant="outline" className="w-full" disabled={submitting}>Cancelar</Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex-1 bg-slate-800 hover:bg-slate-900">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando…</> : 'Crear artículo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
