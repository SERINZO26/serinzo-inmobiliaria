# CLAUDE.md — Sistema Inmobiliario con Agentes IA

## 📌 Visión del Producto

Sistema completo entregado a una inmobiliaria para que lo administre internamente.
No es SaaS multi-tenant — es un producto instalado y configurado para **una sola inmobiliaria**.

El sistema combina:
- **CRM** con KPIs, gestión de clientes e inmuebles
- **Sitio web público** donde se muestran los inmuebles disponibles
- **Panel de administración** diseñado para personas sin conocimientos técnicos
- **Agentes IA especializados** que automatizan atención, captación, contenido y campañas

### Principio de diseño del panel
Cualquier persona de la inmobiliaria, sin importar su nivel técnico, debe poder:
- Agregar y editar inmuebles con fotos
- Ver y gestionar clientes y citas
- Leer reportes y KPIs
- Configurar opciones básicas

Si algo requiere conocimiento técnico para operarse, está mal diseñado.

---

## 👥 Actores del Sistema

| Actor | Quién es | Acceso |
|---|---|---|
| **Admin** | Gerente o dueño de la inmobiliaria | Panel completo — todo sin excepciones |
| **Agente** | Corredor inmobiliario | Sus inmuebles, sus clientes, sus citas, sus KPIs |
| **Asistente** | Personal administrativo | Ver y editar datos básicos — sin configuración del sistema |
| **Cliente Final** | Persona que busca comprar/arrendar | Sitio web público + agente IA (WhatsApp/voz) |

> El propietario del inmueble **NO tiene acceso al sistema**. Sus datos (nombre, teléfono, email)
> los carga el agente inmobiliario en la ficha del inmueble. Son datos de contacto privados,
> nunca visibles en el sitio público ni accesibles por el agente IA de atención.

---

## 🏗️ Stack Técnico

| Capa | Tecnología | Razón |
|---|---|---|
| **Backend** | Node.js + TypeScript + Express | Ecosistema amplio, fácil de mantener |
| **Base de datos** | PostgreSQL + pgvector | Relacional + búsqueda semántica de inmuebles |
| **ORM** | Prisma | Migraciones seguras, tipos automáticos |
| **Agentes IA** | Claude claude-sonnet-4-20250514 (Anthropic) con tool use | Razonamiento + herramientas |
| **Bus de eventos** | Redis + BullMQ | Comunicación entre agentes, colas de tareas |
| **Voz** | ElevenLabs (TTS) + Deepgram (STT) | Calidad de voz natural en español |
| **WhatsApp** | Twilio WhatsApp Business API | Mensajería oficial |
| **Email** | Resend | Notificaciones y recordatorios |
| **Frontend** | Next.js 14 + Tailwind CSS + shadcn/ui | Panel admin + sitio público en un solo repo |
| **Storage media** | Cloudinary | Fotos, videos, transformaciones automáticas |
| **Autenticación** | NextAuth.js + roles | Multi-rol sin complejidad extra |
| **Calendario** | Google Calendar API | Disponibilidad de agentes |
| **Validación** | Zod | Schemas compartidos front/back |
| **Deploy** | Railway o Render (backend) + Vercel (frontend) | Simple, sin DevOps complejo |

---

## 🗂️ Estructura de Carpetas

