'use client';

import { useState, useMemo } from 'react';
import { Calculator, FileText, Info } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function parseNum(s: string): number {
  const clean = s.replace(/[^\d]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

function fmtInput(n: number): string {
  if (!n) return '';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
}

// UVT 2026 Colombia — Resolución DIAN 000238 del 15 de diciembre de 2025
const UVT_2026 = 52374;

// ── Componente Tab ────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 font-medium text-sm rounded-lg transition-colors ${
        active
          ? 'bg-[#B8973E] text-white shadow'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

// ── TAB 1: Simulador hipotecario ──────────────────────────────────────────────

function SimuladorHipotecario() {
  const [valorInmueble,  setValorInmueble]  = useState(0);
  const [porcentaje,     setPorcentaje]     = useState(70);
  const [plazoAnios,     setPlazoAnios]     = useState(20);
  const [tasaAnual,      setTasaAnual]      = useState(13.5);

  const resultado = useMemo(() => {
    if (!valorInmueble) return null;
    const P = valorInmueble * (porcentaje / 100);
    const r = tasaAnual / 100 / 12;
    const n = plazoAnios * 12;
    // M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const potencia   = Math.pow(1 + r, n);
    const cuota      = P * (r * potencia) / (potencia - 1);
    const totalPagar = cuota * n;
    return {
      credito:      P,
      cuotaMensual: cuota,
      totalPagar,
      totalIntereses: totalPagar - P,
    };
  }, [valorInmueble, porcentaje, plazoAnios, tasaAnual]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Formulario */}
      <div className="space-y-6">
        {/* Valor del inmueble */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Valor del inmueble
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
            <input
              type="text"
              inputMode="numeric"
              className="w-full pl-7 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8973E]/50 text-slate-800 font-medium"
              placeholder="0"
              value={fmtInput(valorInmueble)}
              onChange={(e) => setValorInmueble(parseNum(e.target.value))}
            />
          </div>
        </div>

        {/* Porcentaje de financiación */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-semibold text-slate-700">Porcentaje de financiación</label>
            <span className="text-sm font-bold text-[#B8973E]">{porcentaje}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={80}
            step={5}
            value={porcentaje}
            onChange={(e) => setPorcentaje(Number(e.target.value))}
            className="w-full accent-[#B8973E]"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>50%</span><span>80%</span>
          </div>
        </div>

        {/* Plazo */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Plazo en años</label>
          <select
            value={plazoAnios}
            onChange={(e) => setPlazoAnios(Number(e.target.value))}
            className="w-full py-3 px-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8973E]/50 text-slate-800 font-medium bg-white"
          >
            {[5, 10, 15, 20, 30].map((y) => (
              <option key={y} value={y}>{y} años</option>
            ))}
          </select>
        </div>

        {/* Tasa de interés */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Tasa de interés anual (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="30"
            className="w-full py-3 px-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8973E]/50 text-slate-800 font-medium"
            value={tasaAnual}
            onChange={(e) => setTasaAnual(Number(e.target.value))}
          />
          <p className="text-xs text-slate-400 mt-1">Tasa promedio Colombia 2026: 13.5%</p>
        </div>
      </div>

      {/* Resultado */}
      <div>
        {resultado && valorInmueble > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Resultado estimado</h3>

            <div className="space-y-3">
              {[
                { label: 'Valor del crédito',   value: resultado.credito,        highlight: false },
                { label: 'Cuota mensual',        value: resultado.cuotaMensual,   highlight: true  },
                { label: 'Total a pagar',        value: resultado.totalPagar,     highlight: false },
                { label: 'Total en intereses',   value: resultado.totalIntereses, highlight: false },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className={`flex justify-between items-center py-3 px-4 rounded-xl ${
                    highlight ? 'bg-[#B8973E]/10 border border-[#B8973E]/20' : 'bg-white border border-slate-100'
                  }`}
                >
                  <span className={`text-sm font-medium ${highlight ? 'text-[#B8973E]' : 'text-slate-600'}`}>
                    {label}
                  </span>
                  <span className={`font-bold ${highlight ? 'text-[#B8973E] text-lg' : 'text-slate-800'}`}>
                    {fmt(value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Resumen rápido */}
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200 space-y-0.5">
              <p>Inmueble: {fmt(valorInmueble)} · Financiación: {porcentaje}% · Plazo: {plazoAnios} años · Tasa: {tasaAnual}% EA</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Ingresa el valor del inmueble para ver la simulación</p>
          </div>
        )}

        {/* Nota */}
        <div className="mt-4 flex gap-2.5 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Este simulador es orientativo. La tasa final depende del banco y el perfil del solicitante.
            Te recomendamos consultar con tu entidad financiera.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── TAB 2: Gastos notariales ──────────────────────────────────────────────────

type TipoVendedor = 'natural' | 'juridica';

// Umbral de retención en la fuente para persona natural en compraventa de vivienda.
// Bajo este valor aplica 1%; igual o por encima, 2.5%.
const RETENCION_THRESHOLD = 685_000_000;

// Cuota fija de administración de la notaría — se reparte 50/50 entre las partes.
const ADMIN_NOTARIA = 350000;

interface GastoRow {
  concepto:    string;
  comprador:   number | null;  // null → no aplica (se muestra "—")
  vendedor:    number | null;
  vendedorNA?: boolean;        // true → muestra "N/A" en la columna vendedor (concepto solo aplica a persona natural)
}

function GastosNotariales() {
  const [valor,        setValor]        = useState(0);
  const [tipoVendedor, setTipoVendedor] = useState<TipoVendedor>('natural');

  const gastos = useMemo<GastoRow[]>(() => {
    if (!valor) return [];

    // Gastos compartidos 50/50 entre comprador y vendedor
    const notariaCadaUno = valor * 0.0027;          // derechos notariales 0.27% c/u (0.54% total)
    const ivaCadaUno     = notariaCadaUno * 0.19;   // IVA 19% sobre los derechos notariales
    const adminCadaUno   = ADMIN_NOTARIA / 2;       // cuota fija de administración, dividida 50/50

    // Gastos del comprador (iguales para persona natural y jurídica)
    const registroComprador     = valor * 0.005;    // impuesto de registro 0.5%
    const beneficenciaComprador = valor * 0.01;     // beneficencia y registro 1%

    // Retención en la fuente del vendedor.
    // Persona jurídica: 2.5% siempre. Persona natural: 1% (< umbral) o 2.5% (>= umbral).
    const retencion =
      tipoVendedor === 'juridica'
        ? valor * 0.025
        : valor < RETENCION_THRESHOLD
          ? valor * 0.01
          : valor * 0.025;

    // Impuesto de registro y beneficencia del vendedor: solo persona natural (0.5%).
    // Persona jurídica no lo paga → se muestra "N/A".
    const registroVendedor = tipoVendedor === 'natural' ? valor * 0.005 : null;

    return [
      { concepto: 'Derechos notariales (0.27% c/u)', comprador: notariaCadaUno,        vendedor: notariaCadaUno },
      { concepto: 'IVA notaría (19% s/notaría)',     comprador: ivaCadaUno,            vendedor: ivaCadaUno     },
      { concepto: 'Impuesto de registro (0.5%)',     comprador: registroComprador,     vendedor: null           },
      { concepto: 'Beneficencia (1%)',               comprador: beneficenciaComprador, vendedor: null           },
      { concepto: 'Cuota adm. notaría',              comprador: adminCadaUno,          vendedor: adminCadaUno   },
      { concepto: 'Retención en la fuente',          comprador: null,                  vendedor: retencion      },
      {
        concepto:   'Impuesto registro vendedor*',
        comprador:  null,
        vendedor:   registroVendedor,
        vendedorNA: tipoVendedor === 'juridica',
      },
    ];
  }, [valor, tipoVendedor]);

  const totalComprador = gastos.reduce((s, r) => s + (r.comprador ?? 0), 0);
  const totalVendedor  = gastos.reduce((s, r) => s + (r.vendedor  ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="space-y-4">
        {/* Tipo de vendedor — va ANTES del valor */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Tipo de vendedor
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { v: 'natural',  label: 'Persona Natural'   },
              { v: 'juridica', label: 'Persona Jurídica'  },
            ] as const).map((opt) => {
              const activo = tipoVendedor === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setTipoVendedor(opt.v)}
                  className={`flex items-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                    activo
                      ? 'border-[#B8973E] bg-[#B8973E]/10 text-[#B8973E]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      activo ? 'border-[#B8973E]' : 'border-slate-300'
                    }`}
                  >
                    {activo && <span className="h-2 w-2 rounded-full bg-[#B8973E]" />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Valor de la propiedad */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Valor de la propiedad
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
            <input
              type="text"
              inputMode="numeric"
              className="w-full pl-7 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B8973E]/50 text-slate-800 font-medium"
              placeholder="0"
              value={fmtInput(valor)}
              onChange={(e) => setValor(parseNum(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      {valor > 0 && gastos.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Concepto</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Paga comprador</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Paga vendedor</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-600">{row.concepto}</td>
                    <td className="py-3 px-4 text-right text-slate-800 font-medium">
                      {row.comprador != null ? fmt(row.comprador) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800 font-medium">
                      {row.vendedor != null ? fmt(row.vendedor) : row.vendedorNA ? 'N/A' : '—'}
                    </td>
                  </tr>
                ))}
                {/* Totales */}
                <tr className="bg-[#B8973E]/10 font-bold">
                  <td className="py-3 px-4 text-slate-800">Total</td>
                  <td className="py-3 px-4 text-right text-[#B8973E]">{fmt(totalComprador)}</td>
                  <td className="py-3 px-4 text-right text-[#B8973E]">{fmt(totalVendedor)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">* El impuesto de registro del vendedor solo aplica a persona natural.</p>

          {/* Resumen totales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-600 font-medium mb-1">Total comprador</p>
              <p className="text-xl font-bold text-blue-700">{fmt(totalComprador)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
              <p className="text-xs text-purple-600 font-medium mb-1">Total vendedor</p>
              <p className="text-xl font-bold text-purple-700">{fmt(totalVendedor)}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Ingresa el valor de la propiedad para ver los gastos</p>
        </div>
      )}

      {/* Nota */}
      <div className="flex gap-2.5 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Valores aproximados según tarifas vigentes Colombia 2026 (UVT: ${UVT_2026.toLocaleString('es-CO')}).
          Resolución SNR RES-2026-000964-6. Consulta con tu notaría los valores exactos para tu operación.
        </p>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const [tab, setTab] = useState<'credito' | 'gastos'>('credito');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-slate-800 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Simulador financiero</h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto">
            Planifica tu compra con herramientas claras y confiables
          </p>
        </div>
      </section>

      {/* Contenido */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 p-1 bg-white border border-slate-200 rounded-xl w-fit">
          <Tab active={tab === 'credito'} onClick={() => setTab('credito')}>
            <Calculator className="h-4 w-4" />
            Crédito hipotecario
          </Tab>
          <Tab active={tab === 'gastos'} onClick={() => setTab('gastos')}>
            <FileText className="h-4 w-4" />
            Gastos notariales
          </Tab>
        </div>

        {/* Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {tab === 'credito' ? <SimuladorHipotecario /> : <GastosNotariales />}
        </div>
      </section>
    </div>
  );
}
