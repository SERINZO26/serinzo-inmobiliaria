'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen, Plus, Eye, Trash2, Globe, EyeOff,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { blogApi, type BlogPost } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function BlogAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog', page],
    queryFn: async () => (await blogApi.getAll({ page, limit: 20 })).data,
  });

  const posts: BlogPost[] = data?.data ?? [];
  const meta = data?.meta;

  const deleteMut = useMutation({
    mutationFn: (id: string) => blogApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-blog'] }),
  });

  const togglePublish = async (post: BlogPost) => {
    await blogApi.update(post.id, { published: !post.published });
    qc.invalidateQueries({ queryKey: ['admin-blog'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Blog</h1>
          <p className="text-sm text-slate-500 mt-0.5">Artículos y contenido de valor para clientes</p>
        </div>
        <Link href="/admin/blog/nuevo">
          <Button className="gap-2 bg-slate-800 hover:bg-slate-900">
            <Plus className="h-4 w-4" /> Nuevo artículo
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Imagen', 'Título', 'Autor', 'Fecha', 'Publicado', 'Acciones'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                ))}</tr>
              ))}
              {!isLoading && posts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No hay artículos publicados. ¡Crea el primero!</p>
                  </td>
                </tr>
              )}
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    {post.coverImageUrl ? (
                      <div className="relative w-16 h-10 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                        <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-10 rounded bg-slate-100 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 max-w-[300px] truncate">{post.title}</p>
                    {post.excerpt && (
                      <p className="text-xs text-slate-400 max-w-[300px] truncate">{post.excerpt}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {(post as BlogPost & { author?: { name: string } }).author?.name ?? '–'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatShortDate(post.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublish(post)}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors',
                        post.published
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                      )}
                    >
                      {post.published
                        ? <><Globe className="h-3 w-3" /> Publicado</>
                        : <><EyeOff className="h-3 w-3" /> Borrador</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/blog/${post.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="Despublicar"
                        onClick={() => {
                          if (confirm(`¿Despublicar el artículo "${post.title}"?`)) {
                            deleteMut.mutate(post.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">{meta.total} artículo{meta.total !== 1 ? 's' : ''} · página {meta.page} de {meta.totalPages}</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-7 w-7 p-0">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 p-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
