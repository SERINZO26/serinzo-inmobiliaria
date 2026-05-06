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
  const { operation, type, city, neighborhood, budget_max, budget_min, min_bedrooms, min_bathrooms } = input as {
    operation?: string; type?: string; city?: string; neighborhood?: string;
    budget_max?: number; budget_min?: number; min_bedrooms?: number; min_bathrooms?: number;
  };

  console.log('[search_properties] params:', {
    operation, type, city, neighborhood, budget_max, budget_min, min_bedrooms, min_bathrooms,
  });

  const where: Record<string, unknown> = {
    status: 'DISPONIBLE',
    published: true,
    archived: false,
  };

  // CRÍTICO: un inmueble "en arriendo" puede tener operation=ARRIENDO o VENTA_O_ARRIENDO.
  // Filtrar solo por 'ARRIENDO' excluye todos los de operación mixta.
  // Lo mismo aplica para VENTA. Siempre usar { in: [...] }.
  if (operation) {
    if (operation === 'ARRIENDO') {
      where.operation = { in: ['ARRIENDO', 'VENTA_O_ARRIENDO'] };
    } else if (operation === 'VENTA') {
      where.operation = { in: ['VENTA', 'VENTA_O_ARRIENDO'] };
    } else {
      where.operation = operation;
    }
  }

  if (type) where.type = type;
  // city siempre insensitive — "bogota" debe encontrar "Bogotá"
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (neighborhood) where.neighborhood = { contains: neighborhood, mode: 'insensitive' };
  // Solo filtrar por habitaciones si el cliente lo especificó — NUNCA asumir valor mínimo
  if (min_bedrooms != null && min_bedrooms > 0) where.bedrooms = { gte: min_bedrooms };
  if (min_bathrooms != null && min_bathrooms > 0) where.bathrooms = { gte: min_bathrooms };
  if (budget_min || budget_max) {
    where.price = {
      ...(budget_min ? { gte: budget_min } : {}),
      ...(budget_max ? { lte: budget_max } : {}),
    };
  }

  const properties = await prisma.property.findMany({
    where: where as any,
    select: PUBLIC_PROPERTY_SELECT,
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: 5, // aumentamos a 5 para dar más opciones al modelo
  });

  console.log('[search_properties] results:', properties.length, 'inmuebles encontrados');
  if (properties.length === 0) {
    console.log('[search_properties] where clause:', JSON.stringify(where, null, 2));
  }

  return {
    count: properties.length,
    properties: properties.map(p => ({
      id: p.id, title: p.title, type: p.type, operation: p.operation,
      price: p.price, priceCurrency: p.priceCurrency, priceNegotiable: p.priceNegotiable,
      areaTotalM2: p.areaTotalM2, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
      city: p.city, neighborhood: p.neighborhood, address: p.address,
      photos: p.photos.slice(0, 1), // solo primera foto en la búsqueda
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

  const property = await prisma.property.findUnique({
    where: { id: property_id },
    select: { photos: true, title: true },
  });

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

// ─── schedule_appointment ─────────────────────────────────────────────────────

export const handleScheduleAppointment: ToolHandler = async (input) => {
  console.log('Fecha actual servidor:', new Date());
  const { client_id, property_id, scheduled_at, notes } = input as {
    client_id: string; property_id: string; scheduled_at: string; notes?: string;
  };

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
      scheduledAt: new Date(scheduled_at),
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
    message: `Cita agendada para ${new Date(scheduled_at).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })}`,
  };
};

// ─── reschedule_appointment ───────────────────────────────────────────────────

export const handleRescheduleAppointment: ToolHandler = async (input) => {
  const { appointment_id, new_scheduled_at, reason } = input as {
    appointment_id: string; new_scheduled_at: string; reason?: string;
  };

  const updated = await prisma.appointment.update({
    where: { id: appointment_id },
    data: {
      scheduledAt:  new Date(new_scheduled_at),
      status:       'REAGENDADA',
      notes:        reason ?? null,
    },
    select: { id: true, scheduledAt: true },
  });

  return {
    success: true,
    appointment_id: updated.id,
    new_scheduled_at: updated.scheduledAt.toISOString(),
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