```
/
├── CLAUDE.md
├── /packages
│   ├── /backend
│   │   ├── /src
│   │   │   ├── /agents
│   │   │   │   ├── /shared
│   │   │   │   │   ├── base-agent.ts      # Clase base con Anthropic API
│   │   │   │   │   ├── db-tools.ts        # Tools de BD reutilizables
│   │   │   │   │   └── event-bus.ts       # Pub/sub entre agentes
│   │   │   │   ├── /agent-assistant       # ETAPA 2: Atención voz+WhatsApp
│   │   │   │   ├── /agent-prospector      # ETAPA 3: Captación inmuebles
│   │   │   │   ├── /agent-content         # ETAPA 4: Reels y contenido
│   │   │   │   ├── /agent-video           # ETAPA 4: Edición de videos
│   │   │   │   ├── /agent-campaigns       # ETAPA 5: Campañas WhatsApp
│   │   │   │   └── /agent-optimizer       # ETAPA 6: Inteligencia
│   │   │   ├── /api
│   │   │   │   ├── /properties            # CRUD inmuebles
│   │   │   │   ├── /clients               # CRUD clientes compradores
│   │   │   │   ├── /staff                 # CRUD usuarios internos (agentes, asistentes)
│   │   │   │   ├── /appointments          # CRUD citas
│   │   │   │   ├── /availability          # Disponibilidad de agentes
│   │   │   │   ├── /conversations         # Historial conversaciones IA
│   │   │   │   ├── /campaigns             # Campañas WhatsApp
│   │   │   │   ├── /media                 # Reels y videos
│   │   │   │   ├── /dashboard             # KPIs y analíticas
│   │   │   │   ├── /settings              # Configuración del sistema
│   │   │   │   └── /webhooks              # Twilio, Google, etc.
│   │   │   ├── /services
│   │   │   │   ├── calendar.ts            # Google Calendar
│   │   │   │   ├── messaging.ts           # WhatsApp + email
│   │   │   │   ├── voice.ts               # TTS + STT
│   │   │   │   ├── storage.ts             # Cloudinary
│   │   │   │   ├── analytics.ts           # Queries de KPIs
│   │   │   │   └── notifications.ts       # Recordatorios automáticos
│   │   │   └── /lib
│   │   │       ├── prisma.ts              # Cliente Prisma
│   │   │       ├── redis.ts               # Cliente Redis
│   │   │       └── env.ts                 # Validación de variables (Zod)
│   │   ├── /prisma
│   │   │   └── schema.prisma              # Esquema completo de BD
│   │   └── package.json
│   └── /frontend
│       ├── /src
│       │   ├── /app
│       │   │   ├── /(public)              # Sitio web público (sin auth)
│       │   │   │   ├── page.tsx           # Home — inmuebles destacados + búsqueda
│       │   │   │   ├── /inmuebles         # Listado con filtros
│       │   │   │   ├── /inmuebles/[slug]  # Detalle del inmueble
│       │   │   │   └── /contacto          # Formulario de contacto
│       │   │   ├── /login                 # Login del panel
│       │   │   └── /(panel)               # Panel admin (requiere auth)
│       │   │       ├── /dashboard         # KPIs y resumen
│       │   │       ├── /inmuebles         # Gestión inmuebles
│       │   │       ├── /clientes          # CRM compradores
│       │   │       ├── /citas             # Calendario de citas
│       │   │       ├── /conversaciones    # Historial agente IA
│       │   │       ├── /captacion         # Propuestas del agente captador
│       │   │       ├── /contenido         # Reels y media
│       │   │       ├── /campañas          # Campañas WhatsApp
│       │   │       ├── /equipo            # Gestión de usuarios internos
│       │   │       └── /configuracion     # Ajustes del sistema
│       │   ├── /components
│       │   │   ├── /ui                    # shadcn/ui base
│       │   │   ├── /property-card         # Tarjeta de inmueble (público)
│       │   │   ├── /property-form         # Formulario de inmueble (panel)
│       │   │   ├── /availability-picker   # Selector de franjas horarias
│       │   │   ├── /kpi-card              # Tarjeta KPI del dashboard
│       │   │   └── /data-table            # Tabla con filtros y acciones
│       │   └── /lib
│       │       ├── auth.ts                # NextAuth config
│       │       └── api.ts                 # Cliente fetch tipado
│       └── package.json
├── /docs
│   ├── api.md
│   ├── agents.md
│   ├── database.md
│   └── deployment.md
└── package.json                           # Monorepo root (npm workspaces)
```

---

## 🗄️ Esquema de Base de Datos (Prisma)

### `User` — Usuarios internos del sistema
```
id, name, email, phone,
role (admin / agent / assistant),
avatar_url,
status (active / inactive),
google_calendar_refresh_token,   -- para sincronizar su disponibilidad
created_at, updated_at, last_login_at
```
> Solo admin puede crear y desactivar usuarios.
> No existe registro público — el admin crea las cuentas manualmente.

---

### `Property` — Inmuebles
```
id,
-- Clasificación
title, description, slug,
type (casa / apartamento / local / oficina / lote / bodega / finca),
operation (venta / arriendo / venta_o_arriendo),
-- Precio
price, price_currency (COP/USD), price_negotiable (boolean),
administration_fee,                -- para arriendos
-- Características físicas
area_total_m2, area_built_m2,
bedrooms, bathrooms, half_bathrooms, parking,
floor, total_floors, age_years, strata,
-- Ubicación
address, city, neighborhood, department,
lat, lng,
-- Media
photos (String[]),                 -- URLs Cloudinary, orden importa
videos (String[]),
virtual_tour_url,
floor_plan_url,
-- Estado
status (disponible / reservado / vendido / arrendado / inactivo),
featured (boolean),                -- destacado en home del sitio
published (boolean),               -- visible en sitio público
-- Datos del propietario (PRIVADOS — solo visible para admin y agentes)
owner_name,
owner_phone,
owner_email,
owner_notes,                       -- notas internas sobre el propietario
-- Disponibilidad para visitas (definida por el agente al cargar el inmueble)
visit_days (String[]),             -- ej: ["lunes","miércoles","viernes"]
visit_time_slots (Json),           -- ej: [{"from":"09:00","to":"12:00"},{"from":"14:00","to":"17:00"}]
visit_special_instructions,        -- ej: "Llamar al portero antes de llegar"
-- Asignación interna
assigned_agent_id (FK → User),
added_by_id (FK → User),
source (manual / captador_ia / formulario / referido),
-- SEO sitio público
meta_title, meta_description,
-- Auditoría
created_at, updated_at, archived (boolean)
```

