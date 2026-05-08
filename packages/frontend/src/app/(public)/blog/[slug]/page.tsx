import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar } from 'lucide-react';
import type { Metadata } from 'next';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id:            string;
  title:         string;
  slug:          string;
  excerpt:       string | null;
  content:       string;
  coverImageUrl: string | null;
  createdAt:     string;
  author:        { name: string } | null;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/blog/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Metadata dinámica ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: 'Artículo no encontrado' };
  return {
    title:       `${post.title} · Blog Serinzo`,
    description: post.excerpt ?? post.title,
    openGraph: {
      title:       post.title,
      description: post.excerpt ?? post.title,
      images:      post.coverImageUrl ? [post.coverImageUrl] : [],
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Foto de portada */}
      {post.coverImageUrl && (
        <div className="relative w-full h-64 sm:h-80 lg:h-96 bg-slate-200">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        </div>
      )}

      {/* Artículo */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Volver */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-[#B8973E] hover:text-[#8B6E2E] font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al blog
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(post.createdAt)}</span>
          {post.author && (
            <>
              <span className="mx-1">·</span>
              <span>Por {post.author.name}</span>
            </>
          )}
        </div>

        {/* Título */}
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-6">
          {post.title}
        </h1>

        {/* Extracto destacado */}
        {post.excerpt && (
          <p className="text-lg text-slate-500 leading-relaxed mb-8 pb-8 border-b border-slate-200 italic">
            {post.excerpt}
          </p>
        )}

        {/* Contenido — renderizado como texto con saltos de línea preservados */}
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-line">
          {post.content}
        </div>

        {/* CTA final */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[#B8973E] hover:text-[#8B6E2E] font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al blog
          </Link>
          <a
            href={`https://wa.me/573182063924?text=${encodeURIComponent(`Hola, leí el artículo "${post.title}" en su página y quisiera más información`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Consultar por WhatsApp
          </a>
        </div>
      </article>
    </div>
  );
}
