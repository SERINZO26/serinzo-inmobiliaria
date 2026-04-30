# Checklist de Personalización — Etapa 1
# Sistema Inmobiliario con Agentes IA
# Usar este archivo cada vez que se entregue el sistema a un nuevo cliente

---

## DATOS DEL CLIENTE
Nombre de la inmobiliaria: ________________________________
Persona de contacto: ________________________________
Email: ________________________________
Teléfono / WhatsApp: ________________________________
Dirección oficina: ________________________________
Ciudad: ________________________________
Dominio web: ________________________________
Fecha de entrega: ________________________________

---

## PASO 1 — REGISTRAR SERVICIOS EXTERNOS

### Cloudinary (fotos de inmuebles) — OBLIGATORIO
- [ ] Ir a cloudinary.com → Sign Up (gratis)
- [ ] Confirmar email
- [ ] Ir a Dashboard → copiar estos 3 datos:
      Cloud Name: ________________________________
      API Key: ________________________________
      API Secret: ________________________________
- [ ] Guardar en un lugar seguro — los necesitas en el Paso 3

### Google Maps embed — NO requiere registro
- [ ] No necesitas API key para el mapa básico
- [ ] Solo necesitas la dirección exacta del cliente para el iframe

---

## PASO 2 — PREPARAR LA BASE DE DATOS

- [ ] Instalar PostgreSQL en el servidor de producción
      O crear una base de datos en Railway: railway.app → New Project → PostgreSQL
- [ ] Copiar la DATABASE_URL que genera Railway:
      DATABASE_URL: ________________________________
- [ ] Crear la base de datos con el nombre del cliente:
      Ejemplo: inmobiliaria_nombre_cliente

---

## PASO 3 — CONFIGURAR VARIABLES DE ENTORNO

### Backend — archivo packages/backend/.env
Abrir el archivo y reemplazar estos valores:

```
DATABASE_URL=        # pegar la URL del Paso 2
API_SECRET=          # generar con: openssl rand -base64 32
NODE_ENV=production
PORT=4000
```

Copiar el API_SECRET generado aquí: ________________________________

### Frontend — archivo packages/frontend/.env.local
Abrir el archivo y reemplazar estos valores:

```
NEXTAUTH_URL=        # https://dominio-del-cliente.com
NEXTAUTH_SECRET=     # generar con: openssl rand -base64 32 (diferente al anterior)
NEXT_PUBLIC_API_URL= # https://api.dominio-del-cliente.com

CLOUDINARY_CLOUD_NAME=   # del Paso 1
CLOUDINARY_API_KEY=      # del Paso 1
CLOUDINARY_API_SECRET=   # del Paso 1
```

- [ ] Backend .env configurado
- [ ] Frontend .env.local configurado
- [ ] Variables de Cloudinary agregadas

---

## PASO 4 — PERSONALIZAR EL CÓDIGO

### 4.1 Número de WhatsApp
Buscar en todo el proyecto: wa.me/57300000000
Reemplazar por: wa.me/57{número_real_del_cliente}

Archivos donde aparece (verificar todos):
- [ ] src/app/(public)/inmuebles/[slug]/page.tsx
- [ ] src/app/(public)/layout.tsx (botón WhatsApp del header)
- [ ] Buscar en todo el proyecto por si hay más ocurrencias

Número WhatsApp del cliente: ________________________________

### 4.2 Teléfono de contacto
Buscar: +57 300 000 0000
Reemplazar por el teléfono real del cliente

Archivos donde aparece:
- [ ] src/app/(public)/contacto/page.tsx
- [ ] src/app/(public)/layout.tsx (footer)

Teléfono del cliente: ________________________________

### 4.3 Email de contacto
Buscar: info@inmobiliaria.com
Reemplazar por el email real del cliente

Archivos donde aparece:
- [ ] src/app/(public)/contacto/page.tsx
- [ ] src/app/(public)/layout.tsx (footer)
- [ ] packages/backend/.env → EMAIL_FROM

Email del cliente: ________________________________

### 4.4 Nombre de la inmobiliaria
Buscar: "Sistema Inmobiliario"
Reemplazar por el nombre real

