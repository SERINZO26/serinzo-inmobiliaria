/**
 * handlers.ts — Implementaciones de las tools del agente Sofía.
 *
 * Cada función recibe el input validado por Anthropic y accede a la BD vía Prisma.
 *
 * REGLA CRÍTICA: ningún handler puede devolver owner_name, owner_phone, owner_email
 * ni owner_notes. Esos campos son estrictamente privados (regla de negocio #1).
 */

import { prisma } from '../../lib/prisma';
import { sendWhatsAppMedia } from '../../services/messaging';
import type { ToolHandler } from '../shared/base-agent';

// ─── Selector seguro de inmueble (excluye datos del propietario) ──────────────

const PUBLIC_PROPERTY_SELECT = {
  id: true, title: true, slug: true, type: true, operation: true,
  price: true, priceCurrency: true, priceNegotiable: true, administrationFee: true,
  areaTotalM2: true, areaBuiltM2: true,
  bedrooms: true, bathrooms: true, halfBathrooms: true, parking: true,
  floor: true, totalFloors: true, ageYears: true, strata: true,
  address: true, city: true, neighborhood: true, department: true, lat: true, lng: true,
  photos: true, videos: true, virtualTourUrl: true,
  status: true, featured: true,
  description: true,
  visitDays: true, visitTimeSlots: true, visitSpecialInstructions: true,
  assignedAgentId: true,
  features: { select: { category: true, name: true, value: true } },
  // owner_* → NUNCA incluir
} as const;

// ─── search_properties ────────────────────────────────────────────────────────