---

### `PropertyFeature` — Características adicionales del inmueble
```
id, property_id (FK),
category (interior / exterior / zona_comun / servicio / seguridad),
name,     -- ej: "Piscina", "Gimnasio", "Cuarto de servicio"
value     -- ej: "Sí", "2", "Comunal"
```

---

### `Client` — Compradores y arrendatarios potenciales
```
id,
-- Datos de contacto
name, phone, email, id_number,
-- Origen
source (llamada / web / whatsapp / referido / campaña / visita_directa),
-- Preferencias (extraídas por el agente IA o ingresadas manualmente)
budget_min, budget_max, budget_currency,
preferred_type (String[]),         -- tipos de inmueble de interés
preferred_zones (String[]),        -- barrios o zonas de interés
preferred_operation (venta / arriendo),
min_bedrooms, min_bathrooms,
additional_requirements,           -- texto libre con requerimientos especiales
-- Calificación
interest_level (Int 1-5),          -- calculado por IA, editable por agente
interest_score (Float),            -- score numérico interno
qualification_notes,               -- notas del agente sobre el cliente
-- Estado CRM
status (nuevo / contactado / calificado / visito / oferto / cerrado / perdido),
lost_reason,
-- Asignación
assigned_agent_id (FK → User),
-- Auditoría
created_at, updated_at, last_contact_at, archived (boolean)
```

---

### `Appointment` — Citas de visita
```
id,
client_id (FK → Client),
property_id (FK → Property),
agent_id (FK → User),              -- agente que acompaña la visita
-- Horario acordado
scheduled_at,
duration_minutes (default 60),
-- Estado
status (pendiente / confirmada / reagendada / cancelada / realizada / no_asistio),
cancellation_reason,
rescheduled_from_id (FK self),     -- si es un reagendamiento
-- Solicitud original del cliente
requested_times (Json),            -- horarios que el cliente propuso
-- Caso especial
is_special_case (boolean),         -- cliente no puede en franjas disponibles
special_case_notes,                -- qué coordinar manualmente
-- Comunicaciones enviadas
confirmation_sent (boolean),
reminder_24h_sent (boolean),
reminder_1h_sent (boolean),
-- Notas
notes,
-- Auditoría
created_at, updated_at
```

---

### `Availability` — Disponibilidad de los agentes internos
```
id,
user_id (FK → User),               -- solo agentes (role = agent)
day_of_week (Int 0-6),             -- 0=domingo, 1=lunes...
start_time,                        -- ej: "09:00"
end_time,                          -- ej: "13:00"
valid_from (Date, nullable),       -- si es temporal
valid_until (Date, nullable),
is_blocked (boolean),              -- bloqueo puntual (vacaciones, etc.)
block_reason,
created_at
```
> La disponibilidad del propietario se define en `Property.visit_time_slots`.
> El agente IA cruza ambas para encontrar horarios posibles.

---

### `Conversation` — Conversaciones con el agente IA
```
id,
client_id (FK, nullable),          -- puede ser desconocido al inicio
channel (voz / whatsapp / web),
started_at, ended_at, duration_seconds,
transcript (Text),                 -- transcripción completa
summary (Text),                    -- resumen generado por IA
interest_detected (Int 1-5),       -- nivel de interés detectado por IA
interest_override (Int, nullable), -- sobreescrito manualmente por agente
interest_override_note,            -- nota obligatoria si se sobreescribe
topics (String[]),                 -- temas discutidos
outcome (calificado / cita_agendada / sin_interes / no_responde / caso_especial / seguimiento),
recording_url,
created_at
```

---

### `ConversationTurn` — Mensajes individuales de la conversación
```
id, conversation_id (FK),
role (user / assistant),
content (Text),
timestamp,
intent_detected,                   -- intención detectada en ese turno
tool_calls (Json)                  -- tools llamadas por el agente en ese turno
```

