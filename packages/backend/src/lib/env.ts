import { config } from 'dotenv';
import { z } from 'zod';

// override: true — necesario porque ANTHROPIC_API_KEY="" puede estar definida
// como cadena vacía en el entorno del sistema Windows y dotenv no la sobreescribiría
config({ override: true });

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida de PostgreSQL'),
  API_SECRET: z
    .string()
    .min(32, 'API_SECRET debe tener al menos 32 caracteres'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('4000'),

  // Cloudinary — requerido para subida de fotos
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME es requerido'),
  CLOUDINARY_API_KEY:    z.string().min(1, 'CLOUDINARY_API_KEY es requerido'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET es requerido'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errores = parsed.error.errors
    .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
    .join('\n');
  throw new Error(
    `\n❌ Variables de entorno inválidas:\n${errores}\nVerifica tu archivo .env`
  );
}

export const env = parsed.data;
