'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MessageCircle, Menu, X, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/',           label: 'Inicio' },
  { href: '/inmuebles',  label: 'Inmuebles' },
  { href: '/proyectos',  label: 'Proyectos' },
  { href: '/blog',       label: 'Blog' },
  { href: '/simulador',  label: 'Simulador' },
  { href: '/contacto',   label: 'Contacto' },
];

const WA_NUMBER = '573182063924';
const WA_URL = `https://wa.me/${WA_NUMBER}`;

function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm h-24">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <Image
            src="/logo-serinzo.png"
            alt="Serinzo Inmobiliaria"
            width={200}
            height={80}
            className="h-16 w-auto object-contain"
            priority
          />
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Acceso panel + WhatsApp + hamburguesa */}
        <div className="flex items-center gap-3">
          {/* Acceso panel — solo visible en desktop */}
          <Link
            href="/login"
            className="hidden md:flex items-center gap-2 px-4 py-2 border border-[#B8973E] text-[#B8973E] rounded-lg hover:bg-[#B8973E] hover:text-white transition font-medium text-sm"
          >
            <LogIn className="h-4 w-4" />
            Acceso panel
          </Link>

          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>

          {/* Hamburguesa móvil */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'block px-3 py-2.5 rounded-lg text-sm font-medium',
                pathname === link.href
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-[#B8973E] hover:bg-amber-50 rounded-lg border border-[#B8973E]"
          >
            <LogIn className="h-4 w-4" />
            Acceso panel
          </Link>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      )}
    </header>
  );
}

// ── Íconos SVG de redes sociales ─────────────────────────────────────────────
function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.94a8.16 8.16 0 004.77 1.52V7.01a4.85 4.85 0 01-1-.32z" />
    </svg>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-slate-800 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Marca + redes sociales */}
          <div>
            <div className="bg-white rounded-lg p-2 inline-block mb-3">
              <Image
                src="/logo-serinzo.png"
                alt="Serinzo Inmobiliaria"
                width={100}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Tu aliado de confianza en la compra, venta y arriendo de inmuebles.
            </p>
            {/* Redes sociales */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/serinzoinmobiliaria"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#B8973E] hover:text-[#8B6E2E] transition-colors"
                aria-label="Instagram"
              >
                <IconInstagram />
              </a>
              <a
                href="https://www.facebook.com/share/14d6JC3dt6i/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#B8973E] hover:text-[#8B6E2E] transition-colors"
                aria-label="Facebook"
              >
                <IconFacebook />
              </a>
              {/* TikTok — próximamente */}
              <span
                title="Próximamente"
                className="text-slate-600 cursor-not-allowed"
                aria-label="TikTok — Próximamente"
              >
                <IconTikTok />
              </span>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="font-semibold text-white mb-3">Contacto</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="tel:+573182063924" className="hover:text-white transition-colors">
                  +57 318 206 3924
                </a>
              </li>
              <li>
                <a href="mailto:info@serinzo.com" className="hover:text-white transition-colors">
                  info@serinzo.com
                </a>
              </li>
            </ul>
          </div>

          {/* Navegación */}
          <div>
            <h3 className="font-semibold text-white mb-3">Navegación</h3>
            <ul className="space-y-2 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Herramientas */}
          <div>
            <h3 className="font-semibold text-white mb-3">Herramientas</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/simulador" className="hover:text-white transition-colors">
                  Simulador de crédito
                </Link>
              </li>
              <li>
                <Link href="/simulador" className="hover:text-white transition-colors">
                  Gastos notariales
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-700 text-center text-xs text-slate-500">
          © {year} Serinzo Inmobiliaria. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 pt-24">{children}</main>
      <Footer />
    </div>
  );
}