export const handleSearchProperties: ToolHandler = async (input) => {
  const {
    operation, type, city, neighborhood, zones,
    budget_max, budget_min, min_bedrooms, min_bathrooms,
  } = input as {
    operation?: string; type?: string; city?: string;
    neighborhood?: string; zones?: string[];
    budget_max?: number | string; budget_min?: number | string;
    min_bedrooms?: number; min_bathrooms?: number;
  };

  console.log('==========================================');
  console.log('SEARCH_PROPERTIES LLAMADO');
  console.log('Params:', JSON.stringify({
    operation, type, city, neighborhood, zones,
    budget_max, budget_min, min_bedrooms, min_bathrooms,
  }, null, 2));

  // ── DIAGNÓSTICO: cuántos inmuebles hay publicados en total (sin filtros de búsqueda)
  const totalPublicados = await prisma.property.count({
    where: { published: true, archived: false },
  });
  console.log('Total inmuebles publicados en BD (sin filtros):', totalPublicados);

  // ── DIAGNÓSTICO: dump de TODOS los inmuebles publicados para comparar con filtros
  const todosPublicados = await prisma.property.findMany({
    where: { published: true, archived: false },
    select: {
      title: true, neighborhood: true, city: true,
      price: true, operation: true, status: true, type: true,
    },
    take: 20,
  });
  console.log('Inmuebles publicados en BD:');
  todosPublicados.forEach((p) => {
    console.log(`  - "${p.title}" | barrio:"${p.neighborhood}" | ciudad:"${p.city}" | precio:${Number(p.price)} | op:${p.operation} | status:${p.status} | tipo:${p.type}`);
  });

  // Siempre filtrar solo publicados y disponibles
  const where: Record<string, unknown> = {
    status: 'DISPONIBLE',
    published: true,
    archived: false,
  };

  // Operación: normalizar case e incluir VENTA_O_ARRIENDO según corresponda.
  // CRÍTICO: inmuebles en arriendo pueden tener operation=VENTA_O_ARRIENDO.
  if (operation) {
    const op = operation.toUpperCase();
    if (op === 'ARRIENDO') {
      where.operation = { in: ['ARRIENDO', 'VENTA_O_ARRIENDO'] };
    } else if (op === 'VENTA') {
      where.operation = { in: ['VENTA', 'VENTA_O_ARRIENDO'] };
    } else {
      where.operation = op;
    }
    console.log('Filtro operation:', where.operation);
  }

  // Tipo: normalizar case y mapear apartaestudio → APARTAMENTO.
  if (type) {
    const tipoNorm = type.toUpperCase()
      .replace('APARTAESTUDIO', 'APARTAMENTO')
      .replace('ESTUDIO', 'APARTAMENTO');
    where.type = tipoNorm;
    console.log('Filtro tipo:', tipoNorm);
  }

  // Normalizar zones: el modelo puede enviarla como string o como array.
  // Siempre trabajar con un array para el resto de la lógica.
  const rawZones = zones as string | string[] | undefined;
  const zonesNorm: string[] = Array.isArray(rawZones)
    ? rawZones
    : rawZones
    ? [rawZones]
    : [];

  console.log('zonesArray construido:', JSON.stringify(zonesNorm));
  console.log('neighborhood recibido:', neighborhood);

  // Zonas activas: zones[] tiene prioridad sobre neighborhood.
  const activeZones = zonesNorm.length > 0 ? zonesNorm : (neighborhood ? [neighborhood] : []);

  // CRÍTICO: si hay zonas específicas, filtrar SOLO por esas zonas usando AND.
  // Usar OR a nivel raíz causaba que resultados de otras zonas se colaran.
  // La estructura AND([OR(zonas en neighborhood|address)][, city]) garantiza
  // que TODOS los resultados pertenezcan a alguna de las zonas pedidas.
  if (activeZones.length > 0) {
    const zonaOR = {
      OR: activeZones.flatMap((zone) => [
        { neighborhood: { contains: zone, mode: 'insensitive' as const } },
        { address:      { contains: zone, mode: 'insensitive' as const } },
      ]),
    };
    where.AND = city
      ? [zonaOR, { city: { contains: city, mode: 'insensitive' as const } }]
      : [zonaOR];
    console.log('Filtro zonas (AND+OR):', activeZones, city ? `ciudad: ${city}` : '');
  } else if (city) {
    // Solo ciudad, sin zona específica — buscar en toda la ciudad
    where.city = { contains: city, mode: 'insensitive' as const };
    console.log('Filtro ciudad (sin zona):', city);
  }

  // Solo filtrar habitaciones si el cliente lo especificó. Para apartaestudio min_bedrooms=0.
  if (min_bedrooms != null && min_bedrooms > 0) {
    where.bedrooms = { gte: min_bedrooms };
    console.log('Filtro habitaciones mínimas:', min_bedrooms);
  }
  if (min_bathrooms != null && min_bathrooms > 0) {
    where.bathrooms = { gte: min_bathrooms };
    console.log('Filtro baños mínimos:', min_bathrooms);
  }

  // Presupuesto: parsear si viene como string con puntos (formato colombiano "2.800.000")
  const parseBudget = (val: number | string | undefined): number | undefined => {
    if (val == null) return undefined;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
    return isNaN(parsed) ? undefined : parsed;
  };

  const parsedMin = parseBudget(budget_min);
  const parsedMax = parseBudget(budget_max);

  if (parsedMin || parsedMax) {
    where.price = {
      ...(parsedMin ? { gte: parsedMin } : {}),
      ...(parsedMax ? { lte: parsedMax } : {}),
    };
    console.log('Filtro precio:', where.price);
  }

  console.log('WHERE con zonas (FINAL):', JSON.stringify(where, null, 2));

  const properties = await prisma.property.findMany({
    where: where as any,
    select: PUBLIC_PROPERTY_SELECT,
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: 5,
  });

  console.log(`Resultados encontrados: ${properties.length}`);
  console.log('Inmuebles:', properties.map(p => ({
    title: p.title,
    city: p.city,
    neighborhood: p.neighborhood,
    price: Number(p.price),
    operation: p.operation,
    status: p.status,
  })));
  console.log('=== FIN BÚSQUEDA ===');

  return {
    count: properties.length,
    properties: properties.map(p => ({
      id: p.id, title: p.title, type: p.type, operation: p.operation,
      price: p.price, priceCurrency: p.priceCurrency, priceNegotiable: p.priceNegotiable,
      areaTotalM2: p.areaTotalM2, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
      city: p.city, neighborhood: p.neighborhood, address: p.address,
      photos: p.photos.slice(0, 1),
      strata: p.strata, parking: p.parking, floor: p.floor,
    })),
  };
};

