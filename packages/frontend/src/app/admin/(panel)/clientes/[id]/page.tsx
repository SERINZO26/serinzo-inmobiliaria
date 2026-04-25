'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Mail, Star, MessageCircle, ArrowLeft, ChevronRight, Save,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { clientsApi, appointmentsApi, type ClientStatus } from '@/lib/api';
import {
  interestColor, interestLabel, clientStatusColor, clientStatusLabel,
  formatDate, formatRelative, formatPrice, formatDateTime,
  appointmentStatusColor, appointmentStatusLabel, initials,
} from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Mapa de avance de estado ─────────────────────────────────────────────────

const STATUS_FLOW: Record<ClientStatus, ClientStatus | null> = {
  NUEVO: 'CONTACTADO',
  CONTACTADO: 'CALIFICADO',
  CALIFICADO: 'VISITO',
  VISITO: 'OFERTO',
  OFERTO: 'CERRADO',
  CERRADO: null,
  PERDIDO: null,
};

// ─── Origen en español ────────────────────────────────────────────────────────

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    llamada: 'Llamada',
    web: 'Web',
    whatsapp: 'WhatsApp',
    referido: 'Referido',
    campaña: 'Campaña',
    visita_directa: 'Visita directa',
  };
  return map[source] ?? source;
}

// ─── Fila de info ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1.5">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-700 text-right">{value}</span>
    </div>
  );
}

