'use client';

import { useState } from 'react';
import { Phone, MessageCircle, Mail, MapPin, Clock } from 'lucide-react';
import { clientsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const CONTACT_INFO = [
  {
    Icon: Phone,
    label: '+57 318 206 3924',
    href: 'tel:+573182063924',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    Icon: MessageCircle,
    label: 'WhatsApp: +57 318 206 3924',
    href: 'https://wa.me/573182063924',
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  {
    Icon: Mail,
    label: 'info@serinzo.com',
    href: 'mailto:info@serinzo.com',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  {
    Icon: MapPin,
    label: 'Calle 135 #7-42, Bogotá',
    href: undefined,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
  },
  {
    Icon: Clock,
    label: 'Lunes a viernes 8am – 6pm',
    href: undefined,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
  },
];

const ASUNTOS = [
  { value: 'comprar', label: 'Quiero comprar un inmueble' },
  { value: 'arrendar', label: 'Quiero arrendar un inmueble' },
  { value: 'ofrecer', label: 'Tengo un inmueble para ofrecer' },
  { value: 'otro', label: 'Otro' },
];

export default function ContactoPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    email: '',
    asunto: '',
    mensaje: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido';
    if (!form.telefono.trim()) e.telefono = 'El teléfono es requerido';
    if (!form.mensaje.trim()) e.mensaje = 'El mensaje es requerido';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const asuntoLabel = ASUNTOS.find((a) => a.value === form.asunto)?.label ?? form.asunto;
      await clientsApi.create({
        name: form.nombre.trim(),
        phone: form.telefono.trim(),
        email: form.email.trim() || undefined,
        source: 'WEB',
        additionalRequirements: `Asunto: ${asuntoLabel || 'Sin especificar'}. Mensaje: ${form.mensaje}`,
      } as Parameters<typeof clientsApi.create>[0]);

      setSent(true);
      toast({
        title: '¡Mensaje enviado!',
        description: 'Te contactaremos en menos de 24 horas.',
      });
    } catch {
      toast({
        title: 'No se pudo enviar el mensaje',
        description: 'Por favor inténtalo de nuevo o contáctanos por WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Encabezado */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-slate-900">Contáctanos</h1>
          <p className="text-slate-500 mt-2">
            Estamos aquí para ayudarte. Escríbenos y te respondemos pronto.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* ── Columna izquierda: info + mapa ──────────────────────────── */}
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-5">Información de contacto</h2>
              <ul className="space-y-4">
                {CONTACT_INFO.map(({ Icon, label, href, color, bg }) => {
                  const content = (
                    <div className="flex items-center gap-4">
                      <div className={`${bg} ${color} p-2.5 rounded-xl flex-shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-slate-700 text-sm">{label}</span>
                    </div>
                  );
                  return (
                    <li key={label}>
                      {href ? (
                        <a href={href} target={href.startsWith('http') ? '_blank' : undefined}
                          rel="noopener noreferrer" className="hover:opacity-75 transition-opacity block">
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Mapa */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <iframe
                title="Ubicación de la oficina"
                src="https://maps.google.com/maps?q=Bogotá,+Colombia&output=embed"
                width="100%"
                height="280"
                loading="lazy"
                style={{ border: 0 }}
                allowFullScreen
              />
            </div>
          </div>

          {/* ── Columna derecha: formulario ──────────────────────────────── */}
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Envíanos un mensaje</h2>

              {sent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">¡Mensaje enviado!</h3>
                  <p className="text-slate-500">
                    Gracias por contactarnos. Te responderemos en menos de 24 horas.
                  </p>
                  <Button
                    className="mt-6"
                    variant="outline"
                    onClick={() => {
                      setSent(false);
                      setForm({ nombre: '', telefono: '', email: '', asunto: '', mensaje: '' });
                    }}
                  >
                    Enviar otro mensaje
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cont-nombre">
                      Nombre completo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cont-nombre"
                      placeholder="Tu nombre"
                      value={form.nombre}
                      onChange={(e) => set('nombre', e.target.value)}
                    />
                    {errors.nombre && <p className="text-xs text-red-600">{errors.nombre}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cont-tel">
                      Teléfono <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cont-tel"
                      type="tel"
                      placeholder="+57 318 206 3924"
                      value={form.telefono}
                      onChange={(e) => set('telefono', e.target.value)}
                    />
                    {errors.telefono && <p className="text-xs text-red-600">{errors.telefono}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cont-email">Email (opcional)</Label>
                    <Input
                      id="cont-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Asunto</Label>
                    <Select value={form.asunto} onValueChange={(v) => set('asunto', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="¿En qué te podemos ayudar?" />
                      </SelectTrigger>
                      <SelectContent>
                        {ASUNTOS.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cont-msg">
                      Mensaje <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="cont-msg"
                      rows={5}
                      placeholder="Cuéntanos en qué podemos ayudarte..."
                      value={form.mensaje}
                      onChange={(e) => set('mensaje', e.target.value)}
                    />
                    {errors.mensaje && <p className="text-xs text-red-600">{errors.mensaje}</p>}
                  </div>

                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? 'Enviando...' : 'Enviar mensaje'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
