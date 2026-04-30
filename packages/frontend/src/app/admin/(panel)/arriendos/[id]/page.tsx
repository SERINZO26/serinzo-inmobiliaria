'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, FileText,
  MessageCircle, ExternalLink, Upload, X, Loader2, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDropzone } from 'react-dropzone';
import {
  rentalApi, paymentsApi, settingsApi,
  type RentalPayment, type PaymentStatus, type Settings,
} from '@/lib/api';
import { formatPrice, formatShortDate, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paymentStatusColor(status: PaymentStatus | string) {
  const map: Record<string, string> = {
    PAGADO:   'bg-green-100 text-green-800',
    PENDIENTE:'bg-yellow-100 text-yellow-800',
    VENCIDO:  'bg-red-100 text-red-800',
    PARCIAL:  'bg-orange-100 text-orange-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function paymentStatusLabel(status: PaymentStatus | string) {
  const map: Record<string, string> = {
    PAGADO: 'Pagado', PENDIENTE: 'Pendiente', VENCIDO: 'Atrasado', PARCIAL: 'Parcial',
  };
  return map[status] ?? status;
}

function monthsLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.ceil(days / 7);
  const months = Math.round(days / 30);
  return { days, weeks, months };
}

// ─── Modal Registrar Pago ─────────────────────────────────────────────────────

function ModalPago({
  contractId, payment, commissionPct, adminFee,
  onClose, onSuccess,
}: {
  contractId: string;
  payment: RentalPayment;
  commissionPct: number | null;
  adminFee: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file,              setFile]             = useState<File | null>(null);
  const [notes,             setNotes]            = useState('');
  const [hasRepair,         setHasRepair]        = useState(false);
  const [repairAmountStr,   setRepairAmountStr]  = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [busy,              setBusy]             = useState(false);
  const [err,               setErr]              = useState('');

  const amount       = Number(payment.amount);
  const commission   = commissionPct ? (amount * commissionPct) / 100 : 0;
  const adminFeeAmt  = adminFee ?? 0;
  const repairAmt    = hasRepair ? (Number(repairAmountStr) || 0) : 0;
  const subtotal     = amount - commission - adminFeeAmt;
  const propietario  = subtotal - repairAmt;

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'application/pdf': [] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  async function handleSubmit() {
    setBusy(true);
    setErr('');
    try {
      const form = new FormData();
      if (file)  form.append('comprobante', file);
      if (notes) form.append('notes', notes);
      if (hasRepair && repairAmt > 0) {
        form.append('repairAmount', String(repairAmt));
        if (repairDescription) form.append('repairDescription', repairDescription);
      }
      await paymentsApi.markPaid(contractId, payment.id, form);
      onSuccess();
      onClose();
    } catch {
      setErr('No se pudo registrar el pago. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-slate-800">Registrar pago — Período {payment.periodNumber}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── Resumen del período ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Resumen del período</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-mono">
              <div className="flex justify-between text-slate-700">
                <span>Canon</span>
                <span>{formatPrice(amount, 'COP')}</span>
              </div>
              {commission > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Comisión ({commissionPct}%)</span>
                  <span>- {formatPrice(commission, 'COP')}</span>
                </div>
              )}
              {adminFeeAmt > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Administración</span>
                  <span>- {formatPrice(adminFeeAmt, 'COP')}</span>
                </div>
              )}
              {repairAmt > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Arreglos{repairDescription ? ` (${repairDescription})` : ''}</span>
                  <span>- {formatPrice(repairAmt, 'COP')}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-green-700 text-base">
                <span>PAGO AL PROPIETARIO</span>
                <span>{formatPrice(propietario, 'COP')}</span>
              </div>
            </div>
          </div>

          {/* ── Toggle de arreglos ── */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <button
              type="button"
              onClick={() => { setHasRepair(!hasRepair); if (hasRepair) { setRepairAmountStr(''); setRepairDescription(''); } }}
              className="flex items-center justify-between w-full"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 text-left">¿Hubo arreglos este mes?</p>
                <p className="text-xs text-slate-400 text-left">Plomería, electricidad, pintura, etc.</p>
              </div>
              <div className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                hasRepair ? 'bg-orange-500' : 'bg-slate-200',
              )}>
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  hasRepair ? 'translate-x-6' : 'translate-x-1',
                )} />
              </div>
            </button>

            {hasRepair && (
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Valor del arreglo (COP)</label>
                  <input
                    type="number"
                    min="0"
                    value={repairAmountStr}
                    onChange={(e) => setRepairAmountStr(e.target.value)}
                    placeholder="Ej: 50000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Descripción del arreglo</label>
                  <textarea
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    rows={2}
                    placeholder="Ej: Plomería baño principal"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Comprobante ── */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Comprobante de pago <span className="text-slate-400 font-normal">(opcional)</span>
            </p>
            {file ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300',
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1" />
                <p className="text-xs text-slate-500">Arrastra el comprobante o haz clic · PDF, JPG, PNG · máx 5 MB</p>
              </div>
            )}
          </div>

          {/* ── Notas ── */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Notas adicionales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: transferencia bancaria, efectivo, etc."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6 sticky bottom-0 bg-white pt-3 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={busy}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={busy} className="flex-1 bg-green-600 hover:bg-green-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Confirmar pago
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers PDF ─────────────────────────────────────────────────────────────

/** Convierte una URL de imagen a base64 para usarla con jsPDF (evita restricciones CORS) */
async function imageUrlToBase64(url: string): Promise<{ data: string; format: string }> {
  const response = await fetch(url);
  const blob     = await response.blob();
  const data     = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
  // Detectar formato desde el MIME type del blob
  const format = blob.type.includes('png') ? 'PNG'
    : blob.type.includes('webp') ? 'WEBP'
    : blob.type.includes('svg')  ? 'SVG'
    : 'JPEG';
  return { data, format };
}

// ─── PDF Resumen Propietario ──────────────────────────────────────────────────

async function generatePdfResumen(
  contract: NonNullable<ReturnType<typeof useQuery>['data']>,
  payment: RentalPayment,
) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  // Obtener configuración de la inmobiliaria
  let settings: Settings | null = null;
  try {
    const res = await settingsApi.get();
    settings = res.data.data;
  } catch {
    // Si falla, continúa sin datos de empresa
  }

  const c = contract as ReturnType<typeof useQuery>['data'] & {
    property?: { title: string; address: string; city: string };
    client?: { name: string; phone: string | null; email: string | null };
    monthlyRent: number; commissionPct: number | null; adminFee: number | null;
    rentCurrency: string;
  };

  const amount      = Number(payment.amount);
  const commission  = c.commissionPct ? (amount * Number(c.commissionPct)) / 100 : 0;
  const adminFeeAmt = c.adminFee ? Number(c.adminFee) : 0;
  const repairAmt   = payment.repairAmount ? Number(payment.repairAmount) : 0;
  const propietario = amount - commission - adminFeeAmt - repairAmt;

  const companyName    = settings?.companyName    ?? 'Mi Inmobiliaria';
  const companyPhone   = settings?.companyPhone   ?? null;
  const companyEmail   = settings?.companyEmail   ?? null;
  const companyAddress = settings?.companyAddress ?? null;
  const companyCity    = settings?.companyCity    ?? null;
  const logoUrl        = settings?.companyLogoUrl ?? null;

  let headerY = 20;

  // ── Logo + nombre empresa ──────────────────────────────────────────────────
  if (logoUrl) {
    try {
      const { data: base64, format } = await imageUrlToBase64(logoUrl);
      doc.addImage(base64, format, 14, headerY, 30, 30);
      // Nombre de la empresa a la derecha del logo
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(companyName, 50, headerY + 10);
    } catch {
      // Si falla la carga del logo, mostrar solo el nombre en texto
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text(companyName, 14, headerY + 10);
    }
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(companyName, 14, headerY + 10);
  }

  // Datos de contacto de la empresa (siempre alineados con el texto del nombre)
  const textX = logoUrl ? 50 : 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  let contactY = headerY + 18;
  const contactParts: string[] = [];
  if (companyPhone) contactParts.push(`Tel: ${companyPhone}`);
  if (companyEmail) contactParts.push(companyEmail);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), textX, contactY);
    contactY += 5;
  }
  if (companyAddress || companyCity) {
    const addr = [companyAddress, companyCity].filter(Boolean).join(', ');
    doc.text(addr, textX, contactY);
    contactY += 5;
  }

  // El headerY final es el máximo entre la altura del logo (30px desde headerY) y el texto de contacto
  headerY = Math.max(headerY + 36, contactY + 4);

  // ── Línea + título del documento ──────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, headerY, 190, headerY);
  headerY += 8;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('LIQUIDACIÓN DE ARRIENDO', 20, headerY);

  // Período en texto (mes/año de dueDate)
  const periodoDate = new Date(payment.dueDate);
  const periodoStr  = periodoDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Período: ${periodoStr.charAt(0).toUpperCase() + periodoStr.slice(1)}`, 20, headerY + 8);
  doc.text(`Vencimiento: ${formatDate(payment.dueDate)}`, 130, headerY + 8);

  headerY += 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, headerY, 190, headerY);
  headerY += 8;

  // ── Datos del inmueble y arrendatario ─────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('INMUEBLE', 20, headerY);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(c.property?.title ?? '–', 20, headerY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${c.property?.address ?? ''}, ${c.property?.city ?? ''}`, 20, headerY + 12);

  doc.setFontSize(8);
  doc.text('ARRENDATARIO', 120, headerY);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(c.client?.name ?? '–', 120, headerY + 6);
  doc.setFont('helvetica', 'normal');

  headerY += 22;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, headerY, 190, headerY);
  headerY += 8;

  // ── Tabla de valores ──────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, headerY - 6, 170, 10, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CONCEPTO', 25, headerY);
  doc.text('VALOR', 175, headerY, { align: 'right' });

  const rows: [string, string][] = [
    ['Canon mensual', formatPrice(amount, c.rentCurrency ?? 'COP')],
    ...(commission > 0 ? [[`Comisión inmobiliaria (${c.commissionPct}%)`, `- ${formatPrice(commission, 'COP')}`] as [string, string]] : []),
    ...(adminFeeAmt > 0 ? [['Administración', `- ${formatPrice(adminFeeAmt, 'COP')}`] as [string, string]] : []),
    ...(repairAmt > 0 ? [[
      `Arreglos${payment.repairDescription ? ` (${payment.repairDescription})` : ''}`,
      `- ${formatPrice(repairAmt, 'COP')}`,
    ] as [string, string]] : []),
  ];

  let y = headerY + 10;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    doc.text(label, 25, y);
    doc.text(value, 175, y, { align: 'right' });
    y += 10;
  }

  // Total
  doc.setDrawColor(100, 116, 139);
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR A TRANSFERIR', 25, y);
  doc.text(formatPrice(propietario, 'COP'), 175, y, { align: 'right' });

  // ── Pie de página ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Generado el ${hoy}`, 20, 275);
  doc.text('Sistema Inmobiliario con IA', 175, 275, { align: 'right' });

  doc.save(`liquidacion-periodo-${payment.periodNumber}.pdf`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArriendoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();
  const [modalPago, setModalPago] = useState<RentalPayment | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const { data: contractData, isLoading } = useQuery({
    queryKey: ['arriendo', id],
    queryFn: async () => (await rentalApi.getById(id)).data.data,
    enabled: !!id,
  });

  const { data: pagosData, isLoading: loadingPagos } = useQuery({
    queryKey: ['arriendo-pagos', id],
    queryFn: async () => (await paymentsApi.getAll(id)).data.data,
    enabled: !!id,
  });

  const { data: resumenData } = useQuery({
    queryKey: ['arriendo-resumen', id],
    queryFn: async () => (await paymentsApi.getSummary(id)).data.data,
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => rentalApi.cancel(id, 'Cancelado desde el panel'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arriendo', id] });
      qc.invalidateQueries({ queryKey: ['arriendos'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  if (!contractData) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No se encontró el contrato.</p>
        <Link href="/admin/arriendos"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const c = contractData;
  const pagos = pagosData ?? [];
  const resumen = resumenData;
  const { weeks, months } = monthsLeft(c.endDate);
  const isExpiringSoon = c.status === 'ACTIVO' && weeks <= 15 && weeks >= 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/arriendos">
          <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{c.property?.title ?? 'Contrato de arriendo'}</h1>
          <p className="text-sm text-slate-500">{c.property?.address}, {c.property?.city}</p>
        </div>
        <span className={cn(
          'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
          c.status === 'ACTIVO' ? 'bg-green-100 text-green-800 border-green-200' :
          c.status === 'CANCELADO' ? 'bg-gray-100 text-gray-600 border-gray-200' :
          c.status === 'VENCIDO' ? 'bg-red-100 text-red-800 border-red-200' :
          'bg-blue-100 text-blue-800 border-blue-200'
        )}>
          {c.status}
        </span>
      </div>

      {/* Alerta vencimiento */}
      {isExpiringSoon && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <strong>Atención:</strong> este contrato vence en {weeks} semana{weeks !== 1 ? 's' : ''}
            ({formatShortDate(c.endDate)}). Contactar al propietario y arrendatario.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMNA IZQUIERDA */}
        <div className="space-y-5">

          {/* Info del contrato */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Información del contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Inmueble</span>
                <Link href={`/admin/inmuebles/${c.propertyId}`} className="text-blue-600 hover:underline flex items-center gap-1">
                  {c.property?.title} <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Arrendatario</span>
                <div className="text-right">
                  <p className="text-slate-800 font-medium">{c.client?.name}</p>
                  {c.client?.phone && (
                    <a href={`https://wa.me/${c.client.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="text-xs text-green-600 hover:underline flex items-center gap-1 justify-end">
                      <MessageCircle className="h-3 w-3" /> {c.client.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Inicio</span>
                <span className="text-slate-700">{formatDate(c.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fin</span>
                <span className={cn('font-medium', isExpiringSoon ? 'text-red-600' : 'text-slate-700')}>
                  {formatDate(c.endDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tiempo restante</span>
                <span className={cn('font-medium', isExpiringSoon ? 'text-red-600' : 'text-slate-700')}>
                  {months >= 0 ? `${months} mes${months !== 1 ? 'es' : ''} (${weeks} sem.)` : 'Vencido'}
                  {isExpiringSoon && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-red-500" />}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agente</span>
                <span className="text-slate-700">{c.agent?.name}</span>
              </div>
            </CardContent>
          </Card>

          {/* Calculadora financiera */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Valores financieros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-mono">
                <div className="flex justify-between text-slate-700">
                  <span>Canon mensual</span>
                  <span className="font-semibold">{formatPrice(Number(c.monthlyRent), c.rentCurrency)}</span>
                </div>
                {c.commissionPct && (
                  <div className="flex justify-between text-slate-500">
                    <span>Comisión ({c.commissionPct}%)</span>
                    <span>- {formatPrice((Number(c.monthlyRent) * Number(c.commissionPct)) / 100, 'COP')}</span>
                  </div>
                )}
                {c.adminFee && (
                  <div className="flex justify-between text-slate-500">
                    <span>Administración</span>
                    <span>- {formatPrice(Number(c.adminFee), 'COP')}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-green-700 text-base">
                  <span>Pago al propietario</span>
                  <span>
                    {formatPrice(
                      Number(c.monthlyRent)
                        - (c.commissionPct ? (Number(c.monthlyRent) * Number(c.commissionPct)) / 100 : 0)
                        - (c.adminFee ? Number(c.adminFee) : 0),
                      'COP'
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fianza */}
          {c.depositAmount && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fianza (depósito)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor</span>
                  <span className="font-medium">{formatPrice(Number(c.depositAmount), c.depositCurrency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Estado</span>
                  <span className={cn('font-medium', c.depositReturned ? 'text-slate-500' : 'text-blue-700')}>
                    {c.depositReturned ? 'Devuelta' : 'En custodia'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen de pagos */}
          {resumen && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumen de pagos</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-green-700">{resumen.pagados}</p>
                    <p className="text-xs text-green-600">Pagados</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-yellow-700">{resumen.pendientes}</p>
                    <p className="text-xs text-yellow-600">Pendientes</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-red-700">{resumen.vencidos}</p>
                    <p className="text-xs text-red-600">Atrasados</p>
                  </div>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Total propietario</span>
                  <span className="font-semibold text-green-700">{formatPrice(resumen.totalPropietario, 'COP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Comisión recaudada</span>
                  <span className="font-semibold text-slate-700">{formatPrice(resumen.totalComision, 'COP')}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          {c.status === 'ACTIVO' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm('¿Cancelar este contrato? El inmueble volverá a estado Disponible.')) {
                    cancelMutation.mutate();
                  }
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cancelar contrato
              </Button>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA — Pagos */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pagos mensuales</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPagos ? (
                <div className="p-4 space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {pagos.map((pago) => {
                    const efectivo = pago.estadoEfectivo ?? pago.status;
                    return (
                      <div key={pago.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                          {pago.periodNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-700">{formatPrice(Number(pago.amount), 'COP')}</p>
                            <span className={cn('inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full', paymentStatusColor(efectivo))}>
                              {paymentStatusLabel(efectivo)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">Vence {formatShortDate(pago.dueDate)}</p>
                          {pago.paidAt && (
                            <p className="text-xs text-green-600">Pagado {formatShortDate(pago.paidAt)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {efectivo === 'PAGADO' && pago.receiptUrl && (
                            <a href={pago.receiptUrl} target="_blank" rel="noreferrer" title="Ver comprobante">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          {efectivo === 'PAGADO' && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400"
                              title="Generar PDF propietario"
                              onClick={() => generatePdfResumen(c, pago)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(efectivo === 'PENDIENTE' || efectivo === 'VENCIDO') && c.status === 'ACTIVO' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setModalPago(pago)}
                            >
                              Registrar pago
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de pago */}
      {modalPago && (
        <ModalPago
          contractId={id}
          payment={modalPago}
          commissionPct={c.commissionPct ? Number(c.commissionPct) : null}
          adminFee={c.adminFee ? Number(c.adminFee) : null}
          onClose={() => setModalPago(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['arriendo-pagos', id] });
            qc.invalidateQueries({ queryKey: ['arriendo-resumen', id] });
          }}
        />
      )}
    </div>
  );
}
