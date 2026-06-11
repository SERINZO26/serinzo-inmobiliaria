# Documentacion de la API

Base URL: `http://localhost:4000`

Todas las respuestas siguen el formato:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

---

## Autenticacion

Todos los endpoints del panel requieren JWT en el header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Inmuebles `/api/properties`

> Por documentar en Etapa 1

---

### Clientes `/api/clients`

> Por documentar en Etapa 1

---

### Contacto `/api/v1/contact`

#### `POST /api/v1/contact` — Formulario de contacto del sitio público

**Público — no requiere autenticación.**

Recibe el formulario de contacto del sitio web. Guarda el contacto como
cliente en el CRM (`source: WEB`) y envía un email con Resend a la
inmobiliaria (`CONTACT_EMAIL_TO`, por defecto `info@serinzo.com`).
Si el envío del email falla, el lead igual queda guardado en el CRM.

**Body** (JSON):

| Campo     | Tipo   | Requerido | Descripción                          |
|-----------|--------|-----------|--------------------------------------|
| `name`    | string | Sí        | Nombre del contacto (mín. 2 chars)   |
| `phone`   | string | Sí        | Teléfono (mín. 7 dígitos)            |
| `email`   | string | No        | Email del contacto                   |
| `message` | string | Sí        | Mensaje del formulario               |

**Response** `201`:

```json
{ "success": true, "data": { "id": "clxxxx" } }
```

**Errores**: `400` con `{ "success": false, "error": "mensaje legible" }` si la validación falla.

---

### Staff `/api/staff`

> Por documentar en Etapa 1

---

### Citas `/api/appointments`

> Por documentar en Etapa 1

---

### Disponibilidad `/api/availability`

> Por documentar en Etapa 1

---

### Conversaciones `/api/conversations`

> Por documentar en Etapa 2

---

### Campanas `/api/campaigns`

> Por documentar en Etapa 5

---

### Media `/api/media`

> Por documentar en Etapa 4

---

### Dashboard `/api/dashboard`

> Por documentar en Etapa 1

---

### Configuracion `/api/settings`

> Por documentar en Etapa 1

---

### Webhooks `/api/webhooks`

> Por documentar en Etapa 2

---
