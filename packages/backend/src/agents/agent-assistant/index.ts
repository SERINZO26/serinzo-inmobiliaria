/**
 * agent-assistant/index.ts — Agente Sofía: atención al cliente por WhatsApp.
 *
 * Mantiene el historial de conversación por número de teléfono en memoria.
 * Persiste cada conversación y sus turns en la BD al momento de ocurrir,
 * sin depender de que el agente llame log_conversation_summary.
 *
 * NOTA DE VOZ: ElevenLabs requiere plan de pago.
 * Por ahora los mensajes de voz entrantes se transcriben con Deepgram (gratis)
 * y se responde con TEXTO solamente. No se genera audio de respuesta.
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, ToolHandler } from '../shared/base-agent';
import { buildSystemPrompt } from './prompts';
import { ASSISTANT_TOOLS } from './tools';
import { TOOL_HANDLERS, handleLogConversationSummary } from './handlers';
import { speechToText } from '../../services/voice';
import { prisma } from '../../lib/prisma';

// ─── Normalización del teléfono ───────────────────────────────────────────────

/**
 * Normaliza cualquier formato de número de teléfono a solo dígitos.
 * Esto garantiza que el mismo número siempre use la misma clave en el Map de sesiones,
 * independientemente del formato en que llegue de Twilio.
 *
 *   "whatsapp:+573001234567" → "573001234567"
 *   "WHATSAPP:+573001234567" → "573001234567"  (Twilio a veces mayúsculas)
 *   "+573001234567"          → "573001234567"
 *   "573001234567"           → "573001234567"
 *
 * Twilio no es consistente: envía con '+', sin '+', o con prefijo whatsapp: en
 * distintas mayúsculas. Sin esta normalización el mismo cliente genera claves
 * distintas en el Map → sesiones paralelas → doble saludo.
 */
const normalizePhone = (phone: string): string =>
  phone
    .toLowerCase()            // maneja WHATSAPP: y whatsapp:
    .replace('whatsapp:', '') // elimina el prefijo de Twilio
    .replace(/\D/g, '')       // elimina +, espacios, guiones y cualquier no-dígito
    .trim();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ConversationSession {
  messages: Anthropic.MessageParam[];
  /** Teléfono del cliente en formato +57XXXXXXXXXX */
  phone: string;
  /** ID del cliente en el CRM (null si aún no fue guardado) */
  clientId: string | null;
  /** ID del registro Conversation en BD (creado al primer mensaje) */
  conversationId: string | null;
  /** Timestamp del inicio de la sesión */
  startedAt: Date;
  /** Timestamp del último mensaje — para expirar sesiones inactivas */
  lastActivity: Date;
}

// ─── Helpers anti-loop ───────────────────────────────────────────────────────

/**
 * Extrae los property_ids de las tool calls en los últimos N mensajes del asistente.
 * Se usan para detectar si ya se mostró un inmueble y evitar que el agente
 * llame search_properties de nuevo cuando el cliente dice "sí".
 *
 * Herramientas que implican haber presentado un inmueble al cliente:
 *   send_property_media, get_property_detail, check_availability, schedule_appointment
 */
function getRecentlyShownPropertyIds(
  messages: Anthropic.MessageParam[],
  lookback = 3,
): Set<string> {
  const ids = new Set<string>();

  const assistantMsgs = messages
    .filter((m) => m.role === 'assistant')
    .slice(-lookback);

  for (const msg of assistantMsgs) {
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue;
      const propertyTools = [
        'send_property_media',
        'get_property_detail',
        'check_availability',
        'schedule_appointment',
      ];
      if (propertyTools.includes(block.name)) {
        const input = block.input as Record<string, unknown>;
        if (typeof input.property_id === 'string' && input.property_id) {
          ids.add(input.property_id);
        }
      }
    }
  }

  return ids;
}

