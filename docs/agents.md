# Documentacion de Agentes IA

Cada agente es un modulo independiente. Se comunican via bus de eventos (Redis/BullMQ), nunca llamandose directamente. Todo agente registra su actividad en `AgentLog`.

---

## Tabla de agentes

| Nombre | Etapa | Estado | Proposito | Eventos que consume | Eventos que publica |
|---|---|---|---|---|---|
| `agent-assistant` | 2 | Pendiente | Atencion al cliente por WhatsApp y voz 24/7 | `whatsapp.message.received`, `voice.call.started` | `appointment.scheduled`, `client.qualified`, `special_case.flagged` |
| `agent-prospector` | 3 | Pendiente | Captacion de inmuebles desde portales externos | `prospector.run.requested` | `property.prospected` |
| `agent-content` | 4 | Pendiente | Generacion de guiones de reels y contenido de valor | `property.published` | `content.draft.ready` |
| `agent-video` | 4 | Pendiente | Edicion de video por instrucciones en lenguaje natural | `content.draft.ready`, `video.edit.requested` | `video.ready` |
| `agent-campaigns` | 5 | Pendiente | Campanas de WhatsApp segmentadas por perfil de cliente | `campaign.send.requested` | `campaign.completed` |
| `agent-optimizer` | 6 | Pendiente | Analisis de patrones historicos y sugerencias de mejora | `optimizer.run.scheduled` | `optimizer.report.ready` |

---

## Arquitectura

```
  Twilio / Voz
       |
  agent-assistant --> Event Bus --> agent-content
                                --> agent-campaigns
                                --> agent-prospector
                                       |
                              Revision humana en panel
```

---

## Convenciones por agente

Cada agente vive en `/packages/backend/src/agents/{nombre}/`:

```
index.ts       # Entry point y suscripcion a eventos
tools.ts       # Tools para Anthropic tool use
prompts.ts     # System prompt — NUNCA hardcodear en otro lugar
handlers.ts    # Logica de negocio del agente
```

---

## Detalles por agente

### agent-assistant

> Por documentar en Etapa 2

### agent-prospector

> Por documentar en Etapa 3

### agent-content

> Por documentar en Etapa 4

### agent-video

> Por documentar en Etapa 4

### agent-campaigns

> Por documentar en Etapa 5

### agent-optimizer

> Por documentar en Etapa 6
