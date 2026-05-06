'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { UserPlus, Shield, ShieldOff, Clock } from 'lucide-react';
import {
  staffApi,
  availabilityApi,
  type User,
  type UserRole,
  type Availability,
} from '@/lib/api';
import { initials, formatRelative } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROL_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  AGENT: 'Agente',
  ASSISTANT: 'Asistente',
};

const ROL_COLOR: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  AGENT: 'bg-blue-100 text-blue-800',
  ASSISTANT: 'bg-gray-100 text-gray-700',
};

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

// ─── Tipos locales ─────────────────────────────────────────────────────────────

type DaySlot = { enabled: boolean; startTime: string; endTime: string };
type AvailMap = Record<number, DaySlot>;

const defaultAvailMap = (): AvailMap =>
  Object.fromEntries(
    DAYS.map((d) => [d.value, { enabled: false, startTime: '08:00', endTime: '18:00' }]),
  ) as AvailMap;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EquipoPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = session?.user?.role === 'ADMIN';

  // ── Estado modales ────────────────────────────────────────────────────────
  const [confirmUser, setConfirmUser] = useState<User | null>(null);

  // Modal edición
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('AGENT');

  // Modal disponibilidad
  const [availUser, setAvailUser] = useState<User | null>(null);
  const [availMap, setAvailMap] = useState<AvailMap>(defaultAvailMap());
  const [availError, setAvailError] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  // Lista de usuarios — incluye inactivos para que el admin pueda gestionar todos
  const { data, isLoading } = useQuery({
    queryKey: ['staff', 'all'],
    queryFn: () => staffApi.getAll({ includeInactive: true }),
    enabled: isAdmin,
  });

  // Disponibilidad del usuario seleccionado para el modal
  const { data: availData, isLoading: availLoading } = useQuery({
    queryKey: ['availability', availUser?.id],
    queryFn: () => availabilityApi.getByUser(availUser!.id),
    enabled: !!availUser,
  });

  // ── Effects ───────────────────────────────────────────────────────────────

  // Reiniciar el mapa cuando se cambia de usuario en el modal de disponibilidad
  useEffect(() => {
    if (!availUser) return;
    setAvailMap(defaultAvailMap());
  }, [availUser]);

  // Cargar los registros existentes en el mapa local cuando llegan del servidor
  useEffect(() => {
    if (!availData) return;
    const records: Availability[] = (availData.data as { data?: Availability[] })?.data ?? [];
    const next = defaultAvailMap();
    for (const r of records) {
      if (!r.isBlocked) {
        next[r.dayOfWeek] = { enabled: true, startTime: r.startTime, endTime: r.endTime };
      }
    }
    setAvailMap(next);
  }, [availData]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: (id: string) => staffApi.toggleStatus(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      const u = (res.data as { data?: User })?.data;
      toast({
        title: u?.status === 'ACTIVE' ? 'Usuario activado' : 'Usuario desactivado',
        description: `${u?.name} ahora está ${u?.status === 'ACTIVE' ? 'activo' : 'inactivo'}.`,
      });
      setConfirmUser(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast({
        title: 'Error',
        description: err.response?.data?.error ?? 'No se pudo cambiar el estado.',
        variant: 'destructive',
      });
      setConfirmUser(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({
      id,
      name,
      phone,
      role,
    }: {
      id: string;
      name: string;
      phone: string | null;
      role: UserRole;
    }) => staffApi.update(id, { name, phone, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Usuario actualizado correctamente' });
      setEditUser(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast({
        title: 'Error al guardar',
        description: err.response?.data?.error ?? 'No se pudo actualizar el usuario.',
        variant: 'destructive',
      });
    },
  });

  const saveAvailMutation = useMutation({
    mutationFn: async ({ userId, map }: { userId: string; map: AvailMap }) => {
      // 1. Obtener registros actuales
      const res = await availabilityApi.getByUser(userId);
      const existing: Availability[] = (res.data as { data?: Availability[] })?.data ?? [];
      // 2. Eliminar todos los registros actuales
      await Promise.all(existing.map((r) => availabilityApi.remove(r.id)));
      // 3. Crear los nuevos registros para los días habilitados.
      // No se envían validFrom/validUntil/blockReason para evitar que Zod los rechace
      // al recibir null en lugar de undefined (el backend ahora acepta ambos).
      const creates = DAYS.filter((d) => map[d.value]?.enabled).map((d) =>
        availabilityApi.create({
          userId,
          dayOfWeek: d.value,
          startTime: map[d.value].startTime,
          endTime: map[d.value].endTime,
          isBlocked: false,
          validFrom: null,
          validUntil: null,
          blockReason: null,
        }),
      );
      await Promise.all(creates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast({ title: 'Disponibilidad guardada correctamente' });
      setAvailError('');
      setAvailUser(null);
    },
    onError: (err: unknown) => {
      // Extraer el mensaje real del backend para mostrarlo en el modal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiErr = err as any;
      const mensaje: string =
        apiErr?.response?.data?.error ??
        apiErr?.response?.data?.message ??
        (typeof apiErr?.response?.data === 'string' ? apiErr.response.data : null) ??
        'Error desconocido al guardar la disponibilidad';
      console.error('Error guardando disponibilidad:', mensaje, apiErr?.response?.data);
      setAvailError(mensaje);
      toast({ title: 'Error', description: mensaje, variant: 'destructive' });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditName(user.name);
    setEditPhone(user.phone ?? '');
    setEditRole(user.role as UserRole);
  };

  const handleEditSave = () => {
    if (!editUser) return;
    editMutation.mutate({
      id: editUser.id,
      name: editName.trim(),
      phone: editPhone.trim() || null,
      role: editRole,
    });
  };

  const toggleDay = (day: number, enabled: boolean) => {
    setAvailMap((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled },
    }));
  };

  const updateTime = (day: number, field: 'startTime' | 'endTime', value: string) => {
    setAvailMap((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  // ── Render guard ──────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Shield className="h-16 w-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso restringido</h2>
        <p className="text-slate-500 text-center max-w-sm">
          Solo los administradores pueden ver y gestionar el equipo.
        </p>
      </div>
    );
  }

  const users: User[] = (data?.data as { data?: User[] })?.data ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipo</h1>
          <p className="text-slate-500 mt-1">
            {isLoading ? '...' : `${users.length} usuario${users.length !== 1 ? 's' : ''} registrados`}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/equipo/nuevo">
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar usuario
          </Link>
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className={`hover:bg-slate-50 ${user.status === 'INACTIVE' ? 'opacity-60' : ''}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-slate-200 text-slate-700 text-sm font-semibold">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        {user.phone && (
                          <p className="text-xs text-slate-400">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROL_COLOR[user.role as UserRole]}>
                      {ROL_LABEL[user.role as UserRole]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          user.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-400'
                        }`}
                      />
                      {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Nunca'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          ···
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(user)}>
                          Editar datos
                        </DropdownMenuItem>
                        {user.role === 'AGENT' && (
                          <DropdownMenuItem onClick={() => setAvailUser(user)}>
                            <Clock className="h-4 w-4 mr-2" />
                            Disponibilidad
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setConfirmUser(user)}
                          className={
                            user.status === 'ACTIVE' ? 'text-red-600' : 'text-green-600'
                          }
                          disabled={user.id === session?.user?.id}
                        >
                          {user.status === 'ACTIVE' ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-2" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-2" />
                              Activar
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Modal: Confirmar activar/desactivar ────────────────────────────── */}
      <AlertDialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmUser?.status === 'ACTIVE' ? 'Desactivar usuario' : 'Activar usuario'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser?.status === 'ACTIVE'
                ? `¿Desactivar a ${confirmUser?.name}? No podrá iniciar sesión hasta que lo vuelvas a activar.`
                : `¿Activar a ${confirmUser?.name}? Podrá volver a iniciar sesión en el sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmUser && toggleMutation.mutate(confirmUser.id)}
              className={
                confirmUser?.status === 'ACTIVE'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }
            >
              {toggleMutation.isPending
                ? 'Guardando...'
                : confirmUser?.status === 'ACTIVE'
                  ? 'Sí, desactivar'
                  : 'Sí, activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal: Editar usuario ──────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Juan Pérez"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Teléfono</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="300 123 4567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Rol</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="AGENT">Agente</SelectItem>
                  <SelectItem value="ASSISTANT">Asistente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editMutation.isPending || !editName.trim()}
            >
              {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Disponibilidad del agente ──────────────────────────────── */}
      <Dialog
        open={!!availUser}
        onOpenChange={(open) => {
          if (!open) {
            setAvailUser(null);
            setAvailError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Disponibilidad — {availUser?.name}
            </DialogTitle>
          </DialogHeader>

          {availLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-500 mb-4">
                Activa los días en que el agente está disponible para visitas y define el horario de cada día.
              </p>
              {DAYS.map((day) => {
                const slot = availMap[day.value];
                return (
                  <div key={day.value} className="flex items-center gap-3">
                    {/* Toggle día */}
                    <div className="flex items-center gap-2 w-28 shrink-0">
                      <Switch
                        checked={slot?.enabled ?? false}
                        onCheckedChange={(v) => toggleDay(day.value, v)}
                        id={`day-${day.value}`}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className={`text-sm font-medium cursor-pointer ${
                          slot?.enabled ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {day.label}
                      </Label>
                    </div>

                    {/* Horario */}
                    <div
                      className={`flex items-center gap-2 flex-1 transition-opacity ${
                        slot?.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'
                      }`}
                    >
                      <Input
                        type="time"
                        value={slot?.startTime ?? '08:00'}
                        onChange={(e) => updateTime(day.value, 'startTime', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <span className="text-slate-400 text-sm shrink-0">a</span>
                      <Input
                        type="time"
                        value={slot?.endTime ?? '18:00'}
                        onChange={(e) => updateTime(day.value, 'endTime', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {availError && (
            <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {availError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAvailUser(null);
                setAvailError('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                availUser && saveAvailMutation.mutate({ userId: availUser.id, map: availMap })
              }
              disabled={saveAvailMutation.isPending}
            >
              {saveAvailMutation.isPending ? 'Guardando...' : 'Guardar disponibilidad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