// ─── Página de perfil ─────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [interestPending, setInterestPending] = useState<number | null>(null);
  const [interestNote, setInterestNote] = useState('');
  const [notes, setNotes] = useState('');
  const [notesEdited, setNotesEdited] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = (await clientsApi.getById(id)).data.data;
      setNotes(res.qualificationNotes ?? '');
      return res;
    },
    enabled: !!id,
  });

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments', { clientId: id }],
    queryFn: async () =>
      (await appointmentsApi.getAll({ clientId: id, limit: 20 })).data.data,
    enabled: !!id,
  });

  const interestMutation = useMutation({
    mutationFn: ({ level, note }: { level: number; note: string }) =>
      clientsApi.updateInterest(id, level, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      setInterestPending(null);
      setInterestNote('');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: ClientStatus) =>
      clientsApi.update(id, { status: newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', id] }),
  });

  const notesMutation = useMutation({
    mutationFn: () => clientsApi.update(id, { qualificationNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      setNotesEdited(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex gap-6">
        <div className="w-80 shrink-0">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-5 w-40 mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="flex-1">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg font-medium">Cliente no encontrado</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  const nextStatus = STATUS_FLOW[client.status];
  const interestLevel = client.interestLevel;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => router.push('/admin/clientes')} className="hover:text-slate-800 transition-colors">
          Clientes
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-800 font-medium">{client.name}</span>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Columna izquierda ── */}
        <div className="w-80 shrink-0 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  'h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold',
                  interestColor(interestLevel),
                )}>
                  {initials(client.name)}
                </div>
                <h2 className="text-xl font-bold text-slate-800 text-center">{client.name}</h2>
              </div>

              {/* Contacto */}
              <div className="space-y-2">
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors group"
                >
                  <Phone className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                  <span>{client.phone}</span>
                </a>
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors group"
                  >
                    <Mail className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
              </div>

              <Separator />

              {/* Nivel de interés */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Nivel de interés</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        if (lvl !== interestLevel) {
                          setInterestPending(lvl);
                          setInterestNote('');
                        }
                      }}
                      title={interestLabel(lvl)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          'h-5 w-5',
                          lvl <= interestLevel
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-none text-slate-300',
                        )}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">{interestLabel(interestLevel)}</p>

                {/* Formulario de cambio de interés */}
                {interestPending !== null && (
                  <div className="mt-3 space-y-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs font-medium text-amber-800">
                      Cambiar a nivel {interestPending} — {interestLabel(interestPending)}
                    </p>
                    <Textarea
                      placeholder="¿Por qué cambias el nivel de interés? (obligatorio)"
                      value={interestNote}
                      onChange={(e) => setInterestNote(e.target.value)}
                      className="text-xs min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        disabled={!interestNote.trim() || interestMutation.isPending}
                        onClick={() => interestMutation.mutate({ level: interestPending, note: interestNote })}
                      >
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => { setInterestPending(null); setInterestNote(''); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Estado CRM */}
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Estado CRM</p>
                <Badge className={cn('border-0 text-sm px-3 py-1', clientStatusColor(client.status))}>
                  {clientStatusLabel(client.status)}
                </Badge>
                {nextStatus && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs gap-1"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(nextStatus)}
                  >
                    Avanzar a {clientStatusLabel(nextStatus)}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <Separator />

              {/* Info adicional */}
              <div className="space-y-0.5">
                <InfoRow label="Origen" value={sourceLabel(client.source)} />
                <InfoRow label="Registrado" value={formatDate(client.createdAt)} />
                <InfoRow
                  label="Último contacto"
                  value={client.lastContactAt ? formatRelative(client.lastContactAt) : <span className="text-slate-300 italic">Sin contacto</span>}
                />
              </div>

              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() => {/* modal de edición — próximamente */}}
              >
                Editar datos
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Columna derecha ── */}
        <div className="flex-1 min-w-0">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Tabs defaultValue="preferencias">
                <TabsList className="w-full rounded-none border-b border-slate-100 bg-transparent h-auto p-0">
                  {['preferencias', 'citas', 'conversaciones', 'notas'].map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="capitalize rounded-none border-b-2 border-transparent data-[state=active]:border-slate-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-5 py-3 text-sm"
                    >
                      {tab === 'preferencias' ? 'Preferencias' :
                       tab === 'citas' ? 'Citas' :
                       tab === 'conversaciones' ? 'Conversaciones' : 'Notas'}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── Tab: Preferencias ── */}
                <TabsContent value="preferencias" className="p-6 focus-visible:outline-none">
                  {!client.budgetMin && !client.budgetMax && !client.preferredOperation &&
                   client.preferredType.length === 0 && client.preferredZones.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-base font-medium">No hay preferencias registradas aún</p>
                      <p className="text-sm mt-1">Se registran automáticamente cuando el cliente conversa con el agente IA</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-lg">
                      {(client.budgetMin || client.budgetMax) && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1 font-medium">Presupuesto</p>
                          <p className="text-sm text-slate-800">
                            {client.budgetMin ? formatPrice(client.budgetMin, client.budgetCurrency) : '—'}
                            {' — '}
                            {client.budgetMax ? formatPrice(client.budgetMax, client.budgetCurrency) : '—'}
                          </p>
                        </div>
                      )}

                      {client.preferredOperation && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1 font-medium">Operación</p>
                          <p className="text-sm text-slate-800">
                            {client.preferredOperation === 'VENTA' ? 'Compra' :
                             client.preferredOperation === 'ARRIENDO' ? 'Arriendo' : 'Compra o Arriendo'}
                          </p>
                        </div>
                      )}

                      {client.preferredType.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-2 font-medium">Tipos de inmueble</p>
                          <div className="flex flex-wrap gap-1.5">
                            {client.preferredType.map((t) => (
                              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {client.preferredZones.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-2 font-medium">Zonas de interés</p>
                          <div className="flex flex-wrap gap-1.5">
                            {client.preferredZones.map((z) => (
                              <Badge key={z} variant="secondary" className="text-xs">{z}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {client.minBedrooms && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1 font-medium">Habitaciones mínimas</p>
                          <p className="text-sm text-slate-800">{client.minBedrooms}</p>
                        </div>
                      )}

                      {client.qualificationNotes && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1 font-medium">Requisitos adicionales</p>
                          <p className="text-sm text-slate-700 whitespace-pre-line">{client.qualificationNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab: Citas ── */}
                <TabsContent value="citas" className="p-6 focus-visible:outline-none">
                  {appointmentsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : !appointments || appointments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-base font-medium">Sin citas agendadas</p>
                      <p className="text-sm mt-1">Las citas que se agenden con este cliente aparecerán aquí</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs text-slate-500">
                            <th className="px-4 py-2.5 text-left font-medium">Fecha y hora</th>
                            <th className="px-4 py-2.5 text-left font-medium">Inmueble</th>
                            <th className="px-4 py-2.5 text-left font-medium">Agente</th>
                            <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {appointments.map((apt) => (
                            <tr key={apt.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-slate-700">
                                {formatDateTime(apt.scheduledAt)}
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                                <p className="truncate">{apt.property?.title ?? '—'}</p>
                                <p className="text-xs text-slate-400">{apt.property?.city}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {apt.agent?.name ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={cn('border-0 text-xs', appointmentStatusColor(apt.status))}>
                                  {appointmentStatusLabel(apt.status)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab: Conversaciones ── */}
                <TabsContent value="conversaciones" className="p-6 focus-visible:outline-none">
                  <div className="text-center py-12 text-slate-400">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                    <p className="text-base font-medium">Sin conversaciones registradas</p>
                    <p className="text-sm mt-1">Las conversaciones con el agente IA aparecerán aquí</p>
                  </div>
                </TabsContent>

                {/* ── Tab: Notas ── */}
                <TabsContent value="notas" className="p-6 focus-visible:outline-none">
                  <div className="space-y-3 max-w-lg">
                    <p className="text-xs text-slate-500">
                      Notas internas del agente sobre este cliente. No son visibles para el cliente.
                    </p>
                    <Textarea
                      placeholder="Escribe aquí tus notas sobre el cliente..."
                      value={notes}
                      onChange={(e) => { setNotes(e.target.value); setNotesEdited(true); }}
                      className="min-h-[160px] text-sm"
                    />
                    <Button
                      onClick={() => notesMutation.mutate()}
                      disabled={!notesEdited || notesMutation.isPending}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {notesMutation.isPending ? 'Guardando...' : 'Guardar notas'}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
