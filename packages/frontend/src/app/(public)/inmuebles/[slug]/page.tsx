'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bed,
  Bath,
  Maximize2,
  Car,
  Layers,
  Hash,
  MessageCircle,
  Phone,
  Info,
  ChevronLeft,
  MapPin,
} from 'lucide-react';
import { propertiesApi, clientsApi } from '@/lib/api';
import { formatPrice, formatArea, propertyOperationLabel, propertyTypeLabel } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const WA_NUMBER = '573182063924';

// ─── Galería ──────────────────────────────────────────────────────────────────

function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [selected, setSelected] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center">
        <p className="text-slate-400 text-sm">Sin fotos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Foto principal */}
      <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100">
        <img
          src={photos[selected]}
          alt={`${title} - foto ${selected + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Miniaturas */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                selected === i ? 'border-blue-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-90'
              }`}
            >
              <img src={photo} alt={`Miniatura ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal contacto ───────────────────────────────────────────────────────────

function ContactModal({
  open,
  onClose,
  propertyTitle,
  propertyId,
}: {
  open: boolean;
  onClose: () => void;
  propertyTitle: string;
  propertyId: string;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: 'Nombre y teléfono son requeridos', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await clientsApi.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        source: 'WEB',
        additionalRequirements: form.message.trim()
          ? `Inmueble: ${propertyTitle}. Mensaje: ${form.message}`
          : `Solicitud de información sobre: ${propertyTitle}`,
      } as Parameters<typeof clientsApi.create>[0]);
      setSent(true);
    } catch {
      toast({
        title: 'No se pudo enviar la solicitud',
        description: 'Intenta de nuevo o escríbenos por WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar información</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-lg mb-2">¡Recibimos tu solicitud!</h3>
            <p className="text-slate-500 text-sm">Te contactaremos pronto para darte más información sobre este inmueble.</p>
            <Button className="mt-4" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="modal-name">
                Nombre completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-name"
                placeholder="Tu nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modal-phone">
                Teléfono <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-phone"
                type="tel"
                placeholder="+57 300 000 0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modal-email">Email (opcional)</Label>
              <Input
                id="modal-email"
                type="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modal-msg">Mensaje (opcional)</Label>
              <Textarea
                id="modal-msg"
                rows={3}
                placeholder="¿Qué quieres saber sobre este inmueble?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PropertyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [contactOpen, setContactOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['property', 'public', slug],
    queryFn: () => propertiesApi.getPublicBySlug(slug),
    enabled: !!slug,
  });

  const property = data?.data?.data;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Inmueble no encontrado</h1>
        <p className="text-slate-500 mb-6">Es posible que este inmueble ya no esté disponible.</p>
        <Button asChild variant="outline">
          <Link href="/inmuebles">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Ver todos los inmuebles
          </Link>
        </Button>
      </div>
    );
  }

  const waMessage = encodeURIComponent(
    `Hola, vi el inmueble "${property.title}" en su página web y me gustaría más información`
  );
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${waMessage}`;
  const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(property.address + ', ' + property.city)}&output=embed`;

  const opColor =
    property.operation === 'VENTA'
      ? 'bg-blue-100 text-blue-700'
      : property.operation === 'ARRIENDO'
      ? 'bg-green-100 text-green-700'
      : 'bg-purple-100 text-purple-700';

  return (
    <>
      <div className="bg-slate-50 min-h-screen">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Link href="/" className="hover:text-slate-700">Inicio</Link>
              <span>/</span>
              <Link href="/inmuebles" className="hover:text-slate-700">Inmuebles</Link>
              <span>/</span>
              <span className="text-slate-700 truncate max-w-xs">{property.title}</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Columna izquierda ────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Galería */}
              <Gallery photos={property.photos} title={property.title} />

              {/* Título y ubicación */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge className={opColor}>
                    {propertyOperationLabel(property.operation)}
                  </Badge>
                  <Badge variant="outline" className="text-slate-500">
                    {propertyTypeLabel(property.type)}
                  </Badge>
                  {property.featured && (
                    <Badge className="bg-amber-100 text-amber-700">⭐ Destacado</Badge>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{property.title}</h1>
                {(property.neighborhood || property.city) && (
                  <p className="flex items-center gap-1.5 text-slate-500 mt-2">
                    <MapPin className="h-4 w-4" />
                    {[property.neighborhood, property.city, property.department]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>

              {/* Características principales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.bedrooms != null && (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <Bed className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Habitaciones</p>
                      <p className="font-semibold text-slate-800">{property.bedrooms}</p>
                    </div>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <Bath className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Baños</p>
                      <p className="font-semibold text-slate-800">{property.bathrooms}</p>
                    </div>
                  </div>
                )}
                {property.areaTotalM2 != null && (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <Maximize2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Área</p>
                      <p className="font-semibold text-slate-800">{formatArea(property.areaTotalM2)}</p>
                    </div>
                  </div>
                )}
                {property.parking != null && (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <Car className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Parqueadero</p>
                      <p className="font-semibold text-slate-800">{property.parking}</p>
                    </div>
                  </div>
                )}
                {property.floor != null && (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <Layers className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Piso</p>
                      <p className="font-semibold text-slate-800">{property.floor}</p>
                    </div>
                  </div>
                )}
                {property.strata != null && (
                  <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <Hash className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Estrato</p>
                      <p className="font-semibold text-slate-800">{property.strata}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Descripción */}
              {property.description && (
                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <h2 className="font-semibold text-slate-800 mb-3">Descripción</h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line text-sm">
                    {property.description}
                  </p>
                </div>
              )}

              {/* Mapa */}
              <div className="bg-white rounded-2xl overflow-hidden border border-slate-100">
                <div className="px-6 pt-5 pb-3 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800">Ubicación</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{property.address}</p>
                </div>
                <iframe
                  title="Mapa"
                  src={mapsUrl}
                  width="100%"
                  height="280"
                  loading="lazy"
                  style={{ border: 0 }}
                  allowFullScreen
                />
              </div>
            </div>

            {/* ── Columna derecha (sticky) ─────────────────────────────── */}
            <div>
              <div className="lg:sticky lg:top-24 space-y-4">
                {/* Precio */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <p className="text-3xl font-bold text-slate-900">
                    {formatPrice(property.price, property.priceCurrency)}
                  </p>
                  {property.priceNegotiable && (
                    <p className="text-sm text-slate-400 mt-0.5">Precio negociable</p>
                  )}
                  {property.administrationFee && (
                    <p className="text-sm text-slate-500 mt-1">
                      Adm: {formatPrice(property.administrationFee, property.priceCurrency)} /mes
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    Ref. #{property.id.slice(-6).toUpperCase()}
                  </p>
                </div>

                {/* Contacto */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
                  <h2 className="font-semibold text-slate-800">¿Te interesa este inmueble?</h2>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#B8973E] hover:bg-[#8B6E2E] text-white font-semibold rounded-xl transition-colors"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Escribir por WhatsApp
                  </a>

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setContactOpen(true)}
                  >
                    <Info className="h-4 w-4" />
                    Solicitar información
                  </Button>

                  <a
                    href="tel:+573182063924"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
                  >
                    <Phone className="h-4 w-4" />
                    Llamar ahora
                  </a>
                </div>

                {/* Volver */}
                <Link
                  href="/inmuebles"
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Ver todos los inmuebles
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        propertyTitle={property.title}
        propertyId={property.id}
      />
    </>
  );
}