---

### `KpiSnapshot` — Histórico diario de métricas
```
id, date,
total_properties,
available_properties,
new_clients,
qualified_clients,
appointments_scheduled,
appointments_completed,
appointments_cancelled,
conversations_total,
avg_interest_level,
conversion_rate_contact_to_visit,
conversion_rate_visit_to_offer,
created_at
```

---

### Tablas para etapas futuras (creadas vacías en Etapa 1)

**`ProspectedProperty`** — Inmuebles propuestos por el agente captador (Etapa 3)
```
id, source_url, source_portal, raw_data (Json), parsed_data (Json),
status (pendiente / aprobado / rechazado),
reviewed_by_id (FK → User), review_notes,
property_id (FK, nullable),        -- si fue aprobado y creado
created_at, reviewed_at
```

**`MediaAsset`** — Reels y videos generados (Etapa 4)
```
id, property_id (FK, nullable),
type (reel / video / imagen / carousel / post),
platform (instagram / tiktok / youtube / whatsapp),
title, script (Text), file_url, thumbnail_url, duration_seconds,
status (borrador / en_produccion / listo / publicado),
published_at, generated_by_agent, created_at
```

**`Campaign`** — Campañas de WhatsApp (Etapa 5)
```
id, name, type (whatsapp / email),
target_segment (Json),
message_template (Text), media_asset_id (FK, nullable),
status (borrador / programada / enviando / completada / pausada),
scheduled_at, started_at, completed_at,
total_recipients, sent_count, delivered_count, read_count, reply_count,
created_by_id (FK → User), created_at
```

**`AgentLog`** — Registro de actividad de todos los agentes IA
```
id, agent_name, action,
input (Json), output (Json),
tokens_input, tokens_output, duration_ms,
status (ok / error), error_message,
related_entity_type, related_entity_id,
created_at
```

---

## 🤖 Agentes IA

### Arquitectura
Cada agente es un módulo independiente. Se comunican vía bus de eventos (Redis/BullMQ),
nunca llamándose directamente. Todo agente registra su actividad en `AgentLog`.

```
  Twilio / Voz
       │
  agent-assistant ──→ Event Bus ──→ agent-content
                                ──→ agent-campaigns
                                ──→ agent-prospector
                                       │
                              Revisión humana en panel
```

Cada agente vive en `/packages/backend/src/agents/{nombre}/`:
```
index.ts       # Entry point y suscripción a eventos
tools.ts       # Tools para Anthropic tool use
prompts.ts     # System prompt — NUNCA hardcodear en otro lugar
handlers.ts    # Lógica de negocio del agente
```

---

### `agent-assistant` — Atención al cliente (Etapa 2)

**Nombre visible**: "Sofía" (configurable desde panel de Configuración)
**Canales**: WhatsApp + llamada de voz
**Tono**: Cálido, profesional, sin presionar al cliente

**Flujo de conversación**:
1. Saluda, se presenta, identifica canal
2. Pregunta qué busca el cliente (compra/arriendo, tipo, zona, presupuesto)
3. Califica: extrae preferencias, urgencia, capacidad real de compra
4. Busca inmuebles en BD con `search_properties`
5. Presenta máximo 3 opciones, describe en lenguaje natural
6. Si hay interés → envía fotos con `send_property_media`
7. Si quiere visitar → cruza disponibilidad del propietario (del inmueble) y del agente
8. Si hay horario disponible → agenda con `schedule_appointment`
9. Si no hay horario compatible → marca caso especial, notifica al agente inmobiliario
10. Al cerrar → registra resumen, nivel de interés y outcome

**Escala de interés (1-5)**:
| Nivel | Señales | Acción |
|---|---|---|
| 5 — Muy interesado | Pregunta precio final, documentos, fecha disponible | Agendar urgente, notificar al agente |
| 4 — Interesado | Pide fotos, preguntas específicas, quiere visitar | Seguimiento activo |
| 3 — Explorando | Compara opciones, sin urgencia clara | Nutrir con contenido |
| 2 — Poco interés | Respuestas vagas, no quiere agendar | Mantener en lista fría |
| 1 — Sin interés | Solo curiosidad, no hay fit real | Registrar y cerrar amablemente |

**Tools disponibles**:
```typescript
search_properties(budget, type, operation, zones, bedrooms, features)
get_property_detail(property_id)
send_property_media(client_contact, property_id, media_type)
check_availability(property_id, agent_id, requested_dates)
schedule_appointment(client_id, property_id, agent_id, datetime)
reschedule_appointment(appointment_id, new_datetime)
cancel_appointment(appointment_id, reason)
flag_special_case(appointment_id, client_notes)
save_client(name, phone, email, budget, preferences)
update_client_interest(client_id, level, notes)
get_client_history(client_id)
log_conversation_summary(conversation_id, summary, interest, outcome)
```

