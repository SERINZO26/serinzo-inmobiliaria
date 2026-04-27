'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AvailabilityPicker, type DaySlot } from '@/components/availability-picker/AvailabilityPicker';
import { PhotoUploader } from '@/components/property-form/PhotoUploader';
import { propertiesApi, photosApi, type Property, type PropertyType, type PropertyOperation } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'LOCAL', label: 'Local comercial' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'LOTE', label: 'Lote' },
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'FINCA', label: 'Finca' },
];

const COLOMBIA_DEPARTMENTS = [
  'Antioquia', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Cauca', 'Cesar', 'Córdoba', 'Cundinamarca', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés',
];

const FEATURES_BY_CATEGORY = {
  Interior: ['Estudio', 'Cuarto de servicio', 'Clósets empotrados', 'Chimenea', 'Terraza'],
  Exterior: ['Jardín', 'Piscina', 'BBQ', 'Cancha'],
  'Zona común': ['Gimnasio', 'Salón comunal', 'Parque infantil', 'Ascensor'],
  Servicios: ['Gas natural', 'Internet incluido', 'Agua caliente'],
  Seguridad: ['Vigilancia 24h', 'Portería', 'Alarma', 'Cámaras'],
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-slate-800 pb-2 border-b border-slate-200 mb-4">
      {children}
    </h2>
  );
}

function ToggleButton({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left',
        checked ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      <div>
        <p className="font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className={cn(
        'w-11 h-6 rounded-full relative transition-colors flex-shrink-0',
        checked ? 'bg-slate-800' : 'bg-slate-300',
      )}>
        <div className={cn(
          'absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )} />
      </div>
    </button>
  );
}

function FeatureChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border transition-all',
        selected
          ? 'bg-slate-800 text-white border-slate-800'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
      )}
    >
      {label}
    </button>
  );
}

function NumInput({ label, value, onChange, min = 0 }: {
  label: string; value: string; onChange: (v: string) => void; min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
        placeholder="—"
      />
    </div>
  );
}

// ─── Tipos del formulario ─────────────────────────────────────────────────────

interface FormData {
  type: string;
  operation: string;
  title: string;
  description: string;
  price: string;
  priceCurrency: string;
  priceNegotiable: boolean;
  administrationFee: string;
  bedrooms: string;
  bathrooms: string;
  halfBathrooms: string;
  parking: string;
  areaTotalM2: string;
  areaBuiltM2: string;
  floor: string;
  totalFloors: string;
  ageYears: string;
  strata: string;
  address: string;
  city: string;
  neighborhood: string;
  department: string;
  virtualTourUrl: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerNotes: string;
  visitSpecialInstructions: string;
  published: boolean;
  featured: boolean;
  photos: string[];
  selectedFeatures: string[];
  visitSlots: DaySlot[];
}

function initialForm(property?: Property): FormData {
  if (!property) {
    return {
      type: 'APARTAMENTO', operation: 'VENTA', title: '', description: '',
      price: '', priceCurrency: 'COP', priceNegotiable: false, administrationFee: '',
      bedrooms: '', bathrooms: '', halfBathrooms: '', parking: '',
      areaTotalM2: '', areaBuiltM2: '', floor: '', totalFloors: '', ageYears: '', strata: '',
      address: '', city: '', neighborhood: '', department: 'Bogotá D.C.', virtualTourUrl: '',
      ownerName: '', ownerPhone: '', ownerEmail: '', ownerNotes: '',
      visitSpecialInstructions: '', published: false, featured: false,
      photos: [], selectedFeatures: [], visitSlots: [],
    };
  }
  return {
    type: property.type,
    operation: property.operation,
    title: property.title,
    description: property.description ?? '',
    price: property.price?.toString() ?? '',
    priceCurrency: property.priceCurrency ?? 'COP',
    priceNegotiable: property.priceNegotiable ?? false,
    administrationFee: property.administrationFee?.toString() ?? '',
    bedrooms: property.bedrooms?.toString() ?? '',
    bathrooms: property.bathrooms?.toString() ?? '',
    halfBathrooms: property.halfBathrooms?.toString() ?? '',
    parking: property.parking?.toString() ?? '',
    areaTotalM2: property.areaTotalM2?.toString() ?? '',
    areaBuiltM2: property.areaBuiltM2?.toString() ?? '',
    floor: property.floor?.toString() ?? '',
    totalFloors: property.totalFloors?.toString() ?? '',
    ageYears: property.ageYears?.toString() ?? '',
    strata: property.strata?.toString() ?? '',
    address: property.address ?? '',
    city: property.city ?? '',
    neighborhood: property.neighborhood ?? '',
    department: property.department ?? 'Bogotá D.C.',
    virtualTourUrl: property.virtualTourUrl ?? '',
    ownerName: property.ownerName ?? '',
    ownerPhone: property.ownerPhone ?? '',
    ownerEmail: property.ownerEmail ?? '',
    ownerNotes: property.ownerNotes ?? '',
    visitSpecialInstructions: property.visitSpecialInstructions ?? '',
    published: property.published ?? false,
    featured: property.featured ?? false,
    photos: property.photos ?? [],
    selectedFeatures: [],
    visitSlots: (property.visitTimeSlots ?? []).map((s, i) => ({
      dayOfWeek: i + 1,
      startTime: s.from,
      endTime: s.to,
    })),
  };
}