Archivos donde aparece:
- [ ] src/app/layout.tsx (metadata)
- [ ] src/app/(public)/layout.tsx (header y footer)
- [ ] src/app/login/page.tsx (título del login)
- [ ] src/app/(public)/page.tsx (hero y secciones)

Nombre de la inmobiliaria: ________________________________

### 4.5 Textos del home
Editar en src/app/(public)/page.tsx:
- [ ] Slogan del hero: "Encuentra tu próximo hogar"
      Nuevo texto: ________________________________
- [ ] Subtítulo del hero: "Te ayudamos a encontrar el inmueble perfecto"
      Nuevo texto: ________________________________
- [ ] Contador "Años de experiencia": 10
      Nuevo valor: ________________________________
- [ ] Contador "Clientes satisfechos": 200+
      Nuevo valor: ________________________________

### 4.6 Dirección de la oficina
Editar en src/app/(public)/contacto/page.tsx:
- [ ] Dirección: ________________________________
- [ ] Horario de atención: ________________________________
- [ ] Actualizar iframe del mapa con la dirección real:
      Buscar el src del iframe y cambiar el parámetro q= por la dirección del cliente

### 4.7 Colores (opcional)
Si el cliente tiene colores de marca específicos, editar:
- [ ] src/app/globals.css → variables CSS de colores primarios
      Color primario del cliente (hex): ________________________________

---

## PASO 5 — EJECUTAR MIGRACIONES EN PRODUCCIÓN

En el servidor de producción, desde packages/backend:

```bash
npx prisma migrate deploy
npx prisma db seed
```

- [ ] Migraciones aplicadas correctamente
- [ ] Seed ejecutado (crea usuarios iniciales de prueba)

---

## PASO 6 — CREAR USUARIOS REALES

Iniciar sesión en el panel con las credenciales del seed:
- admin@inmobiliaria.com / Admin2024!

Ir a /equipo → Agregar usuario para cada persona del equipo:

| Nombre | Email | Rol | Contraseña entregada |
|--------|-------|-----|---------------------|
| | | Admin | |
| | | Agente | |
| | | Agente | |
| | | Asistente | |

- [ ] Usuarios reales creados
- [ ] Contraseñas seguras asignadas (mínimo 10 caracteres, mayúscula, número, símbolo)
- [ ] Usuario de seed desactivado o eliminado:
      admin@inmobiliaria.com → desactivar desde /equipo
      carlos@inmobiliaria.com → desactivar desde /equipo

---

## PASO 7 — CARGAR CONTENIDO INICIAL

- [ ] Agregar mínimo 5 inmuebles reales con fotos desde /inmuebles → Agregar inmueble
- [ ] Verificar que las fotos suben correctamente a Cloudinary
- [ ] Marcar 2-3 inmuebles como "Destacados" para el home
- [ ] Verificar que los inmuebles aparecen en el sitio público

### Configuración inicial de la empresa (NUEVO)
Ir a /admin/configuracion → tab "Mi empresa":
- [ ] Subir logo de la inmobiliaria (PNG o JPG, fondo transparente ideal)
- [ ] Nombre de la inmobiliaria
- [ ] Teléfono de contacto
- [ ] Email de contacto
- [ ] Dirección de la oficina
- [ ] Ciudad
- [ ] Guardar cambios
Esta información aparece en los PDFs de liquidación de arriendo y en el panel.

### Configuración del agente Sofía
Ir a /admin/configuracion → tab "Agente IA":
- [ ] Nombre del agente (default: Sofía)
- [ ] Tono (Amigable / Profesional / Neutral)
- [ ] Mensaje de bienvenida personalizado
- [ ] Guardar cambios

---

## PASO 8 — DEPLOY EN PRODUCCIÓN

### Backend en Railway
- [ ] Crear cuenta en railway.app
- [ ] New Project → Deploy from GitHub repo
- [ ] Seleccionar la carpeta packages/backend como root
- [ ] Agregar todas las variables de entorno del .env
- [ ] Verificar que el deploy fue exitoso
- [ ] Copiar la URL del backend: ________________________________
- [ ] Actualizar NEXT_PUBLIC_API_URL en el frontend con esa URL

### Frontend en Vercel
- [ ] Crear cuenta en vercel.com
- [ ] New Project → Import desde GitHub
- [ ] Root directory: packages/frontend
- [ ] Agregar todas las variables de entorno del .env.local
- [ ] Verificar que el deploy fue exitoso
- [ ] Copiar la URL del frontend: ________________________________