**Restricción crítica**: El agente IA NUNCA menciona ni revela datos del propietario
(nombre, teléfono, email). Solo puede decir "el inmueble está disponible para visitar".

---

### `agent-prospector` — Captación de inmuebles (Etapa 3)

**Función**: Busca inmuebles en portales externos y propone al agente inmobiliario.

**Flujo**:
1. Se ejecuta por cron o bajo demanda desde el panel
2. Busca en portales configurados (Metrocuadrado, Finca Raíz, etc.)
3. Extrae y normaliza datos
4. Guarda en `ProspectedProperty` con status `pendiente`
5. Notifica al agente inmobiliario en el panel
6. El agente humano decide: Aprobar (crea `Property`) o Rechazar (registra razón)

**Regla absoluta**: El agente captador NUNCA crea un `Property` directamente.
Solo crea `ProspectedProperty`. La decisión siempre la toma el agente humano.

---

### `agent-content` — Reels y contenido (Etapa 4)

**Función**: Genera guiones para reels y contenido de valor para redes sociales.

**Se activa cuando**: Se aprueba un inmueble nuevo (evento `property.published`).

**Produce**: Guion de reel, caption para Instagram, texto para WhatsApp.

---

### `agent-video` — Edición de video (Etapa 4)

**Función**: Recibe instrucciones en lenguaje natural y genera/edita videos.

**Integración**: Creatomate o RunwayML para producción programática.

---

### `agent-campaigns` — Campañas WhatsApp (Etapa 5)

**Función**: Diseña y ejecuta campañas de WhatsApp segmentadas por perfil de cliente.

**Segmentación por**: nivel de interés, zona preferida, presupuesto, tipo de inmueble buscado.

---

### `agent-optimizer` — Inteligencia y análisis (Etapa 6)

**Función**: Analiza datos históricos, detecta patrones, sugiere mejoras al equipo.

---

## 🖥️ Panel de Administración — Diseño para no técnicos

### Principios de UX del panel
- **Lenguaje simple**: "Agregar inmueble" no "Create property record"
- **Acciones visibles**: los botones principales siempre a la vista, sin submenús
- **Sin jerga técnica**: nunca mostrar IDs, slugs ni términos de BD al usuario
- **Confirmación antes de borrar**: siempre pedir confirmación con texto claro
- **Errores en lenguaje humano**: "No se pudo guardar. Verifica que el precio esté completo." no "500 Internal Server Error"
- **Guardado automático**: formularios largos guardan borrador automáticamente
- **Ayuda contextual**: tooltip en cada campo explicando qué poner

---

### Módulo: Dashboard (todos los roles)

**Lo que ve el Admin**:
- Total inmuebles activos / reservados / vendidos
- Nuevos clientes esta semana vs semana anterior
- Citas realizadas vs programadas (tasa de asistencia)
- Embudo CRM: nuevo → contactado → calificado → visitó → cerró
- Inmuebles más consultados (por el agente IA)
- Clientes por nivel de interés (barras de colores)
- Gráfico de conversaciones del agente IA (últimos 30 días)
- Agentes con más citas del mes

**Lo que ve el Agente**:
- Solo sus inmuebles y sus clientes
- Sus citas de la semana
- Sus KPIs personales

---

### Módulo: Inmuebles (admin y agente)

**Listado**:
- Filtros: tipo, operación, zona, precio, estado, agente asignado
- Vista tarjeta o tabla (el usuario elige)
- Chip de color por estado (verde=disponible, amarillo=reservado, gris=inactivo)
- Búsqueda por nombre, dirección o barrio

**Formulario de agregar/editar** (diseñado para no técnicos):
- Sección 1 — Información básica: tipo, operación, título, descripción
- Sección 2 — Precio: precio, moneda, ¿es negociable?, administración
- Sección 3 — Características: habitaciones, baños, área, parqueadero, estrato, piso
- Sección 4 — Ubicación: dirección con autocompletado, mapa para ajustar pin
- Sección 5 — Fotos y videos: drag & drop, reorden con arrastre, eliminar con X
- Sección 6 — Características adicionales: chips seleccionables (piscina, gimnasio, etc.)
- Sección 7 — Datos del propietario: nombre, teléfono, email, notas (marcado como CONFIDENCIAL en la UI)
- Sección 8 — Disponibilidad para visitas: días de la semana + franjas horarias + instrucciones especiales
- Sección 9 — Publicación: toggle "Publicar en sitio web", toggle "Destacar en home"

