'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { clientsApi, staffApi, type UserRole } from '@/lib/api';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Operacion = 'venta' | 'arriendo' | '';

const TIPOS_INMUEBLE = [
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'LOTE', label: 'Lote' },
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'FINCA', label: 'Finca' },
];

const ORIGENES = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'web', label: 'Web' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'referido', label: 'Referido' },
  { value: 'visita_directa', label: 'Visita directa' },
];

// ─── Componente chips de selección múltiple ───────────────────────────────────

function ChipMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm border transition-colors',
            selected.includes(opt.value)
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ClienteNuevoPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  const isAdmin = session?.user?.role === 'ADMIN';

  // Agentes activos (para asignación — solo admin)
  const { data: agentesData } = useQuery({
    queryKey: ['staff', 'agents'],
    queryFn: () => staffApi.getAll({ role: 'AGENT' as UserRole, status: 'ACTIVE' }),
    enabled: isAdmin,
  });

  const agentes = agentesData?.data?.data ?? [];

  // ── Estado del formulario ─────────────────────────────────────────────────

  const [contacto, setContacto] = useState({
    nombre: '',
    telefono: '',
    email: '',
    origen: '',
  });

  const [busqueda, setBusqueda] = useState({
    operacion: '' as Operacion,
    tipos: [] as string[],
    presupuestoMin: '',
    presupuestoMax: '',
    zonas: '',
    habitaciones: '',
    requisitos: '',
  });

  const [asignacion, setAsignacion] = useState({
    agentId: '',
    interes: 1,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // ── Validación ────────────────────────────────────────────────────────────

  const validate = () => {
    const e: Record<string, string> = {};
    if (!contacto.nombre.trim()) e.nombre = 'El nombre es requerido';
    if (!contacto.telefono.trim()) e.telefono = 'El teléfono es requerido';
    if (!contacto.origen) e.origen = 'Selecciona cómo llegó el cliente';
    return e;
  };

  // ── Envío ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: contacto.nombre.trim(),
        phone: contacto.telefono.trim(),
        email: contacto.email.trim() || undefined,
        source: contacto.origen,
        preferredOperation: busqueda.operacion || undefined,
        preferredType: busqueda.tipos,
        budgetMin: busqueda.presupuestoMin
          ? parseInt(busqueda.presupuestoMin.replace(/\D/g, ''), 10)
          : undefined,
        budgetMax: busqueda.presupuestoMax
          ? parseInt(busqueda.presupuestoMax.replace(/\D/g, ''), 10)
          : undefined,
        preferredZones: busqueda.zonas
          ? busqueda.zonas.split(',').map((z) => z.trim()).filter(Boolean)
          : [],
        minBedrooms: busqueda.habitaciones ? parseInt(busqueda.habitaciones, 10) : undefined,
        additionalRequirements: busqueda.requisitos.trim() || undefined,
        assignedAgentId: asignacion.agentId || undefined,
        interestLevel: asignacion.interes,
      };

      const res = await clientsApi.create(payload);
      const cliente = res.data.data;

      toast({
        title: 'Cliente guardado',
        description: `${cliente.name} fue agregado al CRM exitosamente.`,
      });
      router.push(`/admin/clientes/${cliente.id}`);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast({
        title: 'No se pudo guardar el cliente',
        description:
          apiErr.response?.data?.error ?? 'Verifica los datos e intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nuevo cliente</h1>
          <p className="text-slate-500 text-sm">Agrega un cliente al CRM manualmente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* ── Sección: Datos de contacto ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">
                Nombre completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                placeholder="Juan Pérez"
                value={contacto.nombre}
                onChange={(e) => {
                  setContacto({ ...contacto, nombre: e.target.value });
                  setErrors({ ...errors, nombre: '' });
                }}
              />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefono">
                Teléfono <span className="text-red-500">*</span>
              </Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="+57 300 000 0000"
                value={contacto.telefono}
                onChange={(e) => {
                  setContacto({ ...contacto, telefono: e.target.value });
                  setErrors({ ...errors, telefono: '' });
                }}
              />
              {errors.telefono && <p className="text-xs text-red-600">{errors.telefono}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="juan@email.com"
                value={contacto.email}
                onChange={(e) => setContacto({ ...contacto, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                ¿Cómo llegó? <span className="text-red-500">*</span>
              </Label>
              <Select
                value={contacto.origen}
                onValueChange={(v) => {
                  setContacto({ ...contacto, origen: v });
                  setErrors({ ...errors, origen: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el origen..." />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.origen && <p className="text-xs text-red-600">{errors.origen}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ── Sección: Qué está buscando ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Qué está buscando?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Operación */}
            <div className="space-y-2">
              <Label>¿Quiere comprar o arrendar?</Label>
              <div className="flex gap-3">
                {[
                  { value: 'venta', label: 'Comprar' },
                  { value: 'arriendo', label: 'Arrendar' },
                ].map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() =>
                      setBusqueda({
                        ...busqueda,
                        operacion: busqueda.operacion === op.value ? '' : (op.value as Operacion),
                      })
                    }
                    className={cn(
                      'flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
                      busqueda.operacion === op.value
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-400'
                    )}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de inmueble */}
            <div className="space-y-2">
              <Label>Tipo de inmueble (puede seleccionar varios)</Label>
              <ChipMultiSelect
                options={TIPOS_INMUEBLE}
                selected={busqueda.tipos}
                onChange={(v) => setBusqueda({ ...busqueda, tipos: v })}
              />
            </div>

            {/* Presupuesto */}
            <div className="space-y-2">
              <Label>Presupuesto (COP)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Mínimo</p>
                  <Input
                    type="text"
                    placeholder="Ej: 200000000"
                    value={busqueda.presupuestoMin}
                    onChange={(e) =>
                      setBusqueda({ ...busqueda, presupuestoMin: e.target.value.replace(/\D/g, '') })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Máximo</p>
                  <Input
                    type="text"
                    placeholder="Ej: 500000000"
                    value={busqueda.presupuestoMax}
                    onChange={(e) =>
                      setBusqueda({ ...busqueda, presupuestoMax: e.target.value.replace(/\D/g, '') })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Zonas */}
            <div className="space-y-1.5">
              <Label htmlFor="zonas">Zonas de interés</Label>
              <Input
                id="zonas"
                placeholder="Ej: Chapinero, Usaquén, Suba"
                value={busqueda.zonas}
                onChange={(e) => setBusqueda({ ...busqueda, zonas: e.target.value })}
              />
              <p className="text-xs text-slate-400">Separa las zonas con coma</p>
            </div>

            {/* Habitaciones mínimas */}
            <div className="space-y-1.5">
              <Label>Habitaciones mínimas</Label>
              <Select
                value={busqueda.habitaciones}
                onValueChange={(v) => setBusqueda({ ...busqueda, habitaciones: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Cualquiera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 habitación</SelectItem>
                  <SelectItem value="2">2 habitaciones</SelectItem>
                  <SelectItem value="3">3 habitaciones</SelectItem>
                  <SelectItem value="4">4 habitaciones</SelectItem>
                  <SelectItem value="5">5 o más</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Requisitos adicionales */}
            <div className="space-y-1.5">
              <Label htmlFor="requisitos">Requerimientos adicionales</Label>
              <Textarea
                id="requisitos"
                rows={3}
                placeholder="Ej: Necesita parqueadero doble, busca cerca al metro, no le gustan los PH..."
                value={busqueda.requisitos}
                onChange={(e) => setBusqueda({ ...busqueda, requisitos: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Sección: Asignación ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asignación y seguimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agente — solo admin */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Agente responsable</Label>
                <Select
                  value={asignacion.agentId || undefined}
                  onValueChange={(v) => setAsignacion({ ...asignacion, agentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Nivel de interés inicial */}
            <div className="space-y-2">
              <Label>Nivel de interés inicial</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAsignacion({ ...asignacion, interes: n })}
                    className={cn(
                      'h-10 w-10 rounded-full text-sm font-semibold transition-colors border-2',
                      asignacion.interes === n
                        ? n <= 2
                          ? 'bg-red-500 border-red-500 text-white'
                          : n === 3
                          ? 'bg-yellow-400 border-yellow-400 text-white'
                          : n === 4
                          ? 'bg-green-400 border-green-400 text-white'
                          : 'bg-green-600 border-green-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {['', 'Sin interés', 'Poco interés', 'Explorando', 'Interesado', 'Muy interesado'][
                  asignacion.interes
                ]}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Guardando...' : 'Guardar cliente'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/clientes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