function formToPayload(f: FormData): Partial<Property> {
  return {
    type: f.type as PropertyType,
    operation: f.operation as PropertyOperation,
    title: f.title,
    description: f.description,
    price: parseFloat(f.price) || 0,
    priceCurrency: f.priceCurrency,
    priceNegotiable: f.priceNegotiable,
    administrationFee: f.administrationFee ? parseFloat(f.administrationFee) : null,
    bedrooms: f.bedrooms ? parseInt(f.bedrooms) : null,
    bathrooms: f.bathrooms ? parseInt(f.bathrooms) : null,
    halfBathrooms: f.halfBathrooms ? parseInt(f.halfBathrooms) : null,
    parking: f.parking ? parseInt(f.parking) : null,
    areaTotalM2: f.areaTotalM2 ? parseFloat(f.areaTotalM2) : null,
    areaBuiltM2: f.areaBuiltM2 ? parseFloat(f.areaBuiltM2) : null,
    floor: f.floor ? parseInt(f.floor) : null,
    totalFloors: f.totalFloors ? parseInt(f.totalFloors) : null,
    ageYears: f.ageYears ? parseInt(f.ageYears) : null,
    strata: f.strata ? parseInt(f.strata) : null,
    address: f.address,
    city: f.city,
    neighborhood: f.neighborhood,
    department: f.department,
    virtualTourUrl: f.virtualTourUrl || null,
    ownerName: f.ownerName || null,
    ownerPhone: f.ownerPhone || null,
    ownerEmail: f.ownerEmail || null,
    ownerNotes: f.ownerNotes || null,
    visitSpecialInstructions: f.visitSpecialInstructions || null,
    visitTimeSlots: f.visitSlots.map((s) => ({ from: s.startTime, to: s.endTime })),
    visitDays: f.visitSlots.map((s) => {
      const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      return days[s.dayOfWeek];
    }),
    published: f.published,
    featured: f.featured,
    photos: f.photos,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface PropertyFormProps {
  property?: Property;
  mode: 'new' | 'edit';
}

export function PropertyForm({ property, mode }: PropertyFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [form, setForm] = useState<FormData>(() => initialForm(property));
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Auto-guardado cada 30 segundos (solo en modo edición)
  const autoSave = useCallback(async () => {
    if (mode !== 'edit' || !property?.id || !form.title) return;
    setAutoSaveStatus('saving');
    try {
      await propertiesApi.update(property.id, formToPayload(form));
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch {
      setAutoSaveStatus('error');
    }
  }, [form, mode, property?.id]);

  useEffect(() => {
    if (mode !== 'edit') return;
    autoSaveRef.current = setTimeout(autoSave, 30_000);
    return () => clearTimeout(autoSaveRef.current);
  }, [form, autoSave, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError('El título del inmueble es obligatorio.');
    if (!form.price || parseFloat(form.price) <= 0) return setError('El precio debe ser mayor a 0.');
    if (!form.address.trim()) return setError('La dirección es obligatoria.');
    if (!form.city.trim()) return setError('La ciudad es obligatoria.');

    setSaving(true);
    setError('');
    try {
      if (mode === 'new') {
        // 1. Crear inmueble
        const res = await propertiesApi.create(formToPayload(form));
        const newId = res.data.data.id;

        // 2. Subir fotos pendientes al nuevo inmueble
        if (pendingFiles.length > 0) {
          try {
            await photosApi.upload(newId, pendingFiles);
          } catch {
            // Las fotos no bloquean el guardado — el usuario puede subirlas después
            setError('El inmueble se creó correctamente, pero hubo un problema al subir las fotos. Puedes agregarlas desde la edición.');
            router.push(`/admin/inmuebles/${newId}`);
            return;
          }
        }

        router.push(`/admin/inmuebles/${newId}`);
      } else if (property?.id) {
        await propertiesApi.update(property.id, formToPayload(form));
        router.push('/admin/inmuebles');
      }
    } catch {
      setError('No se pudo guardar el inmueble. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function toggleFeature(feat: string) {
    set('selectedFeatures',
      form.selectedFeatures.includes(feat)
        ? form.selectedFeatures.filter((f) => f !== feat)
        : [...form.selectedFeatures, feat],
    );
  }

  const mapAddress = encodeURIComponent(`${form.address}, ${form.city}, Colombia`);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* Auto-save indicator */}
      {mode === 'edit' && autoSaveStatus !== 'idle' && (
        <div className={cn(
          'flex items-center gap-2 text-sm px-3 py-2 rounded-lg w-fit',
          autoSaveStatus === 'saving' && 'bg-blue-50 text-blue-600',
          autoSaveStatus === 'saved' && 'bg-green-50 text-green-600',
          autoSaveStatus === 'error' && 'bg-red-50 text-red-600',
        )}>
          {autoSaveStatus === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {autoSaveStatus === 'saved' && <CheckCircle2 className="h-3.5 w-3.5" />}
          {autoSaveStatus === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
          {autoSaveStatus === 'saving' && 'Guardando borrador...'}
          {autoSaveStatus === 'saved' && 'Borrador guardado'}
          {autoSaveStatus === 'error' && 'No se pudo guardar el borrador'}
        </div>
      )}

      {/* ── Información básica ── */}
      <section>
        <SectionTitle>Información básica</SectionTitle>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de inmueble</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de operación</Label>
              <div className="flex gap-2">
                {[
                  { value: 'VENTA', label: 'Venta' },
                  { value: 'ARRIENDO', label: 'Arriendo' },
                  { value: 'VENTA_O_ARRIENDO', label: 'Ambos' },
                ].map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => set('operation', op.value)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                      form.operation === op.value
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                    )}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Título del inmueble</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ej: Apartamento moderno 2 habitaciones en Chapinero"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label>Descripción</Label>
              <span className="text-xs text-slate-400">{form.description.length}/500</span>
            </div>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value.slice(0, 500))}
              placeholder="Describe el inmueble de forma atractiva..."
              rows={4}
            />
          </div>
        </div>
      </section>

      {/* ── Precio ── */}
      <section>
        <SectionTitle>Precio</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Precio</Label>
            <div className="flex gap-2">
              <Select value={form.priceCurrency} onValueChange={(v) => set('priceCurrency', v)}>
                <SelectTrigger className="w-24 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0"
                className="flex-1"
              />
            </div>
          </div>
          {(form.operation === 'ARRIENDO' || form.operation === 'VENTA_O_ARRIENDO') && (
            <div className="space-y-1.5">
              <Label>Administración mensual</Label>
              <Input
                type="number"
                min={0}
                value={form.administrationFee}
                onChange={(e) => set('administrationFee', e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          <ToggleButton
            checked={form.priceNegotiable}
            onChange={(v) => set('priceNegotiable', v)}
            label="Precio negociable"
            description="El comprador puede hacer una oferta distinta al precio publicado"
          />
        </div>
      </section>

      {/* ── Características ── */}
      <section>
        <SectionTitle>Características</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <NumInput label="Habitaciones" value={form.bedrooms} onChange={(v) => set('bedrooms', v)} />
          <NumInput label="Baños" value={form.bathrooms} onChange={(v) => set('bathrooms', v)} />
          <NumInput label="Baños auxiliares" value={form.halfBathrooms} onChange={(v) => set('halfBathrooms', v)} />
          <NumInput label="Parqueaderos" value={form.parking} onChange={(v) => set('parking', v)} />
          <NumInput label="Estrato" value={form.strata} onChange={(v) => set('strata', v)} min={1} />
          <NumInput label="Área total (m²)" value={form.areaTotalM2} onChange={(v) => set('areaTotalM2', v)} />
          <NumInput label="Área construida (m²)" value={form.areaBuiltM2} onChange={(v) => set('areaBuiltM2', v)} />
          <NumInput label="Piso" value={form.floor} onChange={(v) => set('floor', v)} />
          <NumInput label="Pisos totales" value={form.totalFloors} onChange={(v) => set('totalFloors', v)} />
          <NumInput label="Años de construcción" value={form.ageYears} onChange={(v) => set('ageYears', v)} />
        </div>

        <p className="text-sm font-medium text-slate-700 mb-3">Características adicionales</p>
        <div className="space-y-4">
          {Object.entries(FEATURES_BY_CATEGORY).map(([category, features]) => (
            <div key={category}>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">{category}</p>
              <div className="flex flex-wrap gap-2">
                {features.map((feat) => (
                  <FeatureChip
                    key={feat}
                    label={feat}
                    selected={form.selectedFeatures.includes(feat)}
                    onToggle={() => toggleFeature(feat)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ubicación ── */}
      <section>
        <SectionTitle>Ubicación</SectionTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Dirección completa</Label>
            <Input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Ej: Calle 72 # 10-34, Apto 502"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ej: Bogotá" />
            </div>
            <div className="space-y-1.5">
              <Label>Barrio / Sector</Label>
              <Input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Ej: Chapinero" />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={(v) => set('department', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOMBIA_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.address && form.city && (
            <div className="rounded-lg overflow-hidden border border-slate-200 h-48">
              <iframe
                title="Mapa"
                width="100%"
                height="100%"
                frameBorder="0"
                src={`https://maps.google.com/maps?q=${mapAddress}&output=embed`}
                className="grayscale"
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Fotos y videos ── */}
      <section>
        <SectionTitle>Fotos y videos</SectionTitle>
        <PhotoUploader
          photos={form.photos}
          propertyId={property?.id ?? null}
          onChange={(urls) => set('photos', urls)}
          pendingFiles={pendingFiles}
          onPendingFiles={setPendingFiles}
        />

        <div className="mt-4 space-y-1.5">
          <Label>URL de video o tour virtual</Label>
          <Input
            value={form.virtualTourUrl}
            onChange={(e) => set('virtualTourUrl', e.target.value)}
            placeholder="Ej: https://youtube.com/watch?v=..."
          />
        </div>
      </section>

      {/* ── Datos del propietario ── */}
      <section>
        <SectionTitle>Datos del propietario</SectionTitle>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
          <Lock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            <strong>Información confidencial</strong> — Solo visible para el equipo. Nunca se muestra en el sitio web ni al agente de IA.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nombre del propietario</Label>
            <Input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="+57 300 000 0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} placeholder="propietario@email.com" />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>Notas internas</Label>
          <Textarea
            value={form.ownerNotes}
            onChange={(e) => set('ownerNotes', e.target.value)}
            placeholder="Condiciones especiales, preferencias del propietario, notas de la negociación..."
            rows={3}
          />
        </div>
      </section>

      {/* ── Disponibilidad para visitas ── */}
      <section>
        <SectionTitle>Disponibilidad para visitas</SectionTitle>
        <AvailabilityPicker value={form.visitSlots} onChange={(slots) => set('visitSlots', slots)} />
        <div className="mt-4 space-y-1.5">
          <Label>Instrucciones especiales</Label>
          <Textarea
            value={form.visitSpecialInstructions}
            onChange={(e) => set('visitSpecialInstructions', e.target.value)}
            placeholder="Ej: Llamar al portero antes de llegar. Pedir por el apartamento 502."
            rows={2}
          />
        </div>
      </section>

      {/* ── Publicación ── */}
      <section>
        <SectionTitle>Publicación</SectionTitle>
        <div className="space-y-3">
          <ToggleButton
            checked={form.published}
            onChange={(v) => set('published', v)}
            label="Publicar en el sitio web"
            description="El inmueble será visible para cualquier persona que visite el sitio"
          />
          <ToggleButton
            checked={form.featured}
            onChange={(v) => set('featured', v)}
            label="Destacar en la página principal"
            description="El inmueble aparecerá en la sección de destacados del inicio"
          />
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-2 pb-8">
        <Button type="submit" disabled={saving} className="min-w-36">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === 'new' ? 'Guardar inmueble' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
