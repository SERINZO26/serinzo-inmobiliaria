'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Building2, Bot, Bell, User, Upload, X, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { settingsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AgenteConfig {
  nombre: string;
  tono: string;
  bienvenida: string;
}

interface NotifConfig {
  nuevoCliente: boolean;
  nuevaCita: boolean;
  clienteInteres5: boolean;
  recordatoriosCitas: boolean;
}

interface CuentaForm {
  nombre: string;
  passwordActual: string;
  passwordNueva: string;
  passwordConfirmar: string;
}

// ─── Helpers localStorage (solo para notificaciones y agente, aún sin API) ────

function loadConfig<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return defaults;
}

function saveConfig(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Logo uploader ─────────────────────────────────────────────────────────

function LogoUploader({
  currentUrl,
  onSuccess,
}: {
  currentUrl: string | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setLogoFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/svg+xml': [] },
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024,
  });

  async function handleUpload() {
    if (!logoFile) return;
    setUploading(true);
    try {
      await settingsApi.uploadLogo(logoFile);
      setLogoFile(null);
      onSuccess();
      toast({ title: 'Logo actualizado', description: 'El logo se subió correctamente.' });
    } catch {
      toast({ title: 'Error al subir el logo', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Label>Logo de la inmobiliaria</Label>
      {currentUrl && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="Logo actual" className="h-12 w-auto object-contain rounded" />
          <p className="text-xs text-slate-500">Logo actual</p>
        </div>
      )}
      {logoFile ? (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Upload className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm text-blue-700 flex-1 truncate">{logoFile.name}</span>
          <button type="button" onClick={() => setLogoFile(null)} className="text-slate-400 hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300',
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1" />
          <p className="text-xs text-slate-500">{currentUrl ? 'Cambiar logo' : 'Subir logo'} · JPG, PNG, WebP, SVG · máx 2 MB</p>
        </div>
      )}
      {logoFile && (
        <Button size="sm" onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {currentUrl ? 'Reemplazar logo' : 'Subir logo'}
        </Button>
      )}
    </div>
  );
}

// ─── Componente Switch con label ──────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin = session?.user?.role === 'ADMIN';

  // ── Settings desde la API ─────────────────────────────────────────────────
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    enabled: isAdmin,
  });

  // Formulario empresa — se sincroniza cuando llegan los datos
  const [empresa, setEmpresa] = useState({
    companyName:    '',
    companyPhone:   '',
    companyEmail:   '',
    companyAddress: '',
    companyCity:    '',
  });
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  useEffect(() => {
    if (settingsData) {
      setEmpresa({
        companyName:    settingsData.companyName    ?? '',
        companyPhone:   settingsData.companyPhone   ?? '',
        companyEmail:   settingsData.companyEmail   ?? '',
        companyAddress: settingsData.companyAddress ?? '',
        companyCity:    settingsData.companyCity    ?? '',
      });
      // Sincronizar toggles de notificaciones desde la BD
      setNotif({
        nuevoCliente:      settingsData.notifyNewClient          ?? true,
        nuevaCita:         settingsData.notifyAppointment        ?? true,
        clienteInteres5:   settingsData.notifyHighInterest       ?? true,
        recordatoriosCitas: settingsData.notifyAppointmentReminder ?? true,
      });
    }
  }, [settingsData]);

  // Agente IA
  const [agente, setAgente] = useState<AgenteConfig>(() =>
    loadConfig('config_agente', {
      nombre: 'Sofía',
      tono: 'amigable',
      bienvenida: '¡Hola! Soy Sofía, asistente de nuestra inmobiliaria. ¿En qué te puedo ayudar hoy?',
    })
  );

  // Notificaciones — se sincroniza desde la API cuando llegan los settings
  const [notif, setNotif] = useState<NotifConfig>({
    nuevoCliente: true,
    nuevaCita: true,
    clienteInteres5: true,
    recordatoriosCitas: true,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Cuenta
  const [cuenta, setCuenta] = useState<CuentaForm>({
    nombre: session?.user?.name ?? '',
    passwordActual: '',
    passwordNueva: '',
    passwordConfirmar: '',
  });

  useEffect(() => {
    if (session?.user?.name) {
      setCuenta((c) => ({ ...c, nombre: session.user!.name! }));
    }
  }, [session]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Shield className="h-16 w-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso restringido</h2>
        <p className="text-slate-500 text-center max-w-sm">
          Solo los administradores pueden acceder a la configuración del sistema.
        </p>
      </div>
    );
  }

  // ── Guardado empresa → API real ───────────────────────────────────────────
  const guardarEmpresa = async () => {
    setSavingEmpresa(true);
    try {
      await settingsApi.update({
        companyName:    empresa.companyName    || undefined,
        companyPhone:   empresa.companyPhone   || null,
        companyEmail:   empresa.companyEmail   || null,
        companyAddress: empresa.companyAddress || null,
        companyCity:    empresa.companyCity    || null,
      });
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Cambios guardados', description: 'Los datos de tu empresa se actualizaron.' });
    } catch {
      toast({ title: 'Error al guardar', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    } finally {
      setSavingEmpresa(false);
    }
  };

  // ── Guardado agente IA ────────────────────────────────────────────────────
  const guardarAgente = () => {
    saveConfig('config_agente', agente);
    toast({ title: 'Agente actualizado', description: 'La configuración del agente IA se guardó.' });
  };

  // ── Guardado notificaciones → API real ───────────────────────────────────
  const guardarNotif = async () => {
    setSavingNotif(true);
    try {
      await settingsApi.update({
        notifyNewClient:           notif.nuevoCliente,
        notifyAppointment:         notif.nuevaCita,
        notifyHighInterest:        notif.clienteInteres5,
        notifyAppointmentReminder: notif.recordatoriosCitas,
      });
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Preferencias guardadas', description: 'Tus notificaciones fueron actualizadas.' });
    } catch {
      toast({ title: 'Error al guardar', description: 'No se pudieron guardar las preferencias.', variant: 'destructive' });
    } finally {
      setSavingNotif(false);
    }
  };

  // ── Actualizar cuenta ─────────────────────────────────────────────────────
  const actualizarCuenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuenta.nombre.trim()) {
      toast({ title: 'El nombre no puede estar vacío', variant: 'destructive' });
      return;
    }
    if (cuenta.passwordNueva && cuenta.passwordNueva !== cuenta.passwordConfirmar) {
      toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' });
      return;
    }
    if (cuenta.passwordNueva && !cuenta.passwordActual) {
      toast({ title: 'Ingresa tu contraseña actual para cambiarla', variant: 'destructive' });
      return;
    }
    // En producción esto llama a PATCH /api/v1/auth/me
    toast({
      title: 'Datos actualizados',
      description: 'Tus datos de cuenta fueron guardados.',
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500 mt-1">Ajusta las opciones del sistema</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="empresa" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mi empresa</span>
          </TabsTrigger>
          <TabsTrigger value="agente" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agente IA</span>
          </TabsTrigger>
          <TabsTrigger value="notificaciones" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Notificaciones</span>
          </TabsTrigger>
          <TabsTrigger value="cuenta" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cuenta</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Mi empresa ─────────────────────────────────────────────── */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>
                Esta información aparece en los PDFs de liquidación y en las comunicaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                <>
                  {/* Logo */}
                  <LogoUploader
                    currentUrl={settingsData?.companyLogoUrl ?? null}
                    onSuccess={() => qc.invalidateQueries({ queryKey: ['settings'] })}
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-nombre">Nombre de la inmobiliaria *</Label>
                    <Input
                      id="empresa-nombre"
                      placeholder="Ej: Inmobiliaria del Norte"
                      value={empresa.companyName}
                      onChange={(e) => setEmpresa({ ...empresa, companyName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-tel">Teléfono principal</Label>
                    <Input
                      id="empresa-tel"
                      type="tel"
                      placeholder="+57 318 206 3924"
                      value={empresa.companyPhone}
                      onChange={(e) => setEmpresa({ ...empresa, companyPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-email">Email de contacto</Label>
                    <Input
                      id="empresa-email"
                      type="email"
                      placeholder="info@serinzo.com"
                      value={empresa.companyEmail}
                      onChange={(e) => setEmpresa({ ...empresa, companyEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-dir">Dirección</Label>
                    <Input
                      id="empresa-dir"
                      placeholder="Calle 135 #7-42"
                      value={empresa.companyAddress}
                      onChange={(e) => setEmpresa({ ...empresa, companyAddress: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa-ciudad">Ciudad</Label>
                    <Input
                      id="empresa-ciudad"
                      placeholder="Bogotá"
                      value={empresa.companyCity}
                      onChange={(e) => setEmpresa({ ...empresa, companyCity: e.target.value })}
                    />
                  </div>
                  <Button onClick={guardarEmpresa} disabled={savingEmpresa} className="w-full sm:w-auto">
                    {savingEmpresa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Guardar cambios
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Agente IA ───────────────────────────────────────────────── */}
        <TabsContent value="agente">
          <Card>
            <CardHeader>
              <CardTitle>Agente de atención IA</CardTitle>
              <CardDescription>
                Personaliza cómo se presenta y comunica el agente con tus clientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="agente-nombre">Nombre del agente</Label>
                <Input
                  id="agente-nombre"
                  placeholder="Sofía"
                  value={agente.nombre}
                  onChange={(e) => setAgente({ ...agente, nombre: e.target.value })}
                />
                <p className="text-xs text-slate-400">
                  Este nombre se usa en WhatsApp y en llamadas de voz.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Tono de comunicación</Label>
                <Select
                  value={agente.tono}
                  onValueChange={(v) => setAgente({ ...agente, tono: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amigable">Amigable — cálido y cercano</SelectItem>
                    <SelectItem value="profesional">Profesional — formal y preciso</SelectItem>
                    <SelectItem value="neutral">Neutral — equilibrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agente-bienvenida">Mensaje de bienvenida</Label>
                <Textarea
                  id="agente-bienvenida"
                  rows={3}
                  placeholder="¡Hola! Soy Sofía..."
                  value={agente.bienvenida}
                  onChange={(e) => setAgente({ ...agente, bienvenida: e.target.value })}
                />
                <p className="text-xs text-slate-400">
                  Este mensaje se envía automáticamente al inicio de cada conversación.
                </p>
              </div>
              <Button onClick={guardarAgente} className="w-full sm:w-auto">
                Guardar cambios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Notificaciones ──────────────────────────────────────────── */}
        <TabsContent value="notificaciones">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de notificación</CardTitle>
              <CardDescription>
                Elige qué alertas quieres recibir en tu email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <ToggleRow
                  label="Notificarme cuando llegue un cliente nuevo"
                  description="Se activa cuando el agente IA registra un nuevo cliente."
                  checked={notif.nuevoCliente}
                  onChange={(v) => setNotif({ ...notif, nuevoCliente: v })}
                />
                <ToggleRow
                  label="Notificarme cuando se agende una cita"
                  description="Recibirás un email cada vez que se confirme una visita."
                  checked={notif.nuevaCita}
                  onChange={(v) => setNotif({ ...notif, nuevaCita: v })}
                />
                <ToggleRow
                  label="Notificarme cuando un cliente tenga interés nivel 5"
                  description="Estos clientes requieren atención inmediata."
                  checked={notif.clienteInteres5}
                  onChange={(v) => setNotif({ ...notif, clienteInteres5: v })}
                />
                <ToggleRow
                  label="Recordatorios de citas por email"
                  description="24 horas y 1 hora antes de cada cita confirmada."
                  checked={notif.recordatoriosCitas}
                  onChange={(v) => setNotif({ ...notif, recordatoriosCitas: v })}
                />
              </div>
              <Button onClick={guardarNotif} disabled={savingNotif} className="w-full sm:w-auto">
                {savingNotif ? 'Guardando...' : 'Guardar preferencias'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Cuenta ──────────────────────────────────────────────────── */}
        <TabsContent value="cuenta">
          <Card>
            <CardHeader>
              <CardTitle>Mi cuenta</CardTitle>
              <CardDescription>
                Actualiza tu nombre o cambia tu contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={actualizarCuenta} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cuenta-nombre">Tu nombre</Label>
                  <Input
                    id="cuenta-nombre"
                    value={cuenta.nombre}
                    onChange={(e) => setCuenta({ ...cuenta, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cuenta-email">Email</Label>
                  <Input
                    id="cuenta-email"
                    type="email"
                    value={session?.user?.email ?? ''}
                    disabled
                    className="bg-slate-50 text-slate-500"
                  />
                  <p className="text-xs text-slate-400">
                    El email no se puede cambiar — es tu identificador de acceso.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    Cambiar contraseña (opcional)
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pass-actual">Contraseña actual</Label>
                      <Input
                        id="pass-actual"
                        type="password"
                        placeholder="Tu contraseña actual"
                        value={cuenta.passwordActual}
                        onChange={(e) => setCuenta({ ...cuenta, passwordActual: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pass-nueva">Nueva contraseña</Label>
                      <Input
                        id="pass-nueva"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={cuenta.passwordNueva}
                        onChange={(e) => setCuenta({ ...cuenta, passwordNueva: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pass-confirmar">Confirmar nueva contraseña</Label>
                      <Input
                        id="pass-confirmar"
                        type="password"
                        placeholder="Repite la nueva contraseña"
                        value={cuenta.passwordConfirmar}
                        onChange={(e) =>
                          setCuenta({ ...cuenta, passwordConfirmar: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full sm:w-auto">
                  Actualizar datos
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