// ─── get_property_detail ──────────────────────────────────────────────────────

export const handleGetPropertyDetail: ToolHandler = async (input) => {
  const { property_id } = input as { property_id: string };

  const property = await prisma.property.findUnique({
    where: { id: property_id },
    select: PUBLIC_PROPERTY_SELECT,
  });

  if (!property) return { error: 'Inmueble no encontrado' };

  return property;
};

// ─── send_property_media ──────────────────────────────────────────────────────

export const handleSendPropertyMedia: ToolHandler = async (input) => {
  const { client_phone, property_id } = input as { client_phone: string; property_id: string };

  console.log('=== SEND_PROPERTY_MEDIA ===');
  console.log('Params recibidos:', JSON.stringify(input, null, 2));
  console.log('client_phone:', client_phone);
  console.log('property_id:', property_id);

  const property = await prisma.property.findUnique({
    where: { id: property_id },
    select: { id: true, title: true, photos: true },
  });

  console.log('Inmueble encontrado:', property ? `"${property.title}" (id: ${property.id})` : 'NO ENCONTRADO');
  console.log('Fotos en BD:', property?.photos ?? []);

  if (!property) return { error: 'Inmueble no encontrado' };

  // Validar que existan fotos
  const allPhotos = property.photos ?? [];
  if (allPhotos.length === 0) {
    return { success: false, sent: 0, message: 'Este inmueble aún no tiene fotos cargadas en el sistema.' };
  }

  // Filtrar URLs válidas: deben ser https:// y no placeholders/ejemplos
  const validPhotos = allPhotos
    .filter((url) =>
      url &&
      url.startsWith('https://') &&
      !url.includes('placeholder') &&
      !url.includes('example') &&
      !url.includes('unsplash') &&
      !url.includes('picsum') &&
      !url.includes('loremflickr'),
    )
    .slice(0, 3); // máximo 3 fotos para no saturar

  if (validPhotos.length === 0) {
    return {
      success: false,
      sent: 0,
      message: 'Las fotos de este inmueble están siendo procesadas y no están disponibles aún.',
    };
  }

  let sent = 0;
  for (const photoUrl of validPhotos) {
    try {
      await sendWhatsAppMedia(
        client_phone,
        sent === 0 ? `📸 Fotos de: ${property.title}` : '',
        photoUrl,
      );
      sent++;
      // Pausa entre mensajes para no saturar Twilio
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`[handlers] Error enviando foto ${photoUrl}:`, err);
    }
  }

  if (sent === 0) {
    return { success: false, sent: 0, message: 'No se pudieron enviar las fotos. Intenta de nuevo en un momento.' };
  }

  return { success: true, sent, total: allPhotos.length, message: `Se enviaron ${sent} foto(s) correctamente.` };
};

// ─── check_availability ───────────────────────────────────────────────────────

export const handleCheckAvailability: ToolHandler = async (input) => {
  console.log('Fecha actual servidor:', new Date());
  const { property_id, preferred_dates } = input as {
    property_id: string;
    preferred_dates?: string[];
  };

  const property = await prisma.property.findUnique({
    where: { id: property_id },
    select: {
      visitDays: true,
      visitTimeSlots: true,
      visitSpecialInstructions: true,
      assignedAgentId: true,
    },
  });

  if (!property) return { error: 'Inmueble no encontrado' };

  // Franjas del inmueble
  const visitSlots = property.visitTimeSlots as { from: string; to: string }[] ?? [];

  // Disponibilidad del agente asignado (próximas 2 semanas)
  let agentSlots: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
  if (property.assignedAgentId) {
    const avail = await prisma.availability.findMany({
      where: {
        userId: property.assignedAgentId,
        isBlocked: false,
      },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    });
    agentSlots = avail;
  }

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  return {
    available: visitSlots.length > 0,
    visit_days: property.visitDays,
    visit_slots: visitSlots,
    special_instructions: property.visitSpecialInstructions,
    agent_days: agentSlots.map(s => ({
      day: dayNames[s.dayOfWeek],
      from: s.startTime,
      to: s.endTime,
    })),
    preferred_dates_checked: preferred_dates ?? [],
    note: visitSlots.length === 0
      ? 'Este inmueble no tiene horarios configurados. Deberás marcar caso especial.'
      : 'Confirma con el cliente qué día y hora le queda mejor dentro de las franjas disponibles.',
  };
};

