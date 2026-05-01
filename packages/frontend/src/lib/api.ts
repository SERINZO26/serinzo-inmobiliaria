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

// ─── Tipos de Contratos ───────────────────────────────────────────────────────

export type RentalContractStatus = 'BORRADOR' | 'ACTIVO' | 'RENOVADO' | 'VENCIDO' | 'CANCELADO';
export type PaymentStatus = 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'PARCIAL';
export type SaleStatus = 'BORRADOR' | 'EN_PROCESO' | 'FIRMADO' | 'REGISTRADO' | 'CANCELADO';

export interface RentalContract {
  id: string;
  propertyId: string;
  clientId: string;
  agentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  rentCurrency: string;
  adminFee: number | null;
  depositAmount: number | null;
  depositCurrency: string;
  depositReturned: boolean;
  commissionPct: number | null;
  status: RentalContractStatus;
  pdfUrl: string | null;
  notes: string | null;
  lastAlertSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntilExpiry?: number;
  property?: { id: string; title: string; address: string; city: string; photos: string[] };
  client?: { id: string; name: string; phone: string | null; email: string | null };
  agent?: { id: string; name: string };
  payments?: RentalPayment[];
}

export interface RentalPayment {
  id: string;
  contractId: string;
  periodNumber: number;
  dueDate: string;
  paidAt: string | null;
  amount: number;
  ownerPayment: number | null;
  commission: number | null;
  repairAmount: number | null;
  repairDescription: string | null;
  status: PaymentStatus;
  estadoEfectivo?: PaymentStatus;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  total: number;
  totalMonto: number;
  pagados: number;
  montoPagado: number;
  pendientes: number;
  montoPendiente: number;
  vencidos: number;
  montoVencido: number;
  parciales: number;
  montoParcial: number;
  totalPropietario: number;
  totalComision: number;
  proximaCuota: RentalPayment | null;
}

export interface SaleContract {
  id: string;
  propertyId: string;
  clientId: string;
  agentId: string;
  salePrice: number;
  saleCurrency: string;
  commissionPct: number | null;
  commissionAmount: number | null;
  promiseDate: string | null;
  signDate: string | null;
  registrationDate: string | null;
  status: SaleStatus;
  pdfUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  property?: { id: string; title: string; address: string; city: string; photos: string[] };
  client?: { id: string; name: string; phone: string | null; email: string | null };
  agent?: { id: string; name: string };
}

export type ConversationChannel = 'VOZ' | 'WHATSAPP' | 'WEB';
export type ConversationOutcome =
  | 'calificado'
  | 'cita_agendada'
  | 'sin_interes'
  | 'no_responde'
  | 'caso_especial'
  | 'seguimiento';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intentDetected: string | null;
}

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  summary: string | null;
  interestDetected: number | null;
  interestOverride: number | null;
  topics: string[];
  outcome: ConversationOutcome | null;
  recordingUrl: string | null;
  client: { id: string; name: string; phone: string } | null;
  turns?: ConversationTurn[];
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

// ─── Property Photos ─────────────────────────────────────────────────────────

