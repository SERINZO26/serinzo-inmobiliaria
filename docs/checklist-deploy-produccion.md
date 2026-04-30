# Checklist de Deploy — Sistema Inmobiliario con IA
## Pasos para poner el sistema en producción con un cliente real

---

## DATOS DEL CLIENTE
Nombre de la inmobiliaria: ________________________________
Dominio elegido: ________________________________
Número de WhatsApp Business: ________________________________
Fecha acordada de entrega: ________________________________

---

## FASE 1 — ANTES DEL DEPLOY (hacer antes de tocar servidores)

### Personalización del sistema
- [ ] Completar checklist-personalizacion-etapa1.md
- [ ] Cambiar nombre de la inmobiliaria en todo el código
- [ ] Cambiar número de WhatsApp
- [ ] Cambiar teléfono y email de contacto
- [ ] Cambiar textos del home (slogan, descripción)
- [ ] Subir logo de la inmobiliaria
- [ ] Ajustar colores si el cliente tiene marca definida
- [ ] Crear usuarios reales del equipo
- [ ] Cargar mínimo 5 inmuebles reales con fotos
- [ ] Verificar que `tsc --noEmit` pasa sin errores en backend y frontend

---

## FASE 2 — REGISTRAR SERVICIOS (un solo registro por cliente)

### Dominio
- [ ] Ir a **namecheap.com** o **porkbun.com**
- [ ] Buscar el dominio elegido (ej: inmobiliarialopez.com)
- [ ] Comprar — costo: $8-12 USD/año
- [ ] Dominio registrado: ________________________________

### Railway (backend + base de datos)
- [ ] Ir a **railway.app** → crear cuenta o usar la existente
- [ ] New Project → Create from GitHub
- [ ] Seleccionar el repositorio del proyecto
- [ ] Configurar Root Directory: `packages/backend`
- [ ] Railway crea automáticamente el servicio
- [ ] Agregar base de datos: New → Database → PostgreSQL
- [ ] Copiar la DATABASE_URL que genera Railway: ________________________________
- [ ] URL del backend generada por Railway: ________________________________

### Vercel (frontend)
- [ ] Ir a **vercel.com** → crear cuenta o usar la existente
- [ ] New Project → Import desde GitHub
- [ ] Seleccionar el repositorio
- [ ] Root Directory: `packages/frontend`
- [ ] Framework Preset: Next.js (lo detecta automáticamente)
- [ ] URL del frontend generada por Vercel: ________________________________

---

## FASE 3 — CONFIGURAR VARIABLES DE ENTORNO EN PRODUCCIÓN

### En Railway (backend)
Ir a tu servicio → Variables → agregar una por una:

```
NODE_ENV=production
DATABASE_URL=          # la que generó Railway automáticamente
API_SECRET=            # openssl rand -base64 32 (generar nuevo)
PORT=4000

ANTHROPIC_API_KEY=     # de console.anthropic.com
ELEVENLABS_API_KEY=    # de elevenlabs.io
ELEVENLABS_VOICE_ID=   # ID de la voz de Sofía

TWILIO_ACCOUNT_SID=    # de twilio.com
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

RESEND_API_KEY=        # de resend.com
EMAIL_FROM=            # noreply@dominio-del-cliente.com

GOOGLE_CLIENT_ID=      # si usan Google Calendar
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=   # https://dominio-del-cliente.com/api/auth/callback/google

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] Todas las variables agregadas en Railway
- [ ] Railway hace redeploy automático al guardar variables

### En Vercel (frontend)
Ir a tu proyecto → Settings → Environment Variables:

```
NEXTAUTH_URL=          # https://dominio-del-cliente.com
NEXTAUTH_SECRET=       # openssl rand -base64 32 (diferente al API_SECRET)
NEXT_PUBLIC_API_URL=   # https://url-backend.railway.app

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] Todas las variables agregadas en Vercel
- [ ] Vercel hace redeploy automático

---

## FASE 4 — CONECTAR EL DOMINIO

### Apuntar dominio a Vercel
- [ ] En Vercel → tu proyecto → Settings → Domains
- [ ] Agregar el dominio: `tuinmobiliaria.com`
- [ ] Vercel muestra los registros DNS que debes agregar
- [ ] Ir al panel de Namecheap/Porkbun → DNS Management
- [ ] Agregar los registros que indica Vercel:
  - Tipo A → apunta a IP de Vercel
  - Tipo CNAME → www apunta a cname.vercel-dns.com
- [ ] Esperar propagación DNS: 15 minutos — 24 horas
- [ ] Verificar que https://tuinmobiliaria.com carga el sitio
- [ ] Verificar que el certificado SSL está activo (candado verde)

### Actualizar URL del backend en Railway
- [ ] En Railway → Settings → Domains
- [ ] Generar dominio personalizado o usar el de Railway
- [ ] Actualizar NEXT_PUBLIC_API_URL en Vercel con la URL final del backend

---

## FASE 5 — EJECUTAR MIGRACIONES EN PRODUCCIÓN

Desde tu computador local, apuntando a la BD de producción:

```bash
# Temporalmente cambiar DATABASE_URL en tu .env local
# a la URL de producción de Railway

cd packages/backend
npx prisma migrate deploy    # aplica migraciones en producción
npx prisma db seed           # carga datos iniciales

# Restaurar DATABASE_URL local después
```

- [ ] Migraciones aplicadas en BD de producción
- [ ] Seed ejecutado (usuarios iniciales creados)
- [ ] Restaurar .env local con BD de desarrollo

