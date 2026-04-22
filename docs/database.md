# Base de Datos

Ver [schema.prisma](../packages/backend/prisma/schema.prisma) para el esquema completo.

---

## Motor

PostgreSQL con extension `pgvector` para busqueda semantica de inmuebles.

## ORM

Prisma — migraciones seguras, tipos automaticos en TypeScript.

## Convenciones

- Nunca eliminar registros: usar `archived: true` o `status: inactivo`
- Toda conversacion queda registrada aunque el cliente cuelgue sin terminar
- Los datos del propietario del inmueble son estrictamente privados (ver reglas de negocio en CLAUDE.md)