/**
 * Envuelve todos los tool handlers con dos guardas anti-loop:
 *
 * 1. Límite de tool calls totales en un único ciclo de respuesta.
 *    Si se superan MAX_TOOL_CALLS, devuelve un error que hace que
 *    el modelo pare de encadenar herramientas y responda directamente.
 *
 * 2. Bloqueo de search_properties cuando ya hay property_ids recientes.
 *    Si el modelo intenta buscar de nuevo tras haber mostrado un inmueble,
 *    se le devuelve el property_id que ya tenía para que ejecute la
 *    acción correcta (fotos o cita) en lugar de volver a buscar.
 */
function wrapHandlersAntiLoop(
  handlers:           Record<string, ToolHandler>,
  recentPropertyIds:  Set<string>,
  phone:              string,
  MAX_TOOL_CALLS = 10,
): Record<string, ToolHandler> {
  let totalToolCalls = 0;
  const wrapped: Record<string, ToolHandler> = {};

  for (const [name, handler] of Object.entries(handlers)) {
    wrapped[name] = async (input) => {
      totalToolCalls++;

      // ── Guarda 1: límite de tool calls ──────────────────────────────────
      if (totalToolCalls > MAX_TOOL_CALLS) {
        console.warn(
          `[agent-assistant] Anti-loop: ${totalToolCalls} tool calls en ${phone} — forzando stop`,
        );
        return {
          error: 'Límite de acciones alcanzado. Responde directamente al cliente sin llamar más herramientas.',
        };
      }

      // ── Guarda 2: bloquear search_properties si ya hay inmuebles ────────
      if (name === 'search_properties' && recentPropertyIds.size > 0) {
        const shownId = [...recentPropertyIds][0]; // el más reciente
        console.warn(
          `[agent-assistant] Anti-loop: bloqueando search_properties — property_id reciente: ${shownId} (${phone})`,
        );
        return {
          blocked:            true,
          recent_property_id: shownId,
          message:
            `Ya presentaste el inmueble ${shownId}. NO busques de nuevo. ` +
            `Ejecuta la acción que ofreciste (send_property_media o check_availability) ` +
            `usando property_id="${shownId}".`,
        };
      }

      return handler(input);
    };
  }

  return wrapped;
}

// ─── AssistantAgent ───────────────────────────────────────────────────────────

export class AssistantAgent extends BaseAgent {
  /** Sesiones activas por teléfono — clave: número E.164 (+57XXXXXXXXXX) */
  private readonly sessions = new Map<string, ConversationSession>();

  /** TTL de inactividad: 24 horas. Coincide con la ventana de búsqueda en BD. */
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  /**
   * Lock por teléfono: evita que dos mensajes del mismo número se procesen
   * en paralelo, lo que generaría dos sesiones independientes y causaría
   * que Sofía se presentara dos veces o perdiera contexto entre mensajes.
   */
  private readonly processingLocks = new Map<string, boolean>();

  constructor() {
    super();
    // Limpiar sesiones expiradas cada 30 minutos
    setInterval(() => this.cleanExpiredSessions(), 30 * 60 * 1000);
  }

  // ── Gestión de sesiones ──────────────────────────────────────────────────────

