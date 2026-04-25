import axios from 'axios';
import { getSession } from 'next-auth/react';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Tipos base ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type UserRole = 'ADMIN' | 'AGENT' | 'ASSISTANT';
export type PropertyStatus = 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' | 'ARRENDADO' | 'INACTIVO';
export type PropertyType = 'CASA' | 'APARTAMENTO' | 'LOCAL' | 'OFICINA' | 'LOTE' | 'BODEGA' | 'FINCA';
export type PropertyOperation = 'VENTA' | 'ARRIENDO' | 'VENTA_O_ARRIENDO';
export type ClientStatus =
  | 'NUEVO'
  | 'CONTACTADO'
  | 'CALIFICADO'
  | 'VISITO'
  | 'OFERTO'
  | 'CERRADO'
  | 'PERDIDO';
export type AppointmentStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'REAGENDADA'
  | 'CANCELADA'
  | 'REALIZADA'
  | 'NO_ASISTIO';

export interface Property {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: PropertyType;
  operation: PropertyOperation;
  status: PropertyStatus;
  price: number;
  priceCurrency: string;
  priceNegotiable: boolean;
  administrationFee: number | null;
  areaTotalM2: number | null;
  areaBuiltM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
  parking: number | null;
  floor: number | null;
  totalFloors: number | null;
  ageYears: number | null;
  strata: number | null;
  address: string;
  city: string;
  neighborhood: string | null;
  department: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  videos: string[];
  virtualTourUrl: string | null;
  featured: boolean;
  published: boolean;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerNotes: string | null;
  visitDays: string[];
  visitTimeSlots: { from: string; to: string }[];
  visitSpecialInstructions: string | null;
  assignedAgentId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string;
  preferredType: string[];
  preferredZones: string[];
  preferredOperation: string | null;
  minBedrooms: number | null;
  interestLevel: number;
  interestScore: number | null;
  qualificationNotes: string | null;
  status: ClientStatus;
  lostReason: string | null;
  assignedAgentId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastContactAt: string | null;
}

export interface Appointment {
  id: string;
  clientId: string;
  propertyId: string;
  agentId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  cancellationReason: string | null;
  rescheduledFromId: string | null;
  isSpecialCase: boolean;
  specialCaseNotes: string | null;
  confirmationSent: boolean;
  reminder24hSent: boolean;
  reminder1hSent: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, 'id' | 'name' | 'phone' | 'email'>;
  property?: Pick<Property, 'id' | 'title' | 'address' | 'city'>;
  agent?: { id: string; name: string; phone: string | null };
}

export interface Availability {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  validFrom: string | null;
  validUntil: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  createdAt: string;
}

export interface KpiData {
  inmuebles: { total: number; disponibles: number };
  clientes: { total: number; porStatus: Record<string, number>; calificados: number };
  citas: {
    ultimos30Dias: number;
    realizadas: number;
    canceladas: number;
    tasaAsistencia: number;
  };
  conversaciones: { ultimos30Dias: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: Pick<User, 'id' | 'name' | 'email' | 'role'> }>>(
      '/api/v1/auth/login',
      { email, password }
    ),
  me: () => api.get<ApiResponse<User>>('/api/v1/auth/me'),
};

// ─── Properties ──────────────────────────────────────────────────────────────

