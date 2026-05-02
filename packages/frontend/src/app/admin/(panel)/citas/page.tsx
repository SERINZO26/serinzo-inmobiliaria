'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Plus, List, CalendarDays, ChevronLeft, ChevronRight,
  AlertTriangle, MoreVertical, X,
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { appointmentsApi, clientsApi, propertiesApi, staffApi, type Appointment, type AppointmentStatus } from '@/lib/api';
import {
  formatDateTime, formatDate, formatTime, appointmentStatusColor, appointmentStatusLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Opciones de estado ───────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'REAGENDADA', label: 'Reagendada' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'REALIZADA', label: 'Realizada' },
  { value: 'NO_ASISTIO', label: 'No asistió' },
];

// ─── Color de borde + fondo para cita en vista semana ────────────────────────
// Coincide exactamente con los colores de los badges de la lista

function appointmentBorderColor(status: string): string {
  const map: Record<string, string> = {
    PENDIENTE:  'border-yellow-400 bg-yellow-100 text-yellow-800',
    CONFIRMADA: 'border-green-400  bg-green-100  text-green-800',
    REAGENDADA: 'border-blue-400   bg-blue-100   text-blue-800',
    REALIZADA:  'border-emerald-400 bg-emerald-100 text-emerald-800',
    NO_ASISTIO: 'border-gray-400   bg-gray-100   text-gray-600',
  };
  return map[status] ?? 'border-gray-300 bg-gray-50 text-gray-600';
}

// ─── Modal de detalle de cita ─────────────────────────────────────────────────

interface DetailModalProps {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
}