  /**
   * Obtiene la sesión activa del número o la restaura desde la BD.
   *
   * Orden de prioridad:
   * 1. Sesión en memoria (activa) → devuelve directamente
   * 2. Conversación activa en BD (últimas 24h, endedAt null, contactPhone = phone) → restaura
   * 3. No existe → devuelve null (processMessage creará sesión nueva)
   */
  private async getOrRestoreSession(phone: string): Promise<ConversationSession | null> {
    // 1. Sesión activa en memoria
    const existing = this.sessions.get(phone);
    if (existing) {
      existing.lastActivity = new Date();
      return existing;
    }

    // 2. Buscar conversación activa en BD (por contactPhone — funciona incluso sin cliente guardado)
    try {
      const since = new Date(Date.now() - this.SESSION_TTL_MS);
      const recentConv = await prisma.conversation.findFirst({
        where: {
          contactPhone: phone,
          channel:      'WHATSAPP',
          createdAt:    { gte: since },
          endedAt:      null,           // solo conversaciones abiertas
        },
        include: {
          turns:  { orderBy: { timestamp: 'asc' }, take: 30 },
          client: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentConv && recentConv.turns.length > 0) {
        const messages: Anthropic.MessageParam[] = recentConv.turns.map((t) => ({
          role:    t.role === 'USER' ? 'user' : 'assistant',
          content: t.content,
        }));

        const restored: ConversationSession = {
          phone,
          messages,
          clientId:       recentConv.client?.id ?? null,
          conversationId: recentConv.id,
          startedAt:      recentConv.createdAt,
          lastActivity:   new Date(),
        };
        this.sessions.set(phone, restored);
        console.log(`[agent-assistant] Sesión restaurada: ${phone} (${messages.length} turns, conv ${recentConv.id})`);
        return restored;
      }
    } catch (err) {
      console.error('[agent-assistant] Error restaurando sesión desde BD:', err);
    }

    // 3. Sin conversación activa reciente → sesión nueva
    return null;
  }

  /** Crea una sesión vacía nueva para un número (primer contacto o sesión expirada > 24h) */
  private createNewSession(phone: string): ConversationSession {
    const session: ConversationSession = {
      phone,
      messages:       [],
      clientId:       null,
      conversationId: null,
      startedAt:      new Date(),
      lastActivity:   new Date(),
    };
    this.sessions.set(phone, session);
    return session;
  }

  /** Elimina la sesión en memoria de un número (para testing o soporte). */
  clearSession(phone: string): boolean {
    const normalized = normalizePhone(phone);
    const existed = this.sessions.has(normalized);
    this.sessions.delete(normalized);
    console.log(`[agent-assistant] clearSession: ${normalized} — ${existed ? 'eliminada' : 'no existía'}`);
    return existed;
  }

  /** Lista las sesiones activas (para diagnóstico). */
  listSessions(): { phone: string; messages: number; lastActivity: string }[] {
    return [...this.sessions.entries()].map(([phone, s]) => ({
      phone,
      messages:     s.messages.length,
      lastActivity: s.lastActivity.toISOString(),
    }));
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [phone, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.SESSION_TTL_MS) {
        this.sessions.delete(phone);
        console.log(`[agent-assistant] Sesión expirada eliminada de memoria: ${phone}`);
      }
    }
  }

  // ── Persistencia de conversación ─────────────────────────────────────────────

  /**
   * Crea el registro Conversation en BD al primer mensaje de la sesión.
   * Si ya existe (conversationId != null), no hace nada.
   */
  private async ensureConversationRecord(session: ConversationSession): Promise<void> {
    if (session.conversationId) return;

    try {
      const conv = await prisma.conversation.create({
        data: {
          channel:      'WHATSAPP',
          clientId:     session.clientId ?? null,
          contactPhone: session.phone,   // clave para restaurar sin cliente guardado
          startedAt:    session.startedAt,
        },
        select: { id: true },
      });
      session.conversationId = conv.id;
      console.log(`[agent-assistant] Conversación BD creada: ${conv.id}`);
    } catch (err) {
      // No bloquear el flujo si falla el registro
      console.error('[agent-assistant] Error creando conversación en BD:', err);
    }
  }

  /**
   * Guarda un turn (usuario o asistente) en ConversationTurn.
   */
  private async saveTurn(
    session:  ConversationSession,
    role:     'user' | 'assistant',
    content:  string,
  ): Promise<void> {
    if (!session.conversationId) return;

    try {
      await prisma.conversationTurn.create({
        data: {
          conversationId: session.conversationId,
          role:           role === 'user' ? 'USER' : 'ASSISTANT',
          content,
          timestamp:      new Date(),
        },
      });
    } catch (err) {
      console.error(`[agent-assistant] Error guardando turn (${role}):`, err);
    }
  }

  /**
   * Actualiza el clientId en el registro Conversation cuando se identifica al cliente.
   */
  async linkClientToConversation(rawPhone: string, clientId: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    const session = this.sessions.get(phone);
    if (!session) return;

    session.clientId = clientId;

    if (session.conversationId) {
      try {
        await prisma.conversation.update({
          where: { id: session.conversationId },
          data:  { clientId },
        });
      } catch (err) {
        console.error('[agent-assistant] Error vinculando cliente a conversación:', err);
      }
    }
  }

  // ── Procesamiento de mensajes de texto ───────────────────────────────────────

  /**
   * Procesa un mensaje de texto entrante de WhatsApp.
   *
   * Incluye un lock por número de teléfono: si llega un segundo mensaje
   * antes de que el primero termine, espera hasta 5 s antes de proceder.
   * Esto evita que mensajes rápidos consecutivos (o el doble-envío de Twilio)
   * generen dos sesiones paralelas y provoquen doble saludo o pérdida de contexto.
   *
   * @param phone  Número del cliente en formato +57XXXXXXXXXX
   * @param text   Contenido del mensaje
   * @returns      Respuesta de texto de Sofía
   */
  async processMessage(rawPhone: string, text: string): Promise<string> {
    // Normalizar siempre — garantiza clave única en el Map sin importar el formato de Twilio
    const phone = normalizePhone(rawPhone);

    // ── Lock: esperar si este número ya está siendo procesado ───────────────
    const LOCK_WAIT_MS    = 500;   // intervalo de reintento
    const LOCK_TIMEOUT_MS = 5000;  // máximo que esperamos antes de proceder igual
    let waited = 0;

    while (this.processingLocks.get(phone) && waited < LOCK_TIMEOUT_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
      waited += LOCK_WAIT_MS;
    }

    if (waited > 0) {
      console.log(`[agent-assistant] Lock liberado para ${phone} tras ${waited}ms`);
    }

    this.processingLocks.set(phone, true);

    try {
      return await this._processMessageInner(phone, text);
    } finally {
      this.processingLocks.set(phone, false);
    }
  }

  /** Lógica interna de processMessage — llamar solo desde processMessage (con lock). */
  private async _processMessageInner(phone: string, text: string): Promise<string> {
    // Diagnóstico de sesiones — confirma que el singleton persiste y la clave es consistente
    console.log(`[agent-assistant] ── Mensaje entrante ──────────────────────────`);
    console.log(`[agent-assistant] Phone normalizado : "${phone}"`);
    console.log(`[agent-assistant] Sesiones activas  : [${[...this.sessions.keys()].join(', ') || 'ninguna'}]`);
    console.log(`[agent-assistant] Sesión existente  : ${this.sessions.has(phone) ? 'SÍ' : 'NO — se creará nueva'}`);

    // Obtener sesión activa o restaurarla desde BD (últimas 24h)
    const session = (await this.getOrRestoreSession(phone)) ?? this.createNewSession(phone);

    // Crear registro en BD solo si es una sesión nueva (conversationId === null)
    await this.ensureConversationRecord(session);

    // Guardar turn del usuario en BD
    await this.saveTurn(session, 'user', text);

    // Añadir mensaje al historial en memoria
    session.messages.push({ role: 'user', content: text });

    console.log(`[agent-assistant] Mensaje de ${phone}: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);

    // Construir handlers con conversationId inyectado en log_conversation_summary
    // (para que actualice el registro existente en lugar de crear uno nuevo)
    const conversationId = session.conversationId;
    // Teléfono en formato E.164 para send_property_media — Claude no tiene acceso
    // al número completo del remitente, así que lo inyectamos desde la sesión.
    const clientPhoneE164 = `+${phone}`;
    const baseHandlers = {
      ...TOOL_HANDLERS,
      send_property_media: async (input: unknown) => {
        // Sobreescribir client_phone con el teléfono real de la sesión,
        // independientemente de lo que Claude haya enviado (puede llegar "+57" o vacío).
        const corrected = { ...(input as object), client_phone: clientPhoneE164 };
        console.log(`📸 client_phone corregido a: ${clientPhoneE164}`);
        return TOOL_HANDLERS.send_property_media(corrected);
      },
      log_conversation_summary: async (input: unknown) => {
        const result = await handleLogConversationSummary(input, conversationId);

        // Sincronizar clientId si el agente identificó al cliente en esta llamada
        const out = result as { client_id?: string } | null;
        if (out?.client_id && !session.clientId) {
          await this.linkClientToConversation(phone, out.client_id);
        }

        return result;
      },
    } as Record<string, ToolHandler>;

    // ─── Anti-loop: calcular property_ids recientes y envolver handlers ─────
    const recentPropertyIds = getRecentlyShownPropertyIds(session.messages);
    const toolHandlers      = wrapHandlersAntiLoop(baseHandlers, recentPropertyIds, phone);

    try {
      const response = await this.chat({
        systemPrompt: buildSystemPrompt(),
        messages:     session.messages,
        tools:        ASSISTANT_TOOLS,
        toolHandlers,
      });

      // Guardar turn del asistente en BD
      await this.saveTurn(session, 'assistant', response);

      console.log(`[agent-assistant] Respuesta a ${phone}: "${response.slice(0, 80)}${response.length > 80 ? '…' : ''}"`);
      return response;
    } catch (err) {
      console.error(`[agent-assistant] Error procesando mensaje de ${phone}:`, err);
      return 'Disculpa, tuve un inconveniente técnico. Por favor escríbeme de nuevo en un momento.';
    }
  }

  // ── Procesamiento de mensajes de voz ────────────────────────────────────────

  /**
   * Procesa un audio entrante de WhatsApp.
   *
   * NOTA: ElevenLabs requiere plan de pago — por ahora NO se genera audio de respuesta.
   * El flujo es: transcribir con Deepgram → procesar como texto → responder con texto.
   *
   * @param phone       Número del cliente
   * @param audioBuffer Buffer con el audio recibido
   * @param mimeType    Tipo MIME del audio ('audio/ogg', 'audio/mpeg', etc.)
   * @returns           Texto de respuesta (con prefijo "[Escuché tu mensaje de voz] ")
   */
  async processVoiceMessage(
    rawPhone: string,
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    // Normalizar para que el audio use la misma clave de sesión que los mensajes de texto
    const phone = normalizePhone(rawPhone);
    console.log(`[agent-assistant] Audio entrante de ${phone} (${mimeType}, ${audioBuffer.length} bytes)`);

    let transcript: string;
    try {
      transcript = await speechToText(audioBuffer, mimeType);
    } catch (err) {
      console.error(`[agent-assistant] Error transcribiendo audio de ${phone}:`, err);
      return 'Recibí tu nota de voz pero no pude transcribirla. ¿Puedes escribirme lo que necesitas?';
    }

    if (!transcript.trim()) {
      return 'Recibí tu nota de voz pero no pude escuchar bien el audio. ¿Puedes repetirlo o escribirme?';
    }

    console.log(`[agent-assistant] Transcript de ${phone}: "${transcript}"`);

    // Procesar el texto transcrito como mensaje normal
    const textResponse = await this.processMessage(phone, transcript);

    // Prefijo para que el cliente sepa que el audio fue recibido
    return `[Escuché tu mensaje de voz] ${textResponse}`;
  }

  // ── Utilidades ───────────────────────────────────────────────────────────────

  /** Resetea la sesión de un número (útil para pruebas) */
  resetSession(phone: string): void {
    this.sessions.delete(phone);
    console.log(`[agent-assistant] Sesión reseteada: ${phone}`);
  }

  /** Número de sesiones activas en memoria */
  get activeSessionCount(): number {
    return this.sessions.size;
  }
}

/** Instancia singleton — un solo agente para todo el proceso */
export const assistantAgent = new AssistantAgent();
