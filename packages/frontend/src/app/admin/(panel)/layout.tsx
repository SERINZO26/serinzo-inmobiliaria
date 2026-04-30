'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  MessageSquare,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  DollarSign,
  Bell,
} from 'lucide-react';
import { rentalApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/admin/dashboard',      label: 'Dashboard',      icon: LayoutDashboard, roles: ['ADMIN', 'AGENT', 'ASSISTANT'] },
  { href: '/admin/inmuebles',      label: 'Inmuebles',      icon: Building2,       roles: ['ADMIN', 'AGENT', 'ASSISTANT'] },
  { href: '/admin/clientes',       label: 'Clientes',       icon: Users,           roles: ['ADMIN', 'AGENT', 'ASSISTANT'] },
  { href: '/admin/citas',          label: 'Citas',          icon: CalendarCheck,   roles: ['ADMIN', 'AGENT', 'ASSISTANT'] },
  { href: '/admin/arriendos',      label: 'Arriendos',      icon: FileText,        roles: ['ADMIN', 'AGENT', 'ASSISTANT'], badge: 'arriendos' },
  { href: '/admin/ventas',         label: 'Ventas',         icon: DollarSign,      roles: ['ADMIN', 'AGENT', 'ASSISTANT'] },
  { href: '/admin/conversaciones', label: 'Conversaciones', icon: MessageSquare,   roles: ['ADMIN', 'AGENT', 'ASSISTANT'] },
  { href: '/admin/equipo',         label: 'Equipo',         icon: UserCog,         roles: ['ADMIN'] },
  { href: '/admin/configuracion',  label: 'Configuración',  icon: Settings,        roles: ['ADMIN'] },
];

function roleLabel(role: string) {
  const map: Record<string, string> = { ADMIN: 'Administrador', AGENT: 'Agente', ASSISTANT: 'Asistente' };
  return map[role] ?? role;
}

function initials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? '';

  // Pagos PENDIENTE con vencimiento en ≤ 10 días — para el badge rojo del sidebar
  const { data: pendingData } = useQuery({
    queryKey: ['pending-payments-count'],
    queryFn: async () => (await rentalApi.getPendingPayments()).data.data,
    staleTime: 5 * 60 * 1000, // refrescar cada 5 minutos
  });
  const alertCount = pendingData?.count ?? 0;

  return (
    <aside className="flex flex-col h-full bg-slate-900 text-white w-60">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-white/10 p-1.5 rounded-lg">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-semibold text-sm leading-tight">Sistema<br />Inmobiliario</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <Separator className="bg-slate-700/50" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const showBadge = item.badge === 'arriendos' && alertCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/8',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>

      <Separator className="bg-slate-700/50" />

      {/* User footer */}
      <div className="px-3 py-4 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="h-8 w-8 bg-slate-600">
            <AvatarFallback className="bg-slate-600 text-white text-xs">
              {initials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-slate-400">{roleLabel(role)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/8 gap-2"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar móvil overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 hover:text-slate-900"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-700" />
            <span className="font-semibold text-slate-800 text-sm">Sistema Inmobiliario</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