function DetailModal({ appointment, open, onClose }: DetailModalProps) {
  const queryClient = useQueryClient();
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const confirmMutation = useMutation({
    mutationFn: () => appointmentsApi.updateStatus(appointment!.id, 'CONFIRMADA'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); onClose(); },
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => {
      const scheduledAt = `${rescheduleDate}T${rescheduleTime}:00`;
      return appointmentsApi.reschedule(appointment!.id, scheduledAt);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); onClose(); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => appointmentsApi.updateStatus(appointment!.id, 'CANCELADA', cancelReason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); onClose(); },
  });

  function handleClose() {
    setShowReschedule(false);
    setShowCancel(false);
    setRescheduleDate('');
    setRescheduleTime('');
    setCancelReason('');
    onClose();
  }

  if (!appointment) return null;

  const canAct = appointment.status === 'PENDIENTE' || appointment.status === 'CONFIRMADA';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Detalle de cita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Banner caso especial */}
          {appointment.isSpecialCase && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Caso especial — coordinar manualmente con el cliente</span>
            </div>
          )}

          {/* Info principal */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Cliente</span>
              <div className="text-right">
                <p className="font-medium text-slate-800">{appointment.client?.name ?? '—'}</p>
                <p className="text-xs text-slate-400">{appointment.client?.phone}</p>
              </div>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Inmueble</span>
              <div className="text-right">
                <p className="font-medium text-slate-800 max-w-[220px] truncate">{appointment.property?.title ?? '—'}</p>
                <p className="text-xs text-slate-400">{appointment.property?.city}</p>
              </div>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Agente</span>
              <span className="font-medium text-slate-800">{appointment.agent?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Fecha y hora</span>
              <span className="font-medium text-slate-800">{formatDateTime(appointment.scheduledAt)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Duración</span>
              <span className="font-medium text-slate-800">{appointment.durationMinutes} minutos</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-400">Estado</span>
              <Badge className={cn('border-0 text-xs', appointmentStatusColor(appointment.status))}>
                {appointmentStatusLabel(appointment.status)}
              </Badge>
            </div>
            {appointment.notes && (
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400">Notas</span>
                <span className="text-slate-700 max-w-[220px] text-right">{appointment.notes}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Confirmación enviada</span>
              <span className={appointment.confirmationSent ? 'text-green-600 font-medium' : 'text-slate-400'}>
                {appointment.confirmationSent ? '✓ Sí' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Formulario de reagendar */}
          {showReschedule && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">Reagendar cita</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-blue-700 mb-1 block">Nueva fecha</Label>
                  <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-blue-700 mb-1 block">Nueva hora</Label>
                  <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={!rescheduleDate || !rescheduleTime || rescheduleMutation.isPending}
                  onClick={() => rescheduleMutation.mutate()}
                >
                  {rescheduleMutation.isPending ? 'Guardando...' : 'Confirmar reagendamiento'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReschedule(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Formulario de cancelar */}
          {showCancel && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">Cancelar cita</p>
              <Textarea
                placeholder="Motivo de cancelación (obligatorio)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-sm min-h-[70px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCancel(false)}>Volver</Button>
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        {canAct && !showReschedule && !showCancel && (
          <DialogFooter className="flex-row gap-2 sm:flex-row">
            {appointment.status === 'PENDIENTE' && (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar cita'}
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => setShowReschedule(true)}>
              Reagendar
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowCancel(true)}
            >
              Cancelar cita
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de creación de cita ────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  defaultAgentId?: string;
}

function CreateModal({ open, onClose, defaultAgentId }: CreateModalProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [clientId, setClientId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [agentId, setAgentId] = useState(defaultAgentId ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [isSpecialCase, setIsSpecialCase] = useState(false);
  const [specialCaseNotes, setSpecialCaseNotes] = useState('');
  const [error, setError] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-select'],
    queryFn: async () => (await clientsApi.getAll({ limit: 100 })).data.data,
    enabled: open,
  });

  const { data: properties } = useQuery({
    queryKey: ['properties-select'],
    queryFn: async () => (await propertiesApi.getAll({ limit: 100, status: 'DISPONIBLE' })).data.data,
    enabled: open,
  });

  // Lista de agentes para el select (solo se carga si es admin)
  const { data: agents } = useQuery({
    queryKey: ['agents-select'],
    queryFn: async () => (await staffApi.getAll({ role: 'AGENT', status: 'ACTIVE' })).data.data,
    enabled: open && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const agentList = agents ?? [];

  // Si hay un solo agente y no hay defaultAgentId, preseleccionarlo automáticamente
  useEffect(() => {
    if (isAdmin && !agentId && agentList.length === 1) {
      setAgentId(agentList[0].id);
    }
  }, [agentList, isAdmin, agentId]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!clientId || !propertyId || !agentId || !date || !time) {
        throw new Error('Completa todos los campos obligatorios');
      }
      return appointmentsApi.create({
        clientId,
        propertyId,
        agentId,
        scheduledAt: `${date}T${time}:00`,
        durationMinutes: duration,
        notes: notes || undefined,
        isSpecialCase,
        specialCaseNotes: isSpecialCase ? specialCaseNotes : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleClose() {
    setClientId('');
    setPropertyId('');
    setAgentId(defaultAgentId ?? '');
    setDate('');
    setTime('');
    setDuration(60);
    setNotes('');
    setIsSpecialCase(false);
    setSpecialCaseNotes('');
    setError('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Agendar nueva cita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Cliente */}
          <div>
            <Label className="text-slate-600 mb-1.5 block">Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inmueble */}
          <div>
            <Label className="text-slate-600 mb-1.5 block">Inmueble *</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar inmueble..." />
              </SelectTrigger>
              <SelectContent>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} — {p.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agente responsable */}
          <div>
            <Label className="text-slate-600 mb-1.5 block">Agente responsable *</Label>
            {isAdmin ? (
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agente..." />
                </SelectTrigger>
                <SelectContent>
                  {agentList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // Para rol AGENT: campo readonly mostrando el nombre del agente
              <Input
                value={session?.user?.name ?? 'Asignado automáticamente'}
                readOnly
                className="bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            )}
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-600 mb-1.5 block">Fecha *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-600 mb-1.5 block">Hora *</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {/* Duración */}
          <div>
            <Label className="text-slate-600 mb-1.5 block">Duración (minutos)</Label>
            <Input
              type="number"
              min={15}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          {/* Notas */}
          <div>
            <Label className="text-slate-600 mb-1.5 block">Notas (opcional)</Label>
            <Textarea
              placeholder="Instrucciones especiales, notas para el agente..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[70px]"
            />
          </div>

          {/* Caso especial */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
            <input
              type="checkbox"
              id="isSpecialCase"
              checked={isSpecialCase}
              onChange={(e) => setIsSpecialCase(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <Label htmlFor="isSpecialCase" className="cursor-pointer text-slate-700">
              Caso especial (sin disponibilidad regular)
            </Label>
          </div>

          {isSpecialCase && (
            <Textarea
              placeholder="Notas sobre el caso especial — qué coordinar manualmente..."
              value={specialCaseNotes}
              onChange={(e) => setSpecialCaseNotes(e.target.value)}
              className="min-h-[70px]"
            />
          )}

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Agendando...' : 'Verificar y agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vista de semana ──────────────────────────────────────────────────────────

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface WeekViewProps {
  weekStart: Date;
  appointments: Appointment[];
  onSelect: (apt: Appointment) => void;
}

function WeekView({ weekStart, appointments, onSelect }: WeekViewProps) {
  // 7 días desde el lunes de la semana (weekStart ya es lunes por startOfWeek weekStartsOn:1)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <div className="grid grid-cols-7 divide-x divide-slate-100 min-w-[700px]">
        {days.map((day, i) => {
          const dayApts = appointments.filter((a) => isSameDay(new Date(a.scheduledAt), day));
          const isWeekend = i >= 5;
          return (
            <div key={i} className={cn('min-h-[300px]', isWeekend && 'bg-slate-50/60')}>
              {/* Encabezado del día */}
              <div className={cn('px-2 py-2.5 border-b border-slate-100', isWeekend ? 'bg-slate-100' : 'bg-slate-50')}>
                <p className={cn('text-xs font-semibold', isWeekend ? 'text-slate-400' : 'text-slate-500')}>{WEEKDAYS[i]}</p>
                <p className="text-sm font-bold text-slate-800">{format(day, 'd', { locale: es })}</p>
              </div>

              {/* Citas del día */}
              <div className="p-2 space-y-1.5">
                {dayApts.length === 0 ? (
                  <p className="text-xs text-slate-200 text-center mt-4">Sin citas</p>
                ) : (
                  dayApts.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => onSelect(apt)}
                      className={cn(
                        'w-full text-left rounded-md border-l-4 hover:opacity-80 px-2 py-1.5 transition-colors',
                        appointmentBorderColor(apt.status),
                      )}
                    >
                      <p className="text-xs font-semibold">
                        {formatTime(apt.scheduledAt)}
                      </p>
                      <p className="text-xs truncate">{apt.client?.name ?? '—'}</p>
                      {apt.isSpecialCase && (
                        <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CitasPage() {
  const { data: session } = useSession();
  const [view, setView] = useState<'list' | 'week'>('list');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Semana actual para la vista semanal
  const weekStart = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addWeeks(monday, weekOffset);
  }, [weekOffset]);

  const weekEnd = addDays(weekStart, 6);

  // Parámetros para lista
  const listParams: Record<string, string | number> = { page, limit: 20 };
  if (statusFilter !== 'todos') listParams.status = statusFilter;
  if (fromDate) listParams.from = fromDate;
  if (toDate) listParams.to = toDate;

  // Parámetros para semana
  const weekParams: Record<string, string | number> = {
    from: format(weekStart, 'yyyy-MM-dd'),
    to: format(weekEnd, 'yyyy-MM-dd'),
    limit: 100,
  };

  const { data: listResponse, isLoading: listLoading } = useQuery({
    queryKey: ['appointments', 'list', listParams],
    queryFn: async () => (await appointmentsApi.getAll(listParams)).data,
    enabled: view === 'list',
  });

  const { data: weekResponse, isLoading: weekLoading } = useQuery({
    queryKey: ['appointments', 'week', weekParams],
    queryFn: async () => (await appointmentsApi.getAll(weekParams)).data,
    enabled: view === 'week',
  });

  const listApts = listResponse?.data ?? [];
  const weekApts = weekResponse?.data ?? [];
  const total = listResponse?.meta?.total ?? 0;
  const totalPages = listResponse?.meta?.totalPages ?? 1;

  function openDetail(apt: Appointment) {
    setSelectedApt(apt);
    setShowDetail(true);
  }

  // Etiqueta del rango de la semana (lunes → domingo)
  const weekLabel = `${format(weekStart, 'd', { locale: es })}–${format(weekEnd, 'd MMM yyyy', { locale: es })}`;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Citas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de visitas y citas con clientes</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="h-4 w-4" />
          Agendar cita
        </Button>
      </div>

      {/* ── Toggle de vista ── */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5 bg-white">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
          <button
            onClick={() => setView('week')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === 'week' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Semana
          </button>
        </div>

        {/* Navegación de semana */}
        {view === 'week' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center capitalize">
              {weekLabel}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => setWeekOffset(0)}>
                Hoy
              </Button>
            )}
          </div>
        )}

        {/* Filtros de lista */}
        {view === 'list' && (
          <div className="flex gap-3 items-center">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-40"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              placeholder="Desde"
            />
            <Input
              type="date"
              className="w-40"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              placeholder="Hasta"
            />
            {(statusFilter !== 'todos' || fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 gap-1"
                onClick={() => { setStatusFilter('todos'); setFromDate(''); setToDate(''); setPage(1); }}
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Vista Lista ── */}
      {view === 'list' && (
        <>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Inmueble</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : listApts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                      <p className="text-base font-medium">Sin citas encontradas</p>
                      <p className="text-sm mt-1">Prueba cambiando los filtros o agenda una nueva cita</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  listApts.map((apt) => (
                    <TableRow
                      key={apt.id}
                      className="hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => openDetail(apt)}
                    >
                      <TableCell>
                        <p className="font-medium text-slate-800 text-sm">
                          {formatDate(apt.scheduledAt)}
                        </p>
                        <p className="text-xs text-slate-400">{formatTime(apt.scheduledAt)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-700">{apt.client?.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{apt.client?.phone}</p>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="text-sm text-slate-700 truncate">{apt.property?.title ?? '—'}</p>
                        <p className="text-xs text-slate-400">{apt.property?.city}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {apt.agent?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('border-0 text-xs', appointmentStatusColor(apt.status))}>
                          {appointmentStatusLabel(apt.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {apt.isSpecialCase && (
                          <span title="Caso especial">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-600 hover:text-blue-700"
                          onClick={() => openDetail(apt)}
                        >
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-slate-500 self-center">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Vista Semana ── */}
      {view === 'week' && (
        weekLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white h-[300px] flex items-center justify-center">
            <Skeleton className="h-6 w-32" />
          </div>
        ) : (
          <WeekView weekStart={weekStart} appointments={weekApts.filter((a) => a.status !== 'CANCELADA')} onSelect={openDetail} />
        )
      )}

      {/* ── Modales ── */}
      <DetailModal
        appointment={selectedApt}
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedApt(null); }}
      />

      <CreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultAgentId={session?.user?.id}
      />
    </div>
  );
}
