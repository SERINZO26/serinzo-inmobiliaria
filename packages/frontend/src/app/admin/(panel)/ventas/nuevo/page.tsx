'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, Upload, FileText, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { saleApi, propertiesApi, clientsApi, staffApi } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

export default function NuevaVentaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [form, setForm] = useState({
    propertyId:   '',
    clientId:     '',
    agentId:      session?.user?.id ?? '',
    salePrice:    '',
    commissionPct:'3',
    promiseDate:  '',
    notes:        '',
  });
  const [propSearch,   setPropSearch]   = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [pdfFile,      setPdfFile]      = useState<File | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  const { data: propsData } = useQuery({
    queryKey: ['props-venta'],
    queryFn: async () => (await propertiesApi.getAll({ limit: 100 })).data.data,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => (await clientsApi.getAll({ limit: 200 })).data.data,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-agents'],
    queryFn: async () => (await staffApi.getAll({ role: 'AGENT' })).data.data,
    enabled: isAdmin,
  });

  const price      = Number(form.salePrice) || 0;
  const commPct    = Number(form.commissionPct) || 0;
  const commission = price > 0 && commPct > 0 ? (price * commPct) / 100 : 0;

  const availableProps = (propsData ?? []).filter(p =>
    p.status === 'DISPONIBLE' || p.status === 'RESERVADO'
  ).filter(p =>
    p.title.toLowerCase().includes(propSearch.toLowerCase()) ||
    p.address.toLowerCase().includes(propSearch.toLowerCase())
  );

  const filteredClients = (clientsData ?? []).filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone ?? '').includes(clientSearch)
  );

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setPdfFile(accepted[0]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxFiles: 1, maxSize: 20 * 1024 * 1024,
  });

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.propertyId) return setError('Selecciona un inmueble');
    if (!form.clientId)   return setError('Selecciona el comprador');
    if (!form.salePrice || price <= 0) return setError('Ingresa un precio de venta válido');

    setSubmitting(true);
    try {
      const res = await saleApi.create({
        propertyId:    form.propertyId,
        clientId:      form.clientId,
        agentId:       form.agentId || session?.user?.id,
        salePrice:     price,
        commissionPct: commPct || undefined,
        promiseDate:   form.promiseDate || undefined,
        status:        'EN_PROCESO',
        notes:         form.notes || undefined,
      });
      const newId = res.data.data.id;
      // Subir PDF si se adjuntó
      if (pdfFile) {
        await saleApi.uploadPdf(newId, pdfFile);
      }
      router.push(`/admin/ventas/${newId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo registrar la venta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/ventas">
          <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Registrar venta</h1>
          <p className="text-sm text-slate-500 mt-0.5">Documenta la compraventa de un inmueble.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Inmueble */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Inmueble y partes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Inmueble *</label>
              <input type="text" placeholder="Buscar por nombre o dirección…"
                value={propSearch} onChange={(e) => setPropSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {availableProps.length === 0
                  ? <p className="px-3 py-2 text-xs text-slate-400">No hay inmuebles disponibles o reservados</p>
                  : availableProps.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { set('propertyId', p.id); setPropSearch(p.title); }}
                      className={cn('w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors',
                        form.propertyId === p.id && 'bg-green-50 text-green-700 font-medium')}>
                      {p.title} <span className="text-slate-400">· {p.city}</span>
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Comprador *</label>
              <input type="text" placeholder="Buscar por nombre o teléfono…"
                value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {filteredClients.length === 0
                  ? <p className="px-3 py-2 text-xs text-slate-400">No se encontraron clientes</p>
                  : filteredClients.map(cl => (
                    <button key={cl.id} type="button"
                      onClick={() => { set('clientId', cl.id); setClientSearch(cl.name); }}
                      className={cn('w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors',
                        form.clientId === cl.id && 'bg-green-50 text-green-700 font-medium')}>
                      {cl.name} <span className="text-slate-400">· {cl.phone}</span>
                    </button>
                  ))}
              </div>
            </div>

            {isAdmin && staffData && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Agente responsable</label>
                <select value={form.agentId} onChange={(e) => set('agentId', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Seleccionar agente…</option>
                  {staffData.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Precio y comisión */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Valores de la venta</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Precio de venta (COP) *</label>
                <input type="number" min="0" value={form.salePrice}
                  onChange={(e) => set('salePrice', e.target.value)}
                  placeholder="Ej: 350000000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">% Comisión</label>
                <input type="number" min="0" max="100" step="0.5" value={form.commissionPct}
                  onChange={(e) => set('commissionPct', e.target.value)}
                  placeholder="3"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>

            {price > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-mono">
                <div className="flex justify-between text-slate-700">
                  <span>Precio de venta</span>
                  <span>{formatPrice(price, 'COP')}</span>
                </div>
                {commission > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Comisión ({commPct}%)</span>
                    <span>{formatPrice(commission, 'COP')}</span>
                  </div>
                )}
                {commission > 0 && (
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-green-700">
                    <span>Neto al vendedor</span>
                    <span>{formatPrice(price - commission, 'COP')}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Fecha promesa de compraventa</label>
              <input type="date" value={form.promiseDate} onChange={(e) => set('promiseDate', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </CardContent>
        </Card>

        {/* PDF */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contrato de compraventa <span className="text-slate-400 font-normal text-sm">(opcional)</span></CardTitle></CardHeader>
          <CardContent>
            {pdfFile ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 flex-1 truncate">{pdfFile.name}</span>
                <button type="button" onClick={() => setPdfFile(null)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div {...getRootProps()} className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300',
              )}>
                <input {...getInputProps()} />
                <Upload className="h-7 w-7 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">Arrastra el contrato aquí o haz clic</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG · máx. 20 MB</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Notas</CardTitle></CardHeader>
          <CardContent>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={3} placeholder="Observaciones, condiciones de pago, etc."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/admin/ventas" className="flex-1">
            <Button type="button" variant="outline" className="w-full" disabled={submitting}>Cancelar</Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Registrando…</> : 'Registrar venta'}
          </Button>
        </div>
      </form>
    </div>
  );
}