export const propertiesApi = {
  getPublic: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<Property[]>>('/api/v1/properties/public', { params }),

  getPublicBySlug: (slug: string) =>
    api.get<ApiResponse<Property>>(`/api/v1/properties/public/${slug}`),

  getAll: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<Property[]>>('/api/v1/properties', { params }),

  getById: (id: string) => api.get<ApiResponse<Property>>(`/api/v1/properties/${id}`),

  create: (data: Partial<Property>) =>
    api.post<ApiResponse<Property>>('/api/v1/properties', data),

  update: (id: string, data: Partial<Property>) =>
    api.put<ApiResponse<Property>>(`/api/v1/properties/${id}`, data),

  updateStatus: (id: string, status: PropertyStatus) =>
    api.patch<ApiResponse<Property>>(`/api/v1/properties/${id}/status`, { status }),

  togglePublish: (id: string) =>
    api.patch<ApiResponse<Property>>(`/api/v1/properties/${id}/publish`),

  archive: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/api/v1/properties/${id}`),
};

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clientsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<Client[]>>('/api/v1/clients', { params }),

  getById: (id: string) => api.get<ApiResponse<Client>>(`/api/v1/clients/${id}`),

  create: (data: Partial<Client>) => api.post<ApiResponse<Client>>('/api/v1/clients', data),

  update: (id: string, data: Partial<Client>) =>
    api.put<ApiResponse<Client>>(`/api/v1/clients/${id}`, data),

  updateInterest: (id: string, interestLevel: number, overrideNote: string) =>
    api.patch<ApiResponse<Client>>(`/api/v1/clients/${id}/interest`, {
      interestLevel,
      overrideNote,
    }),

  archive: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/api/v1/clients/${id}`),
};

// ─── Appointments ─────────────────────────────────────────────────────────────

export const appointmentsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<Appointment[]>>('/api/v1/appointments', { params }),

  getById: (id: string) => api.get<ApiResponse<Appointment>>(`/api/v1/appointments/${id}`),

  create: (data: {
    clientId: string;
    propertyId: string;
    agentId: string;
    scheduledAt: string;
    durationMinutes?: number;
    notes?: string;
    isSpecialCase?: boolean;
    specialCaseNotes?: string;
  }) => api.post<ApiResponse<Appointment>>('/api/v1/appointments', data),

  updateStatus: (id: string, status: AppointmentStatus, cancellationReason?: string) =>
    api.patch<ApiResponse<Appointment>>(`/api/v1/appointments/${id}/status`, {
      status,
      cancellationReason,
    }),

  reschedule: (id: string, scheduledAt: string, agentId?: string, notes?: string) =>
    api.patch<ApiResponse<Appointment>>(`/api/v1/appointments/${id}/reschedule`, {
      scheduledAt,
      agentId,
      notes,
    }),

  cancel: (id: string, reason: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/api/v1/appointments/${id}`, {
      data: { reason },
    }),
};

// ─── Availability ─────────────────────────────────────────────────────────────

export const availabilityApi = {
  getByUser: (userId: string) =>
    api.get<ApiResponse<Availability[]>>(`/api/v1/availability/${userId}`),

  check: (agentId: string, date: string, propertyId?: string) =>
    api.get<
      ApiResponse<{
        available: boolean;
        slots: { startTime: string; endTime: string }[];
        conflicts: unknown[];
      }>
    >('/api/v1/availability/check', { params: { agentId, date, propertyId } }),

  create: (data: Omit<Availability, 'id' | 'createdAt'>) =>
    api.post<ApiResponse<Availability>>('/api/v1/availability', data),

  remove: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/api/v1/availability/${id}`),
};

// ─── Staff ───────────────────────────────────────────────────────────────────

export const staffApi = {
  getAll: (params?: { role?: UserRole; status?: string }) =>
    api.get<ApiResponse<User[]>>('/api/v1/staff', { params }),

  create: (data: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    password: string;
  }) => api.post<ApiResponse<User>>('/api/v1/staff', data),

  update: (id: string, data: { name?: string; phone?: string | null; role?: UserRole }) =>
    api.patch<ApiResponse<User>>(`/api/v1/staff/${id}`, data),

  toggleStatus: (id: string) =>
    api.patch<ApiResponse<User>>(`/api/v1/staff/${id}/status`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getKpis: () => api.get<ApiResponse<KpiData>>('/api/v1/dashboard/kpis'),

  getKpiHistory: (days?: number) =>
    api.get<ApiResponse<unknown[]>>('/api/v1/dashboard/kpis/history', { params: { days } }),
};

export default api;
