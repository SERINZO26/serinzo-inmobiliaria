'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { blogApi } from '@/lib/api';
import { formatShortDate } from '@/lib/format';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function EditarArticuloPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: postData, isLoading } = useQuery({
    queryKey: ['admin-blog-post', id],
    queryFn: async () => (await blogApi.getById(id)).data.data,
    enabled: !!id,
  });

  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', coverImageUrl: '', published: false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (!postData) return;
    setForm({
      title:         postData.title,
      slug:          postData.slug,
      excerpt:       postData.excerpt ?? '',
      content:       postData.content,
      coverImageUrl: postData.coverImageUrl ?? '',
      published:     postData.published,
    });
  }, [postData]);

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);
    if (!form.title.trim())   return setError('El título es obligatorio');
    if (!form.content.trim()) return setError('El contenido es obligatorio');

    setSaving(true);
    try {
      await blogApi.update(id, {
        title:         form.title,
        slug:          form.slug || toSlug(form.title),
        excerpt:       form.excerpt || undefined,
        content:       form.content,
        coverImageUrl: form.coverImageUrl || undefined,
        published:     form.published,
      });
      qc.invalidateQueries({ queryKey: ['admin-blog-post', id] });
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
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

  if (!postData) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No se encontró el artículo.</p>
        <Link href="/admin/blog"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const excerptLen = form.excerpt.length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog">
            <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 max-w-sm truncate">{postData.title}</h1>
            <p className="text-xs text-slate-400">Publicado {formatShortDate(postData.createdAt)}</p>
          </div>
        </div>
        {postData.published && (
          <a href={`/blog/${postData.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1">
              <ExternalLink className="h-3.5 w-3.5" /> Ver en sitio
            </Button>
          </a>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Información del artículo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Título *</label>
              <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Slug (URL)</label>
              <input type="text" value={form.slug} onChange={(e) => set('slug', toSlug(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Imagen de portada (URL)</label>
              <input type="url" value={form.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)}
                placeholder="https://…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">Extracto</label>
                <span className={`text-xs ${excerptLen > 160 ? 'text-red-500' : 'text-slate-400'}`}>
                  {excerptLen}/160
                </span>
              </div>
              <textarea value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)}
                rows={2} maxLength={200}
                placeholder="Breve descripción para el listado del blog…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 resize-none" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contenido *</CardTitle></CardHeader>
          <CardContent>
            <textarea value={form.content} onChange={(e) => set('content', e.target.value)}
              rows={18} placeholder="Contenido completo del artículo…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 resize-none font-sans" />
            <p className="text-xs text-slate-400 mt-1">{form.content.length} caracteres</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Publicación</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800">Publicado en el blog</p>
                <p className="text-xs text-slate-400">Visible en el sitio web</p>
              </div>
              <div onClick={() => set('published', !form.published)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${form.published ? 'bg-slate-800' : 'bg-slate-200'}`}>
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
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm text-green-700 font-medium">✓ Cambios guardados</p>
          </div>
        )}

        <Button type="submit" disabled={saving} className="w-full bg-slate-800 hover:bg-slate-900">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando…</> : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}
