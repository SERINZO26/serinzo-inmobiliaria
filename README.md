# Sistema Inmobiliario con Agentes IA

Sistema completo para inmobiliarias que combina CRM, sitio web público y agentes de inteligencia artificial. Diseñado para ser administrado por cualquier persona sin conocimientos técnicos.

## Etapas de desarrollo

| Etapa | Nombre | Objetivo |
|---|---|---|
| **1** | Fundacion: CRM + Sitio web | Sistema funcional desde el dia 1: gestion completa de inmuebles, clientes y citas sin IA |
| **2** | Agente de atencion al cliente | Sofia atiende clientes por WhatsApp y voz 24/7, agenda citas y califica leads |
| **3** | Agente captador de inmuebles | El sistema propone nuevos inmuebles desde portales externos; el agente humano aprueba |
| **4** | Agentes de contenido y video | Generacion automatica de reels y contenido para redes sociales |
| **5** | Agente de campanas WhatsApp | Campanas segmentadas que generan interes y citas |
| **6** | Inteligencia y optimizacion | El sistema aprende, predice y ayuda a tomar mejores decisiones |

## Instalacion

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd inmobiliaria-sistema

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Instalar dependencias
npm install

# 4. Configurar la base de datos
npm run db:migrate --workspace=packages/backend

# 5. Cargar datos de prueba
npm run db:seed --workspace=packages/backend

# 6. Iniciar en modo desarrollo
npm run dev
```

El panel de administracion estara disponible en `http://localhost:3000`.
La API estara disponible en `http://localhost:4000`.

## Variables de entorno

Copia `.env.example` a `.env` y completa cada valor:

| Variable | Donde conseguirla |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) — panel de usuario |
| `ELEVENLABS_VOICE_ID` | ElevenLabs — ID de la voz creada para Sofia |
| `DEEPGRAM_API_KEY` | [deepgram.com](https://deepgram.com) — console |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | [twilio.com/console](https://twilio.com/console) |
| `TWILIO_WHATSAPP_NUMBER` | Twilio — numero de WhatsApp Business aprobado |
| `RESEND_API_KEY` | [resend.com](https://resend.com) — API Keys |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console — OAuth 2.0 |
| `CLOUDINARY_*` | [cloudinary.com](https://cloudinary.com) — Dashboard |
| `NEXTAUTH_SECRET` | Generar con: `openssl rand -base64 32` |
| `API_SECRET` | Generar con: `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL local o servicio como Railway/Supabase |
| `REDIS_URL` | Redis local o servicio como Upstash |
| `CREATOMATE_API_KEY` | [creatomate.com](https://creatomate.com) — Etapa 4 |
| `RUNWAYML_API_KEY` | [runwayml.com](https://runwayml.com) — Etapa 4 |
| `META_APP_ID` / `META_APP_SECRET` | Meta for Developers — Etapa 5 |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok for Developers — Etapa 5 |

## Stack tecnico

- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL
- **Frontend**: Next.js 14 + Tailwind CSS + shadcn/ui + NextAuth.js
- **Agentes IA**: Claude claude-sonnet-4-20250514 (Anthropic) con tool use
- **Mensajeria**: Twilio WhatsApp Business API
- **Voz**: ElevenLabs (TTS) + Deepgram (STT)
- **Storage**: Cloudinary
- **Colas**: Redis + BullMQ

## Estructura del proyecto

```
/
├── packages/
│   ├── backend/          # API REST + Agentes IA
│   └── frontend/         # Panel admin + Sitio web publico
├── docs/                 # Documentacion tecnica
├── .env.example          # Variables de entorno (plantilla)
└── CLAUDE.md             # Instrucciones para el agente de desarrollo
```

Consulta `/docs` para documentacion detallada de la API, agentes, base de datos y despliegue.
