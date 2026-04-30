'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, Upload, FileText, X, ExternalLink,
  Loader2, ChevronRight, MessageCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDropzone } from 'react-dropzone';
import { saleApi, type SaleStatus } from '@/lib/api';
import { formatPrice, formatDate, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_FLOW: SaleStatus[] = ['BORRADOR', 'EN_PROCESO', 'FIRMADO', 'REGISTRADO'];

function statusLabel(s: SaleStatus) {
  const map: Record<SaleStatus, string> = {
    BORRADOR: 'Borrador', EN_PROCESO: 'En proceso',
    FIRMADO: 'Firmado', REGISTRADO: 'Registrado', CANCELADO: 'Cancelado',
  };
  return map[s] ?? s;
}

function statusColor(s: SaleStatus) {
  const map: Record<SaleStatus, string> = {
    BORRADOR:   'bg-slate-100 text-slate-600',
    EN_PROCESO: 'bg-yellow-100 text-yellow-800',
    FIRMADO:    'bg-blue-100 text-blue-800',
    REGISTRADO: 'bg-green-100 text-green-800',
    CANCELADO:  'bg-gray-100 text-gray-500',
  };
  return map[s] ?? 'bg-gray-100 text-gray-600';
}

// ─── PDF Uploader ─────────────────────────────────────────────────────────────

function PdfUploader({ contractId, currentUrl, onSuccess }: {
  contractId: string; currentUrl: string | null; onSuccess: () => void;
}) {
  const [file,    setFile]    = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err,     setErr]     = useState('');

  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) setFile(accepted[0]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxFiles: 1, maxSize: 20 * 1024 * 1024,
  });

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setErr('');
    try {
      await saleApi.uploadPdf(contractId, file);
      setFile(null);
      onSuccess();
    } catch {
      setErr('No se pudo subir el documento. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {currentUrl && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
          <a href={currentUrl} target="_blank" rel="noreferrer"
            className="text-sm text-green-700 hover:underline flex items-center gap-1 flex-1 truncate">
            Ver documento <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {file ? (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-700 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div {...getRootProps()} className={cn(
          'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300',
        )}>
          <input {...getInputProps()} />
          <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1" />
          <p className="text-xs text-slate-500">{currentUrl ? 'Reemplazar' : 'Subir'} documento · PDF, JPG, PNG · máx. 20 MB</p>
        </div>
      )}
      {file && (
        <Button onClick={handleUpload} disabled={uploading} size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {currentUrl ? 'Reemplazar documento' : 'Subir documento'}
        </Button>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['venta', id],
    queryFn: async () => (await saleApi.getById(id)).data.data,
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: SaleStatus) => saleApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venta', id] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No se encontró el contrato.</p>
        <Link href="/admin/ventas"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const c = contract;
  const price      = Number(c.salePrice);
  const commAmt    = c.commissionAmount ? Number(c.commissionAmount) : 0;
  const commPct    = c.commissionPct ? Number(c.commissionPct) : 0;
  const currentIdx = STATUS_FLOW.indexOf(c.status as SaleStatus);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1]
    : null;

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await saleApi.update(id, { notes });
      qc.invalidateQueries({ queryKey: ['venta', id] });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/admin/ventas">
          <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{c.property?.title ?? 'Contrato de venta'}</h1>
          <p className="text-sm text-slate-500">{c.property?.address}, {c.property?.city}</p>
        </div>
        <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', statusColor(c.status as SaleStatus))}>
          {statusLabel(c.status as SaleStatus)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Resumen */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Información de la venta</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Inmueble</span>
              <Link href={`/admin/inmuebles/${c.propertyId}`} className="text-blue-600 hover:underline flex items-center gap-1 text-right max-w-[200px]">
                <span className="truncate">{c.property?.title}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Comprador</span>
              <div className="text-right">
                <p className="font-medium text-slate-800">{c.client?.name ?? '–'}</p>
                {c.client?.phone && (
                  <a href={`https://wa.me/${c.client.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="text-xs text-green-600 hover:underline flex items-center gap-1 justify-end">
                    <MessageCircle className="h-3 w-3" /> {c.client.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Agente</span>
              <span className="text-slate-700">{c.agent?.name ?? '–'}</span>
            </div>
            {c.promiseDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha promesa</span>
                <span className="text-slate-700">{formatDate(c.promiseDate)}</span>
              </div>
            )}
            {c.signDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha firma</span>
                <span className="text-slate-700">{formatDate(c.signDate)}</span>
              </div>
            )}
            {c.registrationDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha registro</span>
                <span className="text-slate-700">{formatDate(c.registrationDate)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calculadora */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Valores de la operación</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-mono">
              <div className="flex justify-between text-slate-700">
                <span>Precio de venta</span>
                <span className="font-semibold">{formatPrice(price, c.saleCurrency)}</span>
              </div>
              {commAmt > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Comisión ({commPct}%)</span>
                  <span>{formatPrice(commAmt, 'COP')}</span>
                </div>
              )}
              {commAmt > 0 && (
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-green-700 text-base">
                  <span>Neto al vendedor</span>
                  <span>{formatPrice(price - commAmt, 'COP')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estado — avanzar */}
        {c.status !== 'CANCELADO' && c.status !== 'REGISTRADO' && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Avanzar proceso</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Barra de progreso */}
              <div className="flex items-center gap-1">
                {STATUS_FLOW.map((s, i) => (
                  <div key={s} className="flex items-center flex-1">
                    <div className={cn(
                      'flex-1 h-2 rounded-full transition-colors',
                      i <= currentIdx ? 'bg-green-500' : 'bg-slate-200',
                    )} />
                    {i < STATUS_FLOW.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300 flex-shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-500 -mt-1">
                {STATUS_FLOW.map(s => <span key={s}>{statusLabel(s)}</span>)}
              </div>

              {nextStatus && (
                <Button
                  onClick={() => {
                    if (confirm(`¿Cambiar el estado a "${statusLabel(nextStatus)}"?`)) {
                      statusMutation.mutate(nextStatus);
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {statusMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <ChevronRight className="h-4 w-4 mr-2" />}
                  Marcar como {statusLabel(nextStatus)}
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 text-sm"
                onClick={() => {
                  if (confirm('¿Cancelar este contrato de venta?')) {
                    statusMutation.mutate('CANCELADO');
                  }
                }}
                disabled={statusMutation.isPending}
              >
                Cancelar venta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Documento */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contrato / escritura</CardTitle></CardHeader>
          <CardContent>
            <PdfUploader
              contractId={id}
              currentUrl={c.pdfUrl}
              onSuccess={() => qc.invalidateQueries({ queryKey: ['venta', id] })}
            />
          </CardContent>
        </Card>

        {/* Notas */}
        <Card className="border-0 shadow-sm md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Notas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea
              defaultValue={c.notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Condiciones, observaciones, pendientes…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Guardar notas
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
