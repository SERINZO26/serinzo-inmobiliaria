import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Calendar } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id:            string;
  title:         string;
  slug:          string;
  excerpt:       string | null;
  coverImageUrl: string | null;
  createdAt:     string;
  author:        { name: string } | null;
}

// ── Fetch del servidor ────────────────────────────────────────────────────────

async function getPosts(): Promise<BlogPost[]> {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
  try {
    const res = await fetch(`${apiUrl}/api/v1/blog`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

// ── Card ──────────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      {/* Foto */}
      <div className="relative aspect-video bg-slate-200">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-slate-300" />
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(post.createdAt)}</span>
          {post.author && (
            <>
              <span className="mx-1">·</span>
              <span>{post.author.name}</span>
            </>
          )}
        </div>
        <h2 className="font-bold text-slate-800 text-lg leading-tight mb-2 group-hover:text-[#B8973E] transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
        )}
        <span className="inline-block mt-3 text-[#B8973E] text-sm font-medium group-hover:underline">
          Leer artículo →
        </span>
      </div>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export const metadata = {
  title:       'Blog · Serinzo Inmobiliaria',
  description: 'Artículos y consejos sobre el mercado inmobiliario en Colombia.',
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-slate-800 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Blog inmobiliario</h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto">
            Consejos, tendencias y noticias del mercado inmobiliario
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {posts.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <BookOpen className="h-14 w-14 mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold mb-2">Próximamente</h2>
            <p className="text-sm max-w-xs mx-auto">
              Estamos preparando contenido de valor para ayudarte en tu decisión inmobiliaria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
