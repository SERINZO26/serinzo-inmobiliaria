'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Shield, ShieldOff } from 'lucide-react';
import { staffApi, type User, type UserRole } from '@/lib/api';
import { initials, formatRelative } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function EquipoPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirmUser, setConfirmUser] = useState<User | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.getAll(),
    enabled: isAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => staffApi.toggleStatus(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      const u = res.data.data;
      toast({
        title: u.status === 'ACTIVE' ? 'Usuario activado' : 'Usuario desactivado',
        description: `${u.name} ahora está ${u.status === 'ACTIVE' ? 'activo' : 'inactivo'}.`,
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

  const users: User[] = data?.data?.data ?? [];

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
                <TableRow key={user.id} className="hover:bg-slate-50">
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
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/equipo/${user.id}/editar`)}
                        >
                          Editar datos
                        </DropdownMenuItem>
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

      {/* Dialog de confirmación */}
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
    </div>
  );
}
