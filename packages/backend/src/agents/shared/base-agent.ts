/**
 * base-agent.ts — Clase base para todos los agentes IA del sistema.
 *
 * Encapsula el loop de tool-use de Anthropic:
 *   1. Enviar mensajes con tools disponibles
 *   2. Si el modelo llama una tool → ejecutar handler → continuar
 *   3. Si stop_reason es end_turn → devolver texto final
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Handler de una tool: recibe el input y devuelve cualquier valor serializable */
export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export interface ChatOptions {
  /** Prompt del sistema con la personalidad y restricciones del agente */
  systemPrompt: string;
  /** Historial de la conversación (mutable — se añaden turnos en cada llamada) */
  messages: Anthropic.MessageParam[];
  /** Herramientas disponibles para este agente */
  tools: AgentTool[];
  /** Mapa nombre-tool → función que la ejecuta */
  toolHandlers: Record<string, ToolHandler>;
  /** Máximo de iteraciones del loop tool-use (evitar loops infinitos) */
  maxIterations?: number;
}

// ─── BaseAgent ────────────────────────────────────────────────────────────────

export class BaseAgent {
  protected readonly client: Anthropic;
  /** claude-sonnet-4-5 — balance óptimo de calidad y velocidad para agentes */
  protected readonly model = 'claude-sonnet-4-5-20250929';
  protected readonly maxTokens = 1024;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Ejecuta el loop de conversación con tool use.
   * Modifica `options.messages` in-place añadiendo los turnos del agente.
   *
   * @returns Texto final de la respuesta del agente
   */
  async chat(options: ChatOptions): Promise<string> {
    const { systemPrompt, messages, tools, toolHandlers, maxIterations = 10 } = options;

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.client.messages.create({
        model:      this.model,
        max_tokens: this.maxTokens,
        system:     systemPrompt,
        messages,
        tools:      tools as Anthropic.Tool[],
      });

      // ── Respuesta de texto final ────────────────────────────────────────────
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
        return textBlock?.text ?? '';
      }

      // ── El modelo solicita ejecutar tools ──────────────────────────────────
      if (response.stop_reason === 'tool_use') {
        // Añadir el turno del asistente al historial
        messages.push({ role: 'assistant', content: response.content });

        // Ejecutar cada tool en paralelo
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            const handler = toolHandlers[block.name];
            let content: string;

            if (!handler) {
              console.warn(`[base-agent] Tool "${block.name}" sin handler registrado`);
              content = JSON.stringify({ error: `Tool "${block.name}" no disponible` });
            } else {
              try {
                const result = await handler(block.input as Record<string, unknown>);
                content = JSON.stringify(result);
                console.log(`[base-agent] Tool "${block.name}" ejecutada OK`);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[base-agent] Tool "${block.name}" error: ${msg}`);
                content = JSON.stringify({ error: msg });
              }
            }

            return {
              type:        'tool_result' as const,
              tool_use_id: block.id,
              content,
            };
          }),
        );

        // Añadir resultados al historial y continuar el loop
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // ── Cualquier otro stop_reason ──────────────────────────────────────────
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      return textBlock?.text ?? '';
    }

    // Si se agotaron las iteraciones, devolver advertencia
    console.error(`[base-agent] Se agotaron ${maxIterations} iteraciones del loop`);
    return 'Lo siento, tuve un problema procesando tu solicitud. ¿Puedes repetirla?';
  }
}
