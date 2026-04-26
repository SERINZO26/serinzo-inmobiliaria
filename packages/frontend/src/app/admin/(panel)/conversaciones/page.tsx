'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Mic, Globe, X, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { conversationsApi, type Conversation } from '@/lib/api';
import {
  interestColor, interestLabel, formatDateTime, formatRelative,
} from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function channelIcon(channel: string) {
  if (channel === 'WHATSAPP') return <MessageSquare className="h-4 w-4 text-green-600" />;
  if (channel === 'VOZ')      return <Mic           className="h-4 w-4 text-blue-600"  />;
  return                             <Globe         className="h-4 w-4 text-slate-500" />;
}

function channelLabel(channel: string) {
  const map: Record<string, string> = { WHATSAPP: 'WhatsApp', VOZ: 'Voz', WEB: 'Web' };
  return map[channel] ?? channel;
}

function outcomeColor(outcome: string | null): string {
  const map: Record<string, string> = {
    cita_agendada: 'bg-green-100 text-green-800',
    calificado:    'bg-blue-100 text-blue-800',
    seguimiento:   'bg-yellow-100 text-yellow-800',
    sin_interes:   'bg-gray-100 text-gray-600',
    no_responde:   'bg-slate-100 text-slate-600',
    caso_especial: 'bg-orange-100 text-orange-800',
  };
  return map[outcome ?? ''] ?? 'bg-gray-100 text-gray-500';
}

function outcomeLabel(outcome: string | null): string {
  const map: Record<string, string> = {
    cita_agendada: 'Cita agendada',
    calificado:    'Calificado',
    seguimiento:   'Seguimiento',
    sin_interes:   'Sin interés',
    no_responde:   'No responde',
    caso_especial: 'Caso especial',
  };
  return map[outcome ?? ''] ?? 'Sin resultado';
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

const OUTCOME_OPTIONS = [
  { value: 'todos', label: 'Todos los resultados' },
  { value: 'cita_agendada', label: 'Cita agendada' },
  { value: 'calificado',    label: 'Calificado' },
  { value: 'seguimiento',   label: 'Seguimiento' },
  { value: 'sin_interes',   label: 'Sin interés' },
  { value: 'no_responde',   label: 'No responde' },
  { value: 'caso_especial', label: 'Caso especial' },
];

const CHANNEL_OPTIONS = [
  { value: 'todos',     label: 'Todos los canales' },
  { value: 'WHATSAPP',  label: 'WhatsApp' },
  { value: 'VOZ',       label: 'Voz' },
  { value: 'WEB',       label: 'Web' },
];

// ─── Modal de transcript ──────────────────────────────────────────────────────

function TranscriptModal({
  conv,
  onClose,
}: {
  conv: Conversation | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['conversation', conv?.id],
    queryFn: async () => {
      if (!conv) return null;
      const res = await conversationsApi.getById(conv.id);
      return res.data.data;
    },
    enabled: !!conv,
  });

  return (
    <Dialog open={!!conv} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            {conv && channelIcon(conv.channel)}
            Conversación — {conv?.client?.name ?? 'Cliente desconocido'}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-sm">
            {conv && formatDateTime(conv.startedAt)}
            {conv?.durationSeconds ? ` · ${formatDuration(conv.durationSeconds)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Resumen */}
          {conv?.summary && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Resumen generado por IA
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{conv.summary}</p>
            </div>
          )}

          {/* Temas */}
          {conv?.topics && conv.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {conv.topics.map((t) => (
                <Badge key={t} variant="outline" className="text-xs text-slate-500 border-slate-300">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {/* Transcript */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conversación</p>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))
            ) : !detail?.turns?.length ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">
                No hay transcript disponible para esta conversación
              </p>
            ) : (
              detail.turns.map((turn) => (
                <div
                  key={turn.id}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm max-w-[85%]',
                    turn.role === 'assistant'
                      ? 'bg-green-50 border border-green-100 text-slate-700 self-start mr-auto'
                      : 'bg-slate-100 text-slate-700 ml-auto',
                  )}
                >
                  <p className="text-[10px] font-medium text-slate-400 mb-0.5">
                    {turn.role === 'assistant' ? 'Sofía' : 'Cliente'}
                  </p>
                  <p className="leading-snug whitespace-pre-wrap">{turn.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConversacionesPage() {
  const [search,   setSearch]   = useState('');
  const [outcome,  setOutcome]  = useState('todos');
  const [channel,  setChannel]  = useState('todos');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<Conversation | null>(null);

  const params: Record<string, string | number> = { page, limit: 20 };
  if (search.trim())     params.search  = search.trim();
  if (outcome !== 'todos') params.outcome = outcome;
  if (channel !== 'todos') params.channel = channel;

  const { data: response, isLoading } = useQuery({
    queryKey: ['conversations', params],
    queryFn: async () => (await conversationsApi.getAll(params)).data,
  });

  const conversations = response?.data ?? [];
  const total         = response?.meta?.total ?? 0;
  const totalPages    = response?.meta?.totalPages ?? 1;

  const hasFilters = search || outcome !== 'todos' || channel !== 'todos';

  function clearFilters() {
    setSearch('');
    setOutcome('todos');
    setChannel('todos');
    setPage(1);
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Conversaciones</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {total} conversación{total !== 1 ? 'es' : ''} registrada{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre del cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={outcome} onValueChange={(v) => { setOutcome(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OUTCOME_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 gap-1">
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Fecha</TableHead>
              <TableHead className="w-28">Canal</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-24">Duración</TableHead>
              <TableHead className="w-20">Interés</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">No hay conversaciones con estos filtros</p>
                  <p className="text-sm mt-1">Las conversaciones del agente Sofía aparecerán aquí</p>
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conv) => {
                const interest = conv.interestOverride ?? conv.interestDetected;
                return (
                  <TableRow key={conv.id} className="hover:bg-slate-50/50">
                    {/* Fecha */}
                    <TableCell>
                      <p className="text-sm text-slate-700 font-medium">
                        {formatRelative(conv.startedAt)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateTime(conv.startedAt)}
                      </p>
                    </TableCell>

                    {/* Canal */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        {channelIcon(conv.channel)}
                        <span>{channelLabel(conv.channel)}</span>
                      </div>
                    </TableCell>

                    {/* Cliente */}
                    <TableCell>
                      {conv.client ? (
                        <>
                          <p className="text-sm font-medium text-slate-800">{conv.client.name}</p>
                          <p className="text-xs text-slate-400">{conv.client.phone}</p>
                        </>
                      ) : (
                        <span className="text-sm text-slate-400 italic">Desconocido</span>
                      )}
                    </TableCell>

                    {/* Duración */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="h-3.5 w-3.5 opacity-60" />
                        {formatDuration(conv.durationSeconds)}
                      </div>
                    </TableCell>

                    {/* Nivel de interés */}
                    <TableCell>
                      {interest ? (
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold',
                            interestColor(interest),
                          )}>
                            {interest}
                          </div>
                          <span className="text-xs text-slate-500 hidden xl:inline">
                            {interestLabel(interest)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </TableCell>

                    {/* Outcome */}
                    <TableCell>
                      <Badge className={cn('border-0 text-xs', outcomeColor(conv.outcome))}>
                        {outcomeLabel(conv.outcome)}
                      </Badge>
                    </TableCell>

                    {/* Acción */}
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setSelected(conv)}
                      >
                        Ver transcript
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-slate-500 self-center">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* ── Modal de transcript ── */}
      <TranscriptModal conv={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
