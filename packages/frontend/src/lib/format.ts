import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Todas las fechas del sistema se muestran en hora Colombia, sin importar
// desde dónde acceda el usuario al panel.
const TZ = 'America/Bogota';

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatPrice(amount: number, currency: string): string {
  return currency === 'USD' ? formatUSD(amount) : formatCOP(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: es, addSuffix: true });
}

export function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-CO', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('es-CO', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Nivel de interés → color Tailwind
export function interestColor(level: number): string {
  if (level <= 2) return 'bg-red-500';
  if (level === 3) return 'bg-yellow-400';
  if (level === 4) return 'bg-green-400';
  return 'bg-green-600';
}

export function interestTextColor(level: number): string {
  if (level <= 2) return 'text-red-600';
  if (level === 3) return 'text-yellow-600';
  if (level === 4) return 'text-green-600';
  return 'text-green-700';
}

export function interestLabel(level: number): string {
  const labels = ['', 'Sin interés', 'Poco interés', 'Explorando', 'Interesado', 'Muy interesado'];
  return labels[level] ?? 'Desconocido';
}

// Estado de cita → badge color
export function appointmentStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDIENTE:  'bg-yellow-100 text-yellow-800 border-yellow-300',
    CONFIRMADA: 'bg-green-100 text-green-800 border-green-300',
    REAGENDADA: 'bg-blue-100 text-blue-800 border-blue-300',
    CANCELADA:  'bg-red-100 text-red-800 border-red-300',
    REALIZADA:  'bg-emerald-100 text-emerald-800 border-emerald-300',
    NO_ASISTIO: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export function appointmentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    CONFIRMADA: 'Confirmada',
    REAGENDADA: 'Reagendada',
    CANCELADA: 'Cancelada',
    REALIZADA: 'Realizada',
    NO_ASISTIO: 'No asistió',
  };
  return map[status] ?? status;
}

// Estado de inmueble → badge color
export function propertyStatusColor(status: string): string {
  const map: Record<string, string> = {
    DISPONIBLE: 'bg-green-100 text-green-800',
    RESERVADO: 'bg-yellow-100 text-yellow-800',
    VENDIDO: 'bg-gray-100 text-gray-700',
    ARRENDADO: 'bg-blue-100 text-blue-800',
    INACTIVO: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function propertyStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DISPONIBLE: 'Disponible',
    RESERVADO: 'Reservado',
    VENDIDO: 'Vendido',
    ARRENDADO: 'Arrendado',
    INACTIVO: 'Inactivo',
  };
  return map[status] ?? status;
}

// Estado CRM → badge color
export function clientStatusColor(status: string): string {
  const map: Record<string, string> = {
    NUEVO: 'bg-blue-100 text-blue-800',
    CONTACTADO: 'bg-indigo-100 text-indigo-800',
    CALIFICADO: 'bg-purple-100 text-purple-800',
    VISITO: 'bg-orange-100 text-orange-800',
    OFERTO: 'bg-yellow-100 text-yellow-800',
    CERRADO: 'bg-green-100 text-green-800',
    PERDIDO: 'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function clientStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NUEVO: 'Nuevo',
    CONTACTADO: 'Contactado',
    CALIFICADO: 'Calificado',
    VISITO: 'Visitó',
    OFERTO: 'Ofertó',
    CERRADO: 'Cerrado',
    PERDIDO: 'Perdido',
  };
  return map[status] ?? status;
}

// Tipo de inmueble
export function propertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CASA: 'Casa',
    APARTAMENTO: 'Apartamento',
    LOCAL: 'Local comercial',
    OFICINA: 'Oficina',
    LOTE: 'Lote',
    BODEGA: 'Bodega',
    FINCA: 'Finca',
  };
  return map[type] ?? type;
}

export function propertyOperationLabel(op: string): string {
  const map: Record<string, string> = {
    VENTA: 'Venta',
    ARRIENDO: 'Arriendo',
    VENTA_O_ARRIENDO: 'Venta o Arriendo',
  };
  return map[op] ?? op;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function formatArea(m2: number): string {
  return `${m2.toLocaleString('es-CO')} m²`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}