---

## FASE 6 — CONFIGURAR WHATSAPP EN PRODUCCIÓN

### Opción A — Número propio del cliente (recomendada)
- [ ] El cliente tiene número de WhatsApp Business activo
- [ ] Ir a **business.facebook.com** → crear Meta Business Manager si no existe
- [ ] En Twilio Console → Messaging → Senders → WhatsApp Senders
- [ ] Conectar el número del cliente con Meta Business API
- [ ] Meta envía código de verificación al número → ingresarlo
- [ ] Número verificado y activo en Twilio

### Opción B — Sandbox de Twilio (solo si A no es posible)
- [ ] Usar el sandbox de Twilio
- [ ] Documentar al cliente que sus contactos deben enviar el código de activación una vez

### Configurar webhook de WhatsApp
- [ ] En Twilio Console → Messaging → Settings → WhatsApp Sandbox/Sender
- [ ] En "When a message comes in" poner:
  `https://url-backend.railway.app/api/v1/webhooks/whatsapp`
- [ ] Método: HTTP POST
- [ ] Guardar y verificar

- [ ] Enviar mensaje de prueba al número → Sofía responde en producción

---

## FASE 7 — CONFIGURAR EMAIL (Resend)

- [ ] Ir a **resend.com** → Domains → Add Domain
- [ ] Agregar el dominio del cliente: `tuinmobiliaria.com`
- [ ] Resend muestra registros DNS para verificar
- [ ] Agregar registros DNS en Namecheap/Porkbun
- [ ] Verificar dominio en Resend (tarda 5-15 minutos)
- [ ] Actualizar EMAIL_FROM en Railway: `noreply@tuinmobiliaria.com`
- [ ] Enviar email de prueba para verificar

---

## FASE 8 — VERIFICACIÓN FINAL EN PRODUCCIÓN

### Sitio web público
- [ ] https://tuinmobiliaria.com carga correctamente
- [ ] Los inmuebles aparecen con fotos reales
- [ ] El buscador filtra correctamente
- [ ] El detalle de inmueble carga con galería y mapa
- [ ] El botón de WhatsApp abre el número correcto
- [ ] El formulario de contacto crea el lead en el CRM
- [ ] El sitio se ve bien en móvil

### Panel de administración
- [ ] https://tuinmobiliaria.com/login carga
- [ ] Login con credenciales reales funciona
- [ ] Dashboard muestra KPIs
- [ ] Se puede crear un inmueble con fotos reales
- [ ] Las fotos suben a Cloudinary correctamente
- [ ] Se puede crear y editar un cliente
- [ ] Se puede agendar una cita
- [ ] Módulo de conversaciones muestra las de Sofía

### Sofía en producción
- [ ] Enviar mensaje al WhatsApp real → Sofía responde
- [ ] Sofía busca inmuebles de la BD de producción
- [ ] Sofía puede agendar citas
- [ ] Las conversaciones aparecen en el panel

### Seguridad
- [ ] Credenciales del seed desactivadas (admin@inmobiliaria.com)
- [ ] .env y .env.local NO están en el repositorio git
- [ ] Las rutas del panel redirigen a login sin sesión
- [ ] Los datos del propietario NO aparecen en el sitio público
- [ ] HTTPS activo en todos los dominios

---

## FASE 9 — ENTREGA AL CLIENTE

### Documentos a entregar
- [ ] URL del sitio web: ________________________________
- [ ] URL del panel: ________________________________/login
- [ ] Lista de usuarios con contraseñas temporales
- [ ] Instrucciones para cambiar contraseña
- [ ] Este checklist completado como respaldo

### Capacitación (1-2 horas)
- [ ] Cómo agregar y editar inmuebles con fotos
- [ ] Cómo gestionar clientes en el CRM
- [ ] Cómo ver y gestionar citas
- [ ] Cómo leer el dashboard de KPIs
- [ ] Cómo ver las conversaciones de Sofía
- [ ] Cómo cambiar configuración básica
- [ ] Cómo contactarte para soporte

### Contrato y pago
- [ ] Contrato de soporte mensual firmado
- [ ] Primer mes de fee cobrado
- [ ] Domiciliación bancaria configurada (si aplica)
- [ ] Canal de soporte acordado (WhatsApp, email)

---

## COSTOS ESTIMADOS POR CLIENTE

| Concepto | Costo único | Costo mensual |
|---|---|---|
| Dominio .com | $8 USD ($33.000 COP) | $2.750 COP |
| Railway (backend + BD) | $0 | $42.000 COP |
| Vercel (frontend) | $0 | $0 |
| Cloudinary (fotos) | $0 | $0 |
| Anthropic API | $0 | $10.000 — $50.000 COP |
| Twilio WhatsApp | $0 | $15.000 — $60.000 COP |
| Resend (email) | $0 | $0 |
| **Total** | **$33.000 COP** | **$70.000 — $155.000 COP** |

**Tu margen con fee de $200.000/mes: $45.000 — $130.000 por cliente**

---

## COMANDOS DE REFERENCIA RÁPIDA

```bash
# Generar secrets seguros
openssl rand -base64 32

# Aplicar migraciones en producción
npx prisma migrate deploy

# Ver logs del backend en Railway
railway logs

# Redeploy manual en Railway
railway up

# Verificar variables de entorno en Railway
railway variables
```

---

*Versión 1.0 — Sistema Inmobiliario con IA*
*Actualizar con cada nuevo cliente*