export const photosApi = {
  upload: (propertyId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    return api.post<ApiResponse<{ photos: string[]; added: string[] }>>(
      `/api/v1/properties/${propertyId}/photos`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  delete: (propertyId: string, photoUrl: string) =>
    api.delete<ApiResponse<{ photos: string[] }>>(
      `/api/v1/properties/${propertyId}/photos`,
      { data: { photoUrl } },
    ),
};

// ─── Rental Contracts ─────────────────────────────────────────────────────────

export const rentalApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<RentalContract[]>>('/api/v1/contracts/arriendos', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<RentalContract>>(`/api/v1/contracts/arriendos/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<RentalContract>>('/api/v1/contracts/arriendos', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<RentalContract>>(`/api/v1/contracts/arriendos/${id}`, data),

  renew: (id: string, data: { newEndDate: string; monthlyRent?: number; commissionPct?: number; notes?: string }) =>
    api.post<ApiResponse<RentalContract>>(`/api/v1/contracts/arriendos/${id}/renew`, data),

  cancel: (id: string, notes?: string) =>
    api.patch<ApiResponse<{ message: string }>>(`/api/v1/contracts/arriendos/${id}/cancel`, { notes }),

  getAlerts: (weeks?: number) =>
    api.get<ApiResponse<RentalContract[]>>('/api/v1/contracts/arriendos/alerts', { params: { weeks } }),

  // Pagos PENDIENTE con dueDate ≤ hoy + 10 días (badge sidebar y KPI)
  getPendingPayments: () =>
    api.get<ApiResponse<{ count: number; payments: Array<{
      id: string; contractId: string; periodNumber: number;
      dueDate: string; amount: number; ownerPayment: number | null;
      propertyTitle: string; agentName: string;
    }> }>>('/api/v1/contracts/arriendos/pending-payments'),
};

// ─── Rental Payments ─────────────────────────────────────────────────────────

export const paymentsApi = {
  getAll: (contractId: string) =>
    api.get<ApiResponse<RentalPayment[]>>(`/api/v1/contracts/arriendos/${contractId}/pagos`),

  getById: (contractId: string, paymentId: string) =>
    api.get<ApiResponse<RentalPayment>>(`/api/v1/contracts/arriendos/${contractId}/pagos/${paymentId}`),

  update: (contractId: string, paymentId: string, data: Record<string, unknown>) =>
    api.patch<ApiResponse<RentalPayment>>(
      `/api/v1/contracts/arriendos/${contractId}/pagos/${paymentId}`,
      data,
    ),

  markPaid: (contractId: string, paymentId: string, formData: FormData) =>
    api.patch<ApiResponse<RentalPayment>>(
      `/api/v1/contracts/arriendos/${contractId}/pagos/${paymentId}/pagar`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  getSummary: (contractId: string) =>
    api.get<ApiResponse<PaymentSummary>>(`/api/v1/contracts/arriendos/${contractId}/pagos/resumen`),
};

// ─── Sale Contracts ───────────────────────────────────────────────────────────

export const saleApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<SaleContract[]>>('/api/v1/contracts/ventas', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<SaleContract>>(`/api/v1/contracts/ventas/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<SaleContract>>('/api/v1/contracts/ventas', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<SaleContract>>(`/api/v1/contracts/ventas/${id}`, data),

  uploadPdf: (id: string, file: File) => {
    const form = new FormData();
    form.append('documento', file);
    return api.patch<ApiResponse<{ id: string; pdfUrl: string; status: SaleStatus }>>(
      `/api/v1/contracts/ventas/${id}/pdf`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  updateStatus: (id: string, status: SaleStatus, notes?: string) =>
    api.patch<ApiResponse<{ id: string; status: SaleStatus; notes?: string }>>(
      `/api/v1/contracts/ventas/${id}/estado`,
      { status, notes },
    ),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export interface Settings {
  id: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
  companyCity: string | null;
  companyLogoUrl: string | null;
  agentName: string;
  agentTone: string;
  agentWelcome: string | null;
  notifyNewClient: boolean;
  notifyHighInterest: boolean;
  notifyAppointment: boolean;
  notifyAppointmentReminder: boolean;
  createdAt: string;
  updatedAt: string;
}

export const settingsApi = {
  get: () =>
    api.get<ApiResponse<Settings>>('/api/v1/settings'),

  update: (data: Partial<Omit<Settings, 'id' | 'companyLogoUrl' | 'createdAt' | 'updatedAt'>>) =>
    api.put<ApiResponse<Settings>>('/api/v1/settings', data),

  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return api.patch<ApiResponse<Settings>>(
      '/api/v1/settings/logo',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
};

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversationsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<ApiResponse<Conversation[]>>('/api/v1/conversations', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Conversation>>(`/api/v1/conversations/${id}`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getKpis: () => api.get<ApiResponse<KpiData>>('/api/v1/dashboard/kpis'),

  getKpiHistory: (days?: number) =>
    api.get<ApiResponse<unknown[]>>('/api/v1/dashboard/kpis/history', { params: { days } }),
};

export default api;
