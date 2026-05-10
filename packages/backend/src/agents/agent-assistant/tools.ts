/**
 * tools.ts — Definiciones de las tools del agente Sofía.
 *
 * Cada tool describe su contrato para Anthropic (nombre, descripción, schema de input).
 * Las implementaciones reales están en handlers.ts.
 *
 * RESTRICCIÓN CRÍTICA: ninguna tool puede exponer datos del propietario del inmueble
 * (owner_name, owner_phone, owner_email, owner_notes). Ver regla de negocio #1 en CLAUDE.md.
 */

import { AgentTool } from '../shared/base-agent';

export const ASSISTANT_TOOLS: AgentTool[] = [
  // ── Búsqueda y detalle de inmuebles ─────────────────────────────────────────

  {
    name: 'search_properties',
    description:
      'Busca inmuebles disponibles. SIEMPRE incluir zones cuando el cliente mencione un barrio. ' +
      'Si omites zones, aparecerán inmuebles de zonas equivocadas. ' +
      'Si no hay zona específica, enviar zones: []. ' +
      'apartaestudio/estudio → type=APARTAMENTO, min_bedrooms=0.',
    input_schema: {
      type: 'object',
      properties: {
        zones: {
          type: 'array',
          items: { type: 'string' },
          description:
            'CRÍTICO: cuando el cliente mencione un barrio específico, este array NUNCA puede ' +
            'estar vacío. Incluir variaciones del nombre para búsqueda insensible a tildes/mayúsculas. ' +
            '❌ INCORRECTO — cliente dice "El Chico" → zones: [] (NUNCA hagas esto). ' +
            '✅ CORRECTO   — cliente dice "El Chico" → zones: ["chico","Chico","El Chico"]. ' +
            'Solo enviar [] cuando el cliente NO mencionó ningún barrio. ' +
            'Ejemplos: ' +
            '"Chico" → ["chico","Chico","El Chico"] | ' +
            '"Santa Bárbara" → ["santa barbara","Santa Barbara","Santa Bárbara"] | ' +
            '"Chapinero" → ["chapinero","Chapinero"] | ' +
            '"Laureles" → ["laureles","Laureles"] | ' +
            '"Poblado" → ["poblado","Poblado","El Poblado"] | ' +
            '"Usaquén" → ["usaquen","Usaquén","Usaquen"].',
        },
        neighborhood: {
          type: 'string',
          description:
            'El barrio exacto tal como lo mencionó el cliente. ' +
            'Enviar SIEMPRE que el cliente mencione una zona específica. ' +
            'Ej: cliente dice "en el Chico" → neighborhood: "El Chico". ' +
            'Este campo es el respaldo de zones — envía ambos.',
        },
        city: {
          type: 'string',
          description:
            'Ciudad inferida del barrio: Chico/Chapinero/Usaquén/Suba/Kennedy → Bogotá. ' +
            'Laureles/El Poblado/Envigado → Medellín. Omitir si no se conoce.',
        },
        operation: {
          type: 'string',
          enum: ['VENTA', 'ARRIENDO', 'VENTA_O_ARRIENDO'],
          description: 'Tipo de operación. Omitir si el cliente no lo especificó.',
        },
        type: {
          type: 'string',
          enum: ['CASA', 'APARTAMENTO', 'LOCAL', 'OFICINA', 'LOTE', 'BODEGA', 'FINCA'],
          description:
            'Tipo de inmueble. apartaestudio/estudio → APARTAMENTO.',
        },
        budget_max: {
          type: 'number',
          description: 'Presupuesto máximo en COP. "5 millones" = 5000000.',
        },
        budget_min: {
          type: 'number',
          description: 'Presupuesto mínimo en COP.',
        },
        min_bedrooms: {
          type: 'number',
          description:
            'Habitaciones mínimas. Para apartaestudio = 0. ' +
            'NO enviar si el cliente no especificó cantidad.',
        },
        min_bathrooms: {
          type: 'number',
          description: 'Baños mínimos. NO enviar si el cliente no lo especificó.',
        },
      },
      required: ['zones'],
    },
  },

  {
    name: 'get_property_detail',
    description:
      'Obtiene los detalles completos de un inmueble específico por su ID. ' +
      'Usa esta tool cuando el cliente pida más información de un inmueble ya presentado. ' +
      'NUNCA incluyas datos del propietario en tu respuesta al cliente.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: {
          type: 'string',
          description: 'ID del inmueble',
        },
      },
      required: ['property_id'],
    },
  },

  // ── Medios ───────────────────────────────────────────────────────────────────

  {
    name: 'send_property_media',
    description:
      'Envía las fotos de un inmueble al cliente por WhatsApp. ' +
      'Úsala cuando el cliente pida fotos o quiera ver el inmueble. ' +
      'Solo envía máximo 3 fotos para no saturar. ' +
      'REGLA CRÍTICA: property_id debe ser el ID EXACTO devuelto por search_properties. ' +
      'NUNCA escribas un property_id de memoria ni lo inventes.',
    input_schema: {
      type: 'object',
      properties: {
        client_phone: {
          type: 'string',
          description: 'Teléfono del cliente en formato +57XXXXXXXXXX. El sistema lo corrige automáticamente.',
        },
        property_id: {
          type: 'string',
          description:
            'ID EXACTO del inmueble tal como lo devolvió search_properties en esta conversación. ' +
            'NUNCA inventes ni escribas un ID de memoria. ' +
            'Si no tienes un ID real de search_properties, NO llames esta tool.',
        },
      },
      required: ['client_phone', 'property_id'],
    },
  },

  // ── Disponibilidad y citas ───────────────────────────────────────────────────

  {
    name: 'check_availability',
    description:
      'Verifica si hay horarios disponibles para visitar un inmueble. ' +
      'Cruza la disponibilidad del inmueble (visit_time_slots) con la del agente asignado. ' +
      'Devuelve los próximos 5 slots disponibles.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: {
          type: 'string',
          description: 'ID del inmueble',
        },
        preferred_dates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fechas preferidas por el cliente en formato YYYY-MM-DD',
        },
      },
      required: ['property_id'],
    },
  },

  {
    name: 'schedule_appointment',
    description:
      'Agenda una cita de visita. Solo usar cuando el cliente haya confirmado ' +
      'explícitamente la fecha y hora. Requiere que el cliente ya esté guardado en el sistema.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID del cliente en el sistema',
        },
        property_id: {
          type: 'string',
          description: 'ID del inmueble a visitar',
        },
        scheduled_at: {
          type: 'string',
          description: 'Fecha y hora de la cita en formato ISO 8601 (ej: 2025-05-15T10:00:00)',
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales sobre la cita',
        },
      },
      required: ['client_id', 'property_id', 'scheduled_at'],
    },
  },

  {
    name: 'find_appointment',
    description:
      'Busca una cita existente por datos que el cliente conoce: nombre, teléfono, ' +
      'nombre del inmueble o fecha aproximada. ' +
      'SIEMPRE usa esta tool antes de reschedule_appointment o cancel_appointment. ' +
      'NUNCA pidas el ID de la cita al cliente — úsala para encontrarlo internamente.',
    input_schema: {
      type: 'object',
      properties: {
        client_name: {
          type: 'string',
          description: 'Nombre (o parte del nombre) del cliente',
        },
        client_phone: {
          type: 'string',
          description: 'Teléfono del cliente — se busca por los últimos 7 dígitos',
        },
        property_name: {
          type: 'string',
          description: 'Nombre o parte del nombre del inmueble',
        },
        approximate_date: {
          type: 'string',
          description: 'Fecha aproximada: "hoy", "mañana" o formato YYYY-MM-DD',
        },
      },
    },
  },

  {
    name: 'reschedule_appointment',
    description: 'Reagenda una cita existente a una nueva fecha y hora.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'ID de la cita a reagendar',
        },
        new_scheduled_at: {
          type: 'string',
          description: 'Nueva fecha y hora en formato ISO 8601',
        },
        reason: {
          type: 'string',
          description: 'Razón del reagendamiento',
        },
      },
      required: ['appointment_id', 'new_scheduled_at'],
    },
  },

  {
    name: 'cancel_appointment',
    description: 'Cancela una cita de visita existente.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'ID de la cita a cancelar',
        },
        reason: {
          type: 'string',
          description: 'Razón de la cancelación',
        },
      },
      required: ['appointment_id', 'reason'],
    },
  },

  {
    name: 'update_appointment_status',
    description:
      'Actualiza el estado de una cita a CONFIRMADA o CANCELADA. ' +
      'Usar cuando el cliente responde al recordatorio de visita. ' +
      'Siempre obtener el appointment_id con find_appointment primero. ' +
      'Si se confirma → notifica automáticamente al agente por WhatsApp. ' +
      'Si se cancela → también notifica al agente con el motivo.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'ID de la cita a actualizar — obtenido con find_appointment',
        },
        status: {
          type: 'string',
          enum: ['CONFIRMADA', 'CANCELADA'],
          description: 'Nuevo estado: CONFIRMADA cuando el cliente confirma, CANCELADA cuando cancela',
        },
        reason: {
          type: 'string',
          description: 'Motivo de cancelación (obligatorio si status es CANCELADA)',
        },
      },
      required: ['appointment_id', 'status'],
    },
  },

  {
    name: 'flag_special_case',
    description:
      'Marca una situación especial donde el cliente no puede en los horarios disponibles. ' +
      'Un agente humano lo contactará para coordinar manualmente. ' +
      'Usar cuando no hay coincidencia entre disponibilidad del inmueble y lo que pide el cliente.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID del cliente',
        },
        property_id: {
          type: 'string',
          description: 'ID del inmueble de interés',
        },
        client_notes: {
          type: 'string',
          description: 'Descripción de la situación: qué horarios pide el cliente y por qué no hay disponibilidad',
        },
      },
      required: ['client_id', 'property_id', 'client_notes'],
    },
  },

  // ── Gestión de clientes ──────────────────────────────────────────────────────

  {
    name: 'save_client',
    description:
      'Guarda o actualiza los datos de un cliente en el CRM. ' +
      'Usar al inicio de la conversación cuando se obtiene el nombre y teléfono del cliente. ' +
      'Si el cliente ya existe (mismo teléfono), actualiza sus datos.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nombre completo del cliente',
        },
        phone: {
          type: 'string',
          description: 'Teléfono en formato +57XXXXXXXXXX',
        },
        email: {
          type: 'string',
          description: 'Email del cliente (opcional)',
        },
        budget_min: {
          type: 'number',
          description: 'Presupuesto mínimo en COP',
        },
        budget_max: {
          type: 'number',
          description: 'Presupuesto máximo en COP',
        },
        preferred_operation: {
          type: 'string',
          enum: ['VENTA', 'ARRIENDO'],
          description: 'Si quiere comprar o arrendar',
        },
        preferred_zones: {
          type: 'array',
          items: { type: 'string' },
          description: 'Zonas o barrios de interés',
        },
        preferred_type: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tipos de inmueble de interés',
        },
        min_bedrooms: {
          type: 'number',
          description: 'Mínimo de habitaciones deseadas',
        },
        additional_requirements: {
          type: 'string',
          description: 'Otros requerimientos en texto libre',
        },
      },
      required: ['name', 'phone'],
    },
  },

  {
    name: 'update_client_interest',
    description:
      'Actualiza el nivel de interés detectado del cliente (escala 1-5). ' +
      'Usar al final de cada interacción o cuando el nivel cambia significativamente. ' +
      '5=muy interesado/quiere visitar urgente, 1=sin interés real.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID del cliente',
        },
        interest_level: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'Nivel de interés: 1=sin interés, 3=explorando, 5=muy interesado',
        },
        notes: {
          type: 'string',
          description: 'Justificación del nivel asignado',
        },
      },
      required: ['client_id', 'interest_level'],
    },
  },

  {
    name: 'get_client_history',
    description:
      'Obtiene el historial de conversaciones y citas previas de un cliente. ' +
      'Usar al inicio de la conversación si el cliente ya existía para dar continuidad.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID del cliente',
        },
      },
      required: ['client_id'],
    },
  },

  // ── Cierre de conversación ───────────────────────────────────────────────────

  {
    name: 'log_conversation_summary',
    description:
      'Registra el resumen y resultado de la conversación al finalizar. ' +
      'SIEMPRE llamar esta tool al despedirse del cliente.',
    input_schema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'ID del cliente (si fue identificado)',
        },
        summary: {
          type: 'string',
          description: 'Resumen de lo hablado: qué buscaba, qué se le mostró, resultado',
        },
        interest_level: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'Nivel de interés final detectado',
        },
        outcome: {
          type: 'string',
          enum: ['calificado', 'cita_agendada', 'sin_interes', 'no_responde', 'caso_especial', 'seguimiento'],
          description: 'Resultado de la conversación',
        },
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Temas tratados: zonas, tipos de inmueble, presupuesto, etc.',
        },
      },
      required: ['summary', 'interest_level', 'outcome'],
    },
  },
];