### Conectar dominio
- [ ] En Vercel: Settings → Domains → agregar dominio del cliente
- [ ] En el proveedor de dominio del cliente: apuntar DNS a Vercel
      (Vercel muestra las instrucciones exactas)
- [ ] Verificar que https://dominio-del-cliente.com carga correctamente
- [ ] Verificar que el certificado SSL está activo (candado verde)

---

## PASO 9 — VERIFICACIÓN FINAL

### Sitio web público
- [ ] Home carga con inmuebles destacados
- [ ] Listado muestra los inmuebles cargados
- [ ] Detalle de inmueble muestra fotos, mapa y botones de contacto
- [ ] Botón WhatsApp abre el número correcto
- [ ] Formulario de contacto crea el lead en el CRM
- [ ] El sitio se ve bien en móvil

### Panel de administración
- [ ] Login funciona con las credenciales reales del cliente
- [ ] Dashboard muestra KPIs y widget de contratos próximos a vencer
- [ ] Se puede crear y editar un inmueble con fotos
- [ ] Se puede crear y editar un cliente
- [ ] Se puede agendar una cita
- [ ] Módulo Arriendos: crear contrato, genera pagos automáticamente
- [ ] Módulo Arriendos: registrar pago con comprobante y arreglos
- [ ] Módulo Arriendos: generar PDF de liquidación con logo y datos empresa
- [ ] Módulo Ventas: registrar venta con comisión calculada
- [ ] Módulo Equipo muestra los usuarios creados
- [ ] Configuración: logo, datos empresa y Sofía guardados correctamente

### Seguridad
- [ ] Las credenciales del seed están desactivadas
- [ ] El .env y .env.local NO están en el repositorio git
- [ ] Las rutas del panel redirigen a login si no hay sesión
- [ ] Los datos del propietario NO aparecen en el sitio público

---

## PASO 10 — ENTREGA AL CLIENTE

### Documentos a entregar
- [ ] URL del sitio web público
- [ ] URL del panel de administración (/login)
- [ ] Lista de usuarios creados con sus contraseñas temporales
- [ ] Instrucciones para cambiar contraseña (desde /configuracion → Cuenta)
- [ ] Guía rápida de uso del panel (ver guia-usuario.md)

### Capacitación (recomendada 2-3 horas)
- [ ] Mostrar cómo agregar y editar inmuebles con fotos
- [ ] Mostrar cómo gestionar clientes en el CRM
- [ ] Mostrar cómo agendar y gestionar citas
- [ ] Mostrar cómo crear un contrato de arriendo y sus pagos mensuales
- [ ] Mostrar cómo registrar un pago con arreglos y subir comprobante
- [ ] Mostrar cómo generar el PDF de liquidación para el propietario
- [ ] Mostrar cómo registrar una venta con su comisión
- [ ] Mostrar el dashboard de KPIs y alertas de contratos
- [ ] Mostrar cómo editar la configuración (logo, datos, Sofía)
- [ ] Resolver dudas

### Post-entrega
- [ ] Dejar canal de comunicación abierto (WhatsApp o email)
- [ ] Acordar soporte por X semanas/meses
- [ ] Documentar cualquier personalización adicional hecha

---

## NOTAS Y PERSONALIZACIONES ADICIONALES

(Anotar aquí cualquier cambio específico hecho para este cliente
que no esté en el checklist estándar)

________________________________________________________________
________________________________________________________________
________________________________________________________________
________________________________________________________________
________________________________________________________________

---

## CREDENCIALES Y DATOS SENSIBLES
(Guardar este bloque en un lugar seguro — NO subir a git)

API_SECRET: ________________________________
NEXTAUTH_SECRET: ________________________________
DATABASE_URL: ________________________________
CLOUDINARY_CLOUD_NAME: ________________________________
CLOUDINARY_API_KEY: ________________________________
CLOUDINARY_API_SECRET: ________________________________
URL Backend producción: ________________________________
URL Frontend producción: ________________________________
Usuario admin: ________________________________
Contraseña admin: ________________________________

---
Versión del checklist: 2.0 — Etapa Silver completa (con módulo de contratos)
Última actualización: Abril 2026