**Acciones rápidas desde el listado**:
- Cambiar estado con un clic (disponible → reservado → vendido)
- Activar/desactivar publicación en sitio
- Asignar a otro agente
- Ver cómo se ve en el sitio público

---

### Módulo: Clientes (admin y agente)

**Listado**:
- Indicador visual de nivel de interés (1=rojo, 2=naranja, 3=amarillo, 4=verde claro, 5=verde)
- Filtros: nivel de interés, estado CRM, agente asignado, origen, fecha
- Búsqueda por nombre, teléfono o email

**Perfil del cliente**:
- Datos de contacto + botón de llamar / WhatsApp directo
- Preferencias detectadas por el agente IA
- Historial de conversaciones con resúmenes
- Citas agendadas (pasadas y futuras)
- Inmuebles que consultó
- Estado CRM con botón para avanzar al siguiente estado
- Campo de notas para el agente
- Nivel de interés con opción de sobreescribir (requiere nota)

---

### Módulo: Citas (admin y agente)

- Vista calendario semanal y mensual
- Citas por agente (filtro)
- Citas marcadas como caso especial con ícono distinto
- Al hacer clic en una cita: detalle completo + cliente + inmueble + agente
- Reagendar: selector de fecha y hora con verificación de disponibilidad
- Cancelar: campo de razón obligatorio
- Recordatorios automáticos: badge que muestra si ya se enviaron

---

### Módulo: Conversaciones (admin y agente)

- Listado de todas las conversaciones del agente IA
- Filtros: canal (voz/WhatsApp), outcome, nivel de interés, fecha
- Vista de conversación: transcript completo + resumen + grabación de voz
- Nivel de interés detectado por IA con opción de sobreescribir
- Botón "Crear cliente" si el cliente no fue identificado en la conversación

---

### Módulo: Captación (admin y agente) — Etapa 3

- Lista de inmuebles propuestos por el agente captador
- Cada propuesta muestra: fuente, precio, ubicación, fotos y datos extraídos
- Botones: **Aprobar** (crea el inmueble en el sistema) / **Rechazar** (campo de razón)
- Historial de propuestas aprobadas y rechazadas

---

### Módulo: Contenido y Reels (admin) — Etapa 4

- Galería de reels y contenido organizado por inmueble
- Estado de producción (borrador / listo / publicado)
- Ver guion generado + editar antes de producir
- Solicitar nuevo guion con instrucciones en lenguaje natural
- Subir video ya editado externamente
- Publicar a Instagram/TikTok desde el panel

---

### Módulo: Campañas (admin) — Etapa 5

- Crear campaña: nombre, seleccionar segmento de clientes, redactar mensaje
- El agente IA sugiere el mensaje y el segmento según el objetivo
- Adjuntar foto o reel de inmueble
- Programar envío o enviar ahora
- Métricas: enviados, entregados, leídos, respuestas

---

### Módulo: Equipo (solo admin)

- Lista de usuarios internos: nombre, rol, teléfono, estado (activo/inactivo)
- Crear nuevo usuario: nombre, email, rol, contraseña temporal
- Editar datos y rol
- Desactivar usuario (nunca eliminar)
- Ver disponibilidad del agente + citas asignadas

---

### Módulo: Configuración (solo admin)

Diseñado para que el gerente lo maneje sin ayuda técnica:

- **Datos de la empresa**: nombre, logo, colores principales, dirección, teléfono, email
- **Agente IA**: nombre ("Sofía"), personalidad (formal/amigable/neutral), idioma
- **WhatsApp**: número conectado, mensaje de bienvenida
- **Sitio web**: textos del home, inmuebles destacados, redes sociales
- **Notificaciones**: qué alertas recibe cada rol (nueva cita, cliente calificado, etc.)
- **Google Calendar**: conectar cuenta para sincronizar disponibilidad

---

## 🌐 Sitio Web Público

Vitrina de la inmobiliaria. Generado automáticamente desde los datos del panel.

**Páginas**:
- **Home**: inmuebles destacados, buscador rápido, contadores (X inmuebles, X años de experiencia)
- **Listado `/inmuebles`**: todos los inmuebles publicados con filtros (tipo, operación, zona, precio, habitaciones)
- **Detalle `/inmuebles/[slug]`**: galería de fotos, características, mapa, botones de contacto
- **Contacto**: formulario simple → genera lead en el CRM