// ─── Helpers de zona horaria Colombia (UTC-5) ─────────────────────────────────
// El servidor corre en UTC. Cuando el agente recibe "4:30pm" del cliente,
// construye "2026-05-07T16:30:00" sin offset → JS lo interpreta como UTC
// y se guarda 5 horas adelantado. Este helper corrige el offset.

function toColombiaUTC(scheduledAt: string): Date {
  // Si ya tiene offset explícito (Z, +HH:MM, -HH:MM), respetar tal cual
  if (scheduledAt.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(scheduledAt)) {
    return new Date(scheduledAt);
  }
  // Sin offset → interpretar como hora Colombia (UTC-5): agregar -05:00
  return new Date(scheduledAt + '-05:00');
}

function formatColombia(date: Date): string {
  return date.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── schedule_appointment ─────────────────────────────────────────────────────

export const handleScheduleAppointment: ToolHandler = async (input) => {
  console.log('Fecha actual servidor:', new Date());
  const { client_id, property_id, scheduled_at, notes } = input as {
    client_id: string; property_id: string; scheduled_at: string; notes?: string;
  };

  // Convertir hora Colombia → UTC antes de guardar en BD
  const scheduledDate = toColombiaUTC(scheduled_at);
  console.log(`[schedule] Input: "${scheduled_at}" → UTC: ${scheduledDate.toISOString()}`);

  // Verificar que el agente asignado exista
  const property = await prisma.property.findUnique({
    where: { id: property_id },
    select: { assignedAgentId: true, title: true },
  });
  if (!property) return { error: 'Inmueble no encontrado' };
  if (!property.assignedAgentId) return { error: 'Este inmueble no tiene agente asignado' };

  const appointment = await prisma.appointment.create({
    data: {
      clientId:    client_id,
      propertyId:  property_id,
      agentId:     property.assignedAgentId,
      scheduledAt: scheduledDate,
      status:      'PENDIENTE',
      notes:       notes ?? null,
    },
    select: { id: true, scheduledAt: true, status: true },
  });

  return {
    success: true,
    appointment_id: appointment.id,
    scheduled_at:   appointment.scheduledAt.toISOString(),
    status:         appointment.status,
    message: `Cita agendada para el ${formatColombia(appointment.scheduledAt)}`,
  };
};

// ─── reschedule_appointment ───────────────────────────────────────────────────

export const handleRescheduleAppointment: ToolHandler = async (input) => {
  const { appointment_id, new_scheduled_at, reason } = input as {
    appointment_id: string; new_scheduled_at: string; reason?: string;
  };

  const newDate = toColombiaUTC(new_scheduled_at);
  console.log(`[reschedule] Input: "${new_scheduled_at}" → UTC: ${newDate.toISOString()}`);

  const updated = await prisma.appointment.update({
    where: { id: appointment_id },
    data: {
      scheduledAt: newDate,
      status:      'REAGENDADA',
      notes:       reason ?? null,
    },
    select: { id: true, scheduledAt: true },
  });

  return {
    success: true,
    appointment_id:   updated.id,
    new_scheduled_at: updated.scheduledAt.toISOString(),
    message: `Cita reagendada para el ${formatColombia(updated.scheduledAt)}`,
  };
};

// ─── cancel_appointment ───────────────────────────────────────────────────────

export const handleCancelAppointment: ToolHandler = async (input) => {
  const { appointment_id, reason } = input as { appointment_id: string; reason: string };

  await prisma.appointment.update({
    where: { id: appointment_id },
    data: { status: 'CANCELADA', cancellationReason: reason },
  });

  return { success: true, message: 'Cita cancelada correctamente' };
};

// ─── find_appointment ─────────────────────────────────────────────────────────
// Permite a Sofía buscar una cita por datos que el cliente conoce (nombre,
// teléfono, inmueble, fecha) sin necesitar el ID técnico de la cita.
// Busca en TODOS los estados excepto CANCELADA (incluye PENDIENTE, CONFIRMADA,
// REAGENDADA, NO_ASISTIO) para que el cliente pueda reagendar cualquier cita activa.

export const handleFindAppointment: ToolHandler = async (input) => {
  const { client_name, client_phone, property_name, approximate_date } = input as {
    client_name?: string;
    client_phone?: string;
    property_name?: string;
    approximate_date?: string;
  };

  console.log('=== BUSCANDO CITA ===');
  console.log('Parámetros:', JSON.stringify({ client_name, client_phone, property_name, approximate_date }, null, 2));

  // Incluir PENDIENTE, CONFIRMADA, REAGENDADA, NO_ASISTIO — excluir solo CANCELADA
  const where: Record<string, unknown> = {
    status: { notIn: ['CANCELADA'] },
  };

  // Buscar por nombre: buscar nombre completo Y también solo el primer nombre
  // para tolerar que el cliente diga "Jorge" en lugar de "Jorge Montana"
  if (client_name) {
    const primerNombre = client_name.trim().split(' ')[0];
    where.client = {
      OR: [
        { name: { contains: client_name.trim(), mode: 'insensitive' as const } },
        { name: { contains: primerNombre,        mode: 'insensitive' as const } },
      ],
    };
  }

  // Buscar por teléfono — últimos 7 dígitos para tolerar formatos distintos
  if (client_phone) {
    const digits = client_phone.replace(/\D/g, '').slice(-7);
    if (digits.length >= 7) {
      where.client = {
        ...(where.client as object ?? {}),
        phone: { contains: digits },
      };
    }
  }

  // Buscar por inmueble: en título, barrio o ciudad
  if (property_name) {
    where.property = {
      OR: [
        { title:        { contains: property_name, mode: 'insensitive' as const } },
        { neighborhood: { contains: property_name, mode: 'insensitive' as const } },
        { city:         { contains: property_name, mode: 'insensitive' as const } },
      ],
    };
  }

  // Buscar por fecha aproximada en hora Colombia (UTC-5).
  // 00:00 Colombia = 05:00 UTC; 23:59 Colombia = 04:59 UTC del día siguiente.
  if (approximate_date) {
    const today = new Date();
    let targetDate: Date;

    if (approximate_date === 'hoy') {
      targetDate = new Date(today);
    } else if (approximate_date === 'mañana' || approximate_date === 'manana') {
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + 1);
    } else {
      targetDate = new Date(approximate_date);
    }

    // Rango completo del día en hora Colombia expresado en UTC
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(5, 0, 0, 0);        // 00:00 Colombia → 05:00 UTC

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(28, 59, 59, 999);      // 23:59 Colombia → 04:59 UTC día siguiente

    where.scheduledAt = { gte: startOfDay, lte: endOfDay };
    console.log(`Filtro fecha: ${startOfDay.toISOString()} → ${endOfDay.toISOString()}`);
  }

  const appointments = await prisma.appointment.findMany({
    where: where as any,
    include: {
      client:   { select: { id: true, name: true, phone: true } },
      property: { select: { id: true, title: true, city: true, neighborhood: true } },
      agent:    { select: { name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
  });

  console.log('Citas encontradas:', appointments.length);
  console.log('Detalle:', appointments.map((a) => ({
    cliente:  a.client.name,
    inmueble: a.property.title,
    fecha:    a.scheduledAt.toISOString(),
    status:   a.status,
  })));
  console.log('=== FIN BÚSQUEDA CITA ===');

  if (appointments.length === 0) {
    return {
      found: false,
      message: 'No encontré citas con esos datos. Puedes intentar con otro nombre, el nombre del inmueble o la fecha.',
    };
  }

  return {
    found: true,
    count: appointments.length,
    appointments: appointments.map((a) => ({
      id:       a.id,
      client:   a.client.name,
      property: `${a.property.title} (${a.property.neighborhood ?? a.property.city})`,
      date:     formatColombia(a.scheduledAt),
      date_iso: a.scheduledAt.toISOString(),
      status:   a.status,
      agent:    a.agent.name,
    })),
  };
};

// ─── flag_special_case ────────────────────────────────────────────────────────

export const handleFlagSpecialCase: ToolHandler = async (input) => {
  const { client_id, property_id, client_notes } = input as {
    client_id: string; property_id: string; client_notes: string;
  };

  // Crear cita como caso especial sin fecha definida (fecha tentativa en 7 días)
  const property = await prisma.property.findUnique({
    where: { id: property_id },
    select: { assignedAgentId: true },
  });
  if (!property?.assignedAgentId) return { error: 'Inmueble sin agente asignado' };

  await prisma.appointment.create({
    data: {
      clientId:         client_id,
      propertyId:       property_id,
      agentId:          property.assignedAgentId,
      scheduledAt:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // placeholder
      status:           'PENDIENTE',
      isSpecialCase:    true,
      specialCaseNotes: client_notes,
    },
  });

  return {
    success: true,
    message: 'Caso especial registrado. Un asesor humano se contactará pronto para coordinar.',
  };
};

// ─── save_client ──────────────────────────────────────────────────────────────

export const handleSaveClient: ToolHandler = async (input) => {
  const {
    name, phone, email, budget_min, budget_max, preferred_operation,
    preferred_zones, preferred_type, min_bedrooms, additional_requirements,
  } = input as {
    name: string; phone: string; email?: string;
    budget_min?: number; budget_max?: number;
    preferred_operation?: string; preferred_zones?: string[];
    preferred_type?: string[]; min_bedrooms?: number;
    additional_requirements?: string;
  };

  // Normalizar teléfono — acepta cualquier formato, sin validación estricta
  // Un agente humano puede corregirlo desde el panel si es necesario
  const normalizedPhone = phone.replace(/[^\d+]/g, '') || phone;

  try {
    // Buscar si ya existe por teléfono (últimos 10 dígitos para tolerancia de formato)
    const searchDigits = normalizedPhone.replace(/\D/g, '').slice(-10);
    const existing = searchDigits.length >= 7
      ? await prisma.client.findFirst({
          where: { phone: { contains: searchDigits } },
          select: { id: true },
        })
      : null;

    if (existing) {
      // Actualizar datos existentes
      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: {
          name,
          ...(email               ? { email }                                          : {}),
          ...(budget_min          ? { budgetMin: budget_min }                          : {}),
          ...(budget_max          ? { budgetMax: budget_max }                          : {}),
          ...(preferred_operation ? { preferredOperation: preferred_operation as any } : {}),
          ...(preferred_zones     ? { preferredZones: preferred_zones }                : {}),
          ...(preferred_type      ? { preferredType: preferred_type }                  : {}),
          ...(min_bedrooms        ? { minBedrooms: min_bedrooms }                      : {}),
          ...(additional_requirements ? { additionalRequirements: additional_requirements } : {}),
          lastContactAt: new Date(),
        },
        select: { id: true, name: true },
      });
      return { success: true, client_id: updated.id, created: false, name: updated.name };
    }

    // Crear nuevo cliente — guardamos el teléfono tal como lo dio el cliente
    const created = await prisma.client.create({
      data: {
        name,
        phone:              normalizedPhone,
        email:              email ?? null,
        source:             'WHATSAPP',
        status:             'NUEVO',
        budgetMin:          budget_min ?? null,
        budgetMax:          budget_max ?? null,
        budgetCurrency:     'COP',
        preferredOperation: (preferred_operation as any) ?? null,
        preferredZones:     preferred_zones ?? [],
        preferredType:      preferred_type ?? [],
        minBedrooms:        min_bedrooms ?? null,
        additionalRequirements: additional_requirements ?? null,
        interestLevel:      3,
        lastContactAt:      new Date(),
      },
      select: { id: true, name: true },
    });

    return { success: true, client_id: created.id, created: true, name: created.name };

  } catch (err) {
    // El fallo al guardar el cliente NO debe interrumpir la conversación
    console.error('[handlers] Error guardando cliente:', err);
    return {
      success: false,
      client_id: null,
      message: 'El registro del cliente no se completó, pero puedes continuar la conversación. Un agente lo registrará manualmente.',
    };
  }
};

// ─── update_client_interest ───────────────────────────────────────────────────

export const handleUpdateClientInterest: ToolHandler = async (input) => {
  const { client_id, interest_level, notes } = input as {
    client_id: string; interest_level: number; notes?: string;
  };

  await prisma.client.update({
    where: { id: client_id },
    data: {
      interestLevel: interest_level,
      qualificationNotes: notes ?? null,
      lastContactAt: new Date(),
    },
  });

  return { success: true, interest_level };
};

// ─── get_client_history ───────────────────────────────────────────────────────

export const handleGetClientHistory: ToolHandler = async (input) => {
  const { client_id } = input as { client_id: string };

  const client = await prisma.client.findUnique({
    where: { id: client_id },
    select: {
      id: true, name: true, status: true, interestLevel: true,
      preferredOperation: true, preferredZones: true, preferredType: true,
      budgetMin: true, budgetMax: true,
      appointments: {
        select: { id: true, scheduledAt: true, status: true },
        orderBy: { scheduledAt: 'desc' },
        take: 3,
      },
      conversations: {
        select: { id: true, summary: true, outcome: true, startedAt: true },
        orderBy: { startedAt: 'desc' },
        take: 3,
      },
    },
  });

  if (!client) return { error: 'Cliente no encontrado' };
  return client;
};

// ─── log_conversation_summary ─────────────────────────────────────────────────
//
// Este handler acepta un segundo argumento opcional `conversationId`.
// Si existe, ACTUALIZA el registro ya creado al inicio de la sesión.
// Si no existe (caso extremo), crea uno nuevo como fallback.
// Se exporta como función directa (no ToolHandler) para que index.ts
// pueda inyectar el conversationId desde el contexto de la sesión.

export async function handleLogConversationSummary(
  input: unknown,
  conversationId?: string | null,
): Promise<unknown> {
  const { client_id, summary, interest_level, outcome, topics } = input as {
    client_id?: string; summary: string; interest_level: number;
    outcome: string; topics?: string[];
  };

  const now = new Date();

  if (conversationId) {
    // Actualizar el registro existente creado al inicio de la sesión
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        clientId:         client_id ?? undefined,
        endedAt:          now,
        summary,
        interestDetected: interest_level,
        topics:           topics ?? [],
        outcome:          outcome as any,
      },
    });
  } else {
    // Fallback: crear conversación si por algún motivo no existía el ID
    await prisma.conversation.create({
      data: {
        clientId:         client_id ?? null,
        channel:          'WHATSAPP',
        startedAt:        now,
        endedAt:          now,
        summary,
        interestDetected: interest_level,
        topics:           topics ?? [],
        outcome:          outcome as any,
      },
    });
  }

  // Actualizar nivel de interés del cliente si fue identificado
  if (client_id) {
    await prisma.client.update({
      where: { id: client_id },
      data: { interestLevel: interest_level, lastContactAt: now },
    });
  }

  return { success: true, logged: true, client_id: client_id ?? null };
}

// ─── Mapa de handlers para inyectar en el agente ─────────────────────────────

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_properties:      handleSearchProperties,
  get_property_detail:    handleGetPropertyDetail,
  send_property_media:    handleSendPropertyMedia,
  check_availability:     handleCheckAvailability,
  find_appointment:       handleFindAppointment,
  schedule_appointment:   handleScheduleAppointment,
  reschedule_appointment: handleRescheduleAppointment,
  cancel_appointment:     handleCancelAppointment,
  flag_special_case:      handleFlagSpecialCase,
  save_client:            handleSaveClient,
  update_client_interest: handleUpdateClientInterest,
  get_client_history:     handleGetClientHistory,
  // log_conversation_summary se inyecta en index.ts con el conversationId del contexto
  log_conversation_summary: (input) => handleLogConversationSummary(input, null),
};
