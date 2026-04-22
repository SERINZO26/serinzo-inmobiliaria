# Despliegue

---

## Ambientes

| Ambiente | Backend | Frontend |
|---|---|---|
| Desarrollo | localhost:4000 | localhost:3000 |
| Staging | Railway / Render | Vercel |
| Produccion | Railway / Render | Vercel |

---

## Backend (Railway o Render)

> Por documentar en Etapa 1

## Frontend (Vercel)

> Por documentar en Etapa 1

## Base de datos

> Por documentar en Etapa 1

## Redis

> Por documentar en Etapa 4

## Variables de entorno en produccion

Configurar todas las variables de `.env.example` en el panel del proveedor de hosting.
Nunca subir el archivo `.env` al repositorio.

---

## Checklist de deploy

- [ ] Variables de entorno configuradas
- [ ] Migraciones de base de datos ejecutadas (`prisma migrate deploy`)
- [ ] Seed inicial ejecutado (solo en primer deploy)
- [ ] Webhooks de Twilio apuntando a la URL de produccion
- [ ] Webhook de Google Calendar configurado
- [ ] NEXTAUTH_URL actualizado a la URL de produccion
