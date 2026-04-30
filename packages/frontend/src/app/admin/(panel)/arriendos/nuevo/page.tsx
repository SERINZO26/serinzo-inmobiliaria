'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { rentalApi, propertiesApi, clientsApi, staffApi } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

export default function NuevoArriendoPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [form, setForm] = useState({
    propertyId:      '',
    clientId:        '',
    agentId:         session?.user?.id ?? '',
    startDate:       '',
    durationMonths:  12,
    monthlyRent:     '',
    commissionPct:   '10',
    adminFee:        '',
    depositAmount:   '',
    notes:           '',
  });

  const [clientSearch, setClientSearch] = useState('');
  const [propSearch,   setPropSearch]   = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  // Datos para los selectores
  const { data: propsData } = useQuery({
    queryKey: ['props-disponibles'],
    queryFn: async () => (await propertiesApi.getAll({ status: 'DISPONIBLE', limit: 100 })).data.data,
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

  // Fecha de fin calculada automáticamente
  const endDate = useMemo(() => {
    if (!form.startDate) return '';
    const d = new Date(form.startDate);
    d.setMonth(d.getMonth() + Number(form.durationMonths));
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [form.startDate, form.durationMonths]);

  // Calculadora en tiempo real
  const rent       = Number(form.monthlyRent) || 0;
  const commPct    = Number(form.commissionPct) || 0;
  const commission = rent > 0 && commPct > 0 ? (rent * commPct) / 100 : 0;
  const adminFee   = Number(form.adminFee) || 0;
  const propietario = rent - commission - adminFee;

  // Filtros de búsqueda
  const filteredProps    = (propsData ?? []).filter(p =>
    p.title.toLowerCase().includes(propSearch.toLowerCase()) ||
    p.address.toLowerCase().includes(propSearch.toLowerCase())
  );
  const filteredClients  = (clientsData ?? []).filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone ?? '').includes(clientSearch)
  );

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.propertyId) return setError('Selecciona un inmueble');
    if (!form.clientId)   return setError('Selecciona un arrendatario');
    if (!form.startDate)  return setError('Indica la fecha de inicio');
    if (!form.monthlyRent || Number(form.monthlyRent) <= 0)
      return setError('Ingresa un canon mensual válido');

    setSubmitting(true);
    try {
      const res = await rentalApi.create({
        propertyId:    form.propertyId,
        clientId:      form.clientId,
        agentId:       form.agentId || session?.user?.id,
        startDate:     form.startDate,
        endDate,
        monthlyRent:   Number(form.monthlyRent),
        commissionPct: commPct || undefined,
        adminFee:      adminFee || undefined,
        depositAmount: Number(form.depositAmount) || undefined,
        notes:         form.notes || undefined,
      });
      router.push(`/admin/arriendos/${res.data.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'No se pudo crear el contrato. Verifica los datos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/arriendos">
          <Button variant="ghost" size="sm" className="gap-1 -ml-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo contrato de arriendo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Los pagos mensuales se generan automáticamente.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Inmueble y partes */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Inmueble y partes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Inmueble */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Inmueble *</label>
              <input
                type="text"
                placeholder="Buscar por nombre o dirección…"
                value={propSearch}
                onChange={(e) => setPropSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {filteredProps.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">No hay inmuebles disponibles</p>
                )}
                {filteredProps.map((p) => (
                  <button
                    key={p.id} type="button"
                    onClick={() => { set('propertyId', p.id); setPropSearch(p.title); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors',
                      form.propertyId === p.id && 'bg-green-50 text-green-700 font-medium',
                    )}
                  >
                    {p.title} <span className="text-slate-400">· {p.city}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Arrendatario */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Arrendatario *</label>
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {filteredClients.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">No se encontraron clientes</p>
                )}
                {filteredClients.map((cl) => (
                  <button
                    key={cl.id} type="button"
                    onClick={() => { set('clientId', cl.id); setClientSearch(cl.name); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors',
                      form.clientId === cl.id && 'bg-green-50 text-green-700 font-medium',
                    )}
                  >
                    {cl.name} <span className="text-slate-400">· {cl.phone}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Agente (solo admin) */}
            {isAdmin && staffData && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Agente responsable</label>
                <select
                  value={form.agentId}
                  onChange={(e) => set('agentId', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seleccionar agente…</option>
                  {staffData.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Datos del contrato */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Datos del contrato</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Fecha de inicio *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Duración (meses)</label>
                <select
                  value={form.durationMonths}
                  onChange={(e) => set('durationMonths', Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {[6, 12, 18, 24, 36].map((m) => (
                    <option key={m} value={m}>{m} meses</option>
                  ))}
                </select>
              </div>
            </div>

            {endDate && (
              <div className="bg-slate-50 rounded-lg px-4 py-2.5 text-sm text-slate-600">
                Fecha de fin calculada: <strong>{new Date(endDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Valores financieros */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Valores financieros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Canon mensual (COP) *</label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyRent}
                  onChange={(e) => set('monthlyRent', e.target.value)}
                  placeholder="Ej: 1500000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">% Comisión</label>
                <input
                  type="number"
                  min="0" max="100" step="0.5"
                  value={form.commissionPct}
                  onChange={(e) => set('commissionPct', e.target.value)}
                  placeholder="10"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Administración (COP)</label>
                <input
                  type="number"
                  min="0"
                  value={form.adminFee}
                  onChange={(e) => set('adminFee', e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Calculadora en tiempo real */}
            {rent > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm font-mono">
                <div className="flex justify-between text-slate-700">
                  <span>Canon mensual</span>
                  <span>{formatPrice(rent, 'COP')}</span>
                </div>
                {commission > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Comisión ({commPct}%)</span>
                    <span>- {formatPrice(commission, 'COP')}</span>
                  </div>
                )}
                {adminFee > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Administración</span>
                    <span>- {formatPrice(adminFee, 'COP')}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-green-700">
                  <span>Pago al propietario</span>
                  <span>{formatPrice(propietario, 'COP')}</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Fianza / depósito (COP)</label>
              <input
                type="number"
                min="0"
                value={form.depositAmount}
                onChange={(e) => set('depositAmount', e.target.value)}
                placeholder="Ej: 3000000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Notas internas</CardTitle></CardHeader>
          <CardContent>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Observaciones, condiciones especiales, etc."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/admin/arriendos" className="flex-1">
            <Button type="button" variant="outline" className="w-full" disabled={submitting}>Cancelar</Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando…</> : 'Crear contrato'}
          </Button>
        </div>
      </form>
    </div>
  );
}
