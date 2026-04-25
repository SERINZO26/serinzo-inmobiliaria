'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { staffApi, type UserRole } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function generarContrasenaAleatoria(): string {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%';
  const todos = mayusculas + minusculas + numeros + especiales;
  let pass = '';
  pass += mayusculas[Math.floor(Math.random() * mayusculas.length)];
  pass += minusculas[Math.floor(Math.random() * minusculas.length)];
  pass += numeros[Math.floor(Math.random() * numeros.length)];
  pass += especiales[Math.floor(Math.random() * especiales.length)];
  for (let i = 0; i < 6; i++) {
    pass += todos[Math.floor(Math.random() * todos.length)];
  }
  return pass.split('').sort(() => Math.random() - 0.5).join('');
}

export default function EquipoNuevoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '' as UserRole | '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = 'El nombre debe tener al menos 2 caracteres';
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email))
      e.email = 'Ingresa un email válido';
    if (!form.role) e.role = 'Selecciona un rol';
    if (!form.password || form.password.length < 6)
      e.password = 'La contraseña debe tener al menos 6 caracteres';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const res = await staffApi.create({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        role: form.role as UserRole,
        password: form.password,
      });
      const usuario = res.data.data;
      toast({
        title: 'Usuario creado',
        description: `${usuario.name} fue agregado al equipo exitosamente.`,
      });
      router.push('/admin/equipo');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast({
        title: 'No se pudo crear el usuario',
        description: apiErr.response?.data?.error ?? 'Verifica los datos e intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/equipo">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agregar usuario</h1>
          <p className="text-slate-500 text-sm">Crea una cuenta para un miembro del equipo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del usuario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nombre completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="María González"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="maria@inmobiliaria.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+57 300 000 0000"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label>
                Rol <span className="text-red-500">*</span>
              </Label>
              <Select value={form.role} onValueChange={(v) => set('role', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador — acceso completo</SelectItem>
                  <SelectItem value="AGENT">Agente — sus inmuebles y clientes</SelectItem>
                  <SelectItem value="ASSISTANT">Asistente — solo lectura y edición básica</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-red-600">{errors.role}</p>}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Contraseña temporal <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={mostrarPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    className="pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    {mostrarPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generar contraseña aleatoria"
                  onClick={() => {
                    const p = generarContrasenaAleatoria();
                    set('password', p);
                    setMostrarPassword(true);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
              <p className="text-xs text-slate-400">
                El usuario deberá cambiarla la primera vez que inicie sesión.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Creando usuario...' : 'Crear usuario'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/equipo">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