**Botones de contacto en cada inmueble**:
- "Escribir por WhatsApp" → abre WhatsApp con mensaje predefinido → atiende el agente IA
- "Solicitar información" → formulario → genera lead → atiende el agente IA
- (Fase 2) "Llamar al agente" → conecta con el agente IA por voz

**SEO**:
- Meta title y description por inmueble
- Sitemap automático
- Datos estructurados Schema.org (RealEstateListing)
- URLs amigables: `/inmuebles/apartamento-2-habitaciones-chapinero-bogota`

**Personalización desde el panel**:
- Logo y colores de la inmobiliaria
- Textos del home (slogan, descripción)
- Inmuebles destacados (toggle en cada inmueble)
- Redes sociales en el footer

---

## ⚙️ Variables de Entorno

```env
# ─── APP ──────────────────────────────────────────────────
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
API_SECRET=                          # openssl rand -base64 32

# ─── BASE DE DATOS ────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/inmobiliaria
REDIS_URL=redis://localhost:6379

# ─── ANTHROPIC ────────────────────────────────────────────
ANTHROPIC_API_KEY=

# ─── VOZ ──────────────────────────────────────────────────
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=                 # ID de la voz de Sofía en ElevenLabs

DEEPGRAM_API_KEY=

# ─── WHATSAPP ─────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=              # Formato: whatsapp:+57XXXXXXXXXX

# ─── EMAIL ────────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=noreply@inmobiliaria.com

# ─── GOOGLE CALENDAR ──────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# ─── STORAGE ──────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ─── AUTH PANEL ───────────────────────────────────────────
NEXTAUTH_SECRET=                     # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# ─── ETAPA 4: GENERACIÓN DE VIDEO ─────────────────────────
CREATOMATE_API_KEY=
RUNWAYML_API_KEY=

# ─── ETAPA 5: REDES SOCIALES ──────────────────────────────
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

---

## 🔒 Reglas de Negocio Críticas

### Privacidad del propietario
1. Los campos `owner_name`, `owner_phone`, `owner_email` y `owner_notes` de `Property`
   son **estrictamente privados**. Nunca deben aparecer en:
   - El sitio web público
   - Las respuestas del agente IA al cliente final
   - Ningún endpoint público de la API
   Solo son visibles en el panel para usuarios con rol `admin` o `agent`.

### Integridad de datos
2. **Nunca eliminar** clientes, usuarios ni inmuebles de la BD.
   Siempre usar `archived: true` o `status: inactivo`.
3. **Toda conversación queda registrada** en `Conversation` y `ConversationTurn`,
   incluso si el cliente cuelga sin terminar.

### Citas y disponibilidad
4. El agente IA solo puede proponer horarios donde coincidan:
   - Las franjas definidas en `Property.visit_time_slots`
   - La disponibilidad del agente en `Availability`
5. Si no hay horario que coincida con lo que pide el cliente →
   marcar `Appointment.is_special_case = true` y notificar al agente inmobiliario
   para que coordine manualmente.
6. Recordatorio automático **24h antes** y **1h antes** de cada cita confirmada.
7. Al cancelar una cita → liberar el slot automáticamente en el calendario.

### Agente captador
8. El `agent-prospector` **nunca** crea un `Property` directamente.
   Solo crea `ProspectedProperty` con status `pendiente`.
   Un agente humano debe aprobar antes de que el inmueble entre al sistema.

### Nivel de interés
9. El nivel de interés lo calcula el agente IA automáticamente.
10. Un agente humano puede sobreescribirlo desde el panel,
    pero el campo `interest_override_note` es **obligatorio** — debe explicar por qué.

### Seguridad del panel
11. El panel de administración solo es accesible con autenticación.
12. Cada rol solo ve y puede editar lo que le corresponde (ver tabla de actores).
13. El Admin es el único que puede crear usuarios, cambiar roles y acceder a Configuración.

---

## 🚀 Etapas de Desarrollo

### Etapa 1 — Fundación: CRM + Sitio web público
**Entregable**: Sistema funcional que la inmobiliaria puede usar desde el día 1,
sin ningún agente IA. Gestión completa de inmuebles, clientes y citas.

1. Monorepo setup (npm workspaces, TypeScript, ESLint, Prettier)
2. Schema Prisma completo + primera migración (todas las tablas, etapas futuras vacías)
3. Seed de datos de prueba realistas
4. API REST completa: inmuebles, clientes, agentes-staff, citas, disponibilidad, dashboard
5. Autenticación NextAuth con roles (admin, agent, assistant)
6. Panel — módulo Inmuebles (formulario completo, fotos, mapa, disponibilidad)
7. Panel — módulo Clientes
8. Panel — módulo Citas y calendario de disponibilidad
9. Panel — módulo Dashboard KPIs
10. Sitio web público (home, listado, detalle, SEO, formulario de contacto)
11. Panel — módulo Equipo y Configuración
12. Tests + deploy staging

### Etapa 2 — Agente de atención al cliente
**Entregable**: Sofía atiende clientes por WhatsApp y voz 24/7.

1. Webhook Twilio WhatsApp (recibir y enviar mensajes)
2. `agent-assistant` con tool use en texto (sin voz primero)
3. Lógica de cruce de disponibilidad + detección de casos especiales
4. Envío automático de fotos por WhatsApp
5. Integración voz: ElevenLabs (TTS) + Deepgram (STT)
6. Panel — módulo Conversaciones
7. Recordatorios automáticos de citas (24h y 1h antes)
8. Notificación al agente cuando hay caso especial o cliente nivel 5
9. Tests + deploy

### Etapa 3 — Agente captador de inmuebles
**Entregable**: El sistema propone inmuebles nuevos; el agente decide.

1. `agent-prospector` con scraping de portales configurables
2. Normalización, deduplicación y validación de datos extraídos
3. Panel — módulo Captación (aprobar/rechazar con notas)
4. Notificación automática al agente cuando hay nuevas propuestas
5. Tests + deploy

### Etapa 4 — Agentes de contenido y video
**Entregable**: Generación automática de reels y contenido para redes.

1. Bus de eventos Redis/BullMQ
2. `agent-content` (guiones de reels + posts de valor)
3. `agent-video` (edición por instrucciones en lenguaje natural)
4. Integración Creatomate o RunwayML
5. Panel — módulo Contenido y Reels
6. Publicación directa a Instagram y TikTok
7. Tests + deploy

### Etapa 5 — Agente de campañas WhatsApp
**Entregable**: Campañas segmentadas que generan interés y citas.

1. `agent-campaigns` con motor de segmentación
2. Editor de campañas en el panel (lenguaje natural + variables dinámicas)
3. Programación y ejecución de envíos masivos
4. Métricas de campaña en tiempo real
5. Panel — módulo Campañas
6. Tests + deploy

### Etapa 6 — Inteligencia y optimización
**Entregable**: El sistema aprende y ayuda a tomar mejores decisiones.

1. `agent-optimizer` con análisis de patrones históricos
2. Predicción de probabilidad de cierre por cliente
3. Sugerencias de precio comparadas con el mercado
4. Reportes automáticos semanales por email al admin
5. Panel — módulo de analíticas avanzadas
6. Tests + deploy producción definitivo

---

## 📋 Convenciones de Código

- **TypeScript estricto** (`strict: true`) en todo el proyecto
- **Async/await** siempre — nunca callbacks ni `.then()` encadenados
- **Zod** para validar todo dato entrante: requests, env vars, responses de la API de IA
- **Prisma** para todos los queries — SQL raw solo en analytics complejos, con comentario
- **Errores**: siempre capturar con contexto `{ error, context: { userId, entityId, action } }`
- **Comentarios**: en español, explicando el "por qué", no el "qué"
- **Naming**: camelCase para variables/funciones, PascalCase para clases/componentes, snake_case en BD
- **API responses**: siempre `{ success: boolean, data?: T, error?: string, meta?: {} }`
- **Logs**: incluir siempre la entidad relevante (propertyId, clientId, conversationId)
- **Textos de UI**: siempre en español, en lenguaje simple y directo

---

## 📎 Instrucciones para Claude Code

- **Leer este CLAUDE.md completo al inicio de cada sesión** antes de tocar cualquier archivo
- Al crear un endpoint → actualizar `/docs/api.md` con método, ruta, parámetros y response
- Al agregar variable de entorno → agregarla también en `.env.example` con comentario descriptivo
- Al crear un agente → documentarlo en `/docs/agents.md` (propósito, tools, eventos, restricciones)
- **Nunca editar una migración existente** — siempre `npx prisma migrate dev --name descripcion`
- **Nunca hardcodear** textos de prompts fuera de `agents/{nombre}/prompts.ts`
- **Nunca hardcodear** URLs, IDs ni configuración — siempre desde variables de entorno
- Las tablas de etapas futuras se crean en Etapa 1 sin lógica de negocio — solo el schema
- Al implementar cualquier lógica de citas → verificar reglas de negocio 4, 5, 6 y 7
- Al tocar cualquier campo del propietario → verificar regla de negocio 1
- Los textos del panel deben seguir el principio de diseño para no técnicos — lenguaje simple siempre
