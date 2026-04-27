/**
 * storage.ts — Subida y eliminación de imágenes con Cloudinary.
 *
 * Todas las fotos se guardan bajo la carpeta "inmuebles/{folder}" en Cloudinary.
 * Se aplican transformaciones automáticas de calidad y formato en la URL devuelta.
 */

import { v2 as cloudinary } from 'cloudinary';
import type { Express } from 'express';

// ─── Configuración (se ejecuta al importar el módulo) ─────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  url:      string;
  publicId: string;
}

// ─── uploadImage ──────────────────────────────────────────────────────────────

/**
 * Sube un buffer de imagen a Cloudinary.
 *
 * @param fileBuffer  Buffer con el contenido del archivo
 * @param folder      Sub-carpeta dentro de "inmuebles/" (generalmente el ID del inmueble)
 * @param filename    Nombre base del archivo (sin extensión)
 * @returns           URL pública optimizada y publicId para eliminar después
 */
export async function uploadImage(
  fileBuffer: Buffer,
  folder: string,
  filename: string,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:          `inmuebles/${folder}`,
        public_id:       filename,
        // Calidad y formato automáticos según el dispositivo del cliente
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        // Sobrescribir si ya existe un archivo con el mismo public_id
        overwrite: true,
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary no devolvió resultado'));
          return;
        }
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    uploadStream.end(fileBuffer);
  });
}

// ─── uploadMultipleImages ─────────────────────────────────────────────────────

/**
 * Sube múltiples imágenes en paralelo.
 *
 * @param files   Array de archivos de multer (memoryStorage)
 * @param folder  Sub-carpeta dentro de "inmuebles/"
 * @returns       Array de resultados en el mismo orden que los archivos de entrada
 */
export async function uploadMultipleImages(
  files: Express.Multer.File[],
  folder: string,
): Promise<UploadResult[]> {
  const uploads = files.map((file, index) => {
    // Nombre único: timestamp + índice para evitar colisiones
    const filename = `${Date.now()}-${index}`;
    return uploadImage(file.buffer, folder, filename);
  });

  return Promise.all(uploads);
}

// ─── deleteImage ──────────────────────────────────────────────────────────────

/**
 * Elimina una imagen de Cloudinary por su publicId.
 * No lanza error si la imagen no existe (idempotente).
 *
 * @param publicId  Identificador de la imagen en Cloudinary
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // Logueamos pero no propagamos — si ya no existe en Cloudinary no importa
    console.error(`[storage] Error eliminando imagen ${publicId}:`, err);
  }
}

// ─── extractPublicId ─────────────────────────────────────────────────────────

/**
 * Extrae el publicId de una URL de Cloudinary.
 *
 * Ejemplo:
 *   https://res.cloudinary.com/mi-cloud/image/upload/v123456/inmuebles/abc/1234-0.webp
 *   → "inmuebles/abc/1234-0"
 */
export function extractPublicId(cloudinaryUrl: string): string | null {
  try {
    // El publicId está entre "/upload/v{version}/" y la extensión
    const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
