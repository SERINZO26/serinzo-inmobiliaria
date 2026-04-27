'use client';

/**
 * PhotoUploader.tsx — Subida de fotos de inmuebles con drag & drop.
 *
 * Dos modos:
 *  - Editando (propertyId != null): sube inmediatamente a Cloudinary vía API.
 *  - Nuevo inmueble (propertyId == null): acumula archivos en pendingFiles;
 *    el padre los sube después de crear el inmueble.
 *
 * Siempre muestra las fotos actuales (URLs) con opción de eliminar.
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { photosApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhotoUploaderProps {
  /** URLs de fotos ya guardadas en Cloudinary */
  photos: string[];
  /** ID del inmueble. null cuando el inmueble aún no ha sido creado */
  propertyId: string | null;
  /** Llamado con el array actualizado de URLs cada vez que cambia */
  onChange: (urls: string[]) => void;
  /** Archivos pendientes de subir (modo nuevo inmueble) */
  pendingFiles?: File[];
  /** Llamado con la lista actualizada de archivos pendientes */
  onPendingFiles?: (files: File[]) => void;
}

// ─── Validación local ─────────────────────────────────────────────────────────

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE     = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS   = 10;

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type))
    return `${file.name}: solo se aceptan JPG, PNG y WebP`;
  if (file.size > MAX_SIZE)
    return `${file.name}: supera el límite de 5 MB`;
  return null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PhotoUploader({
  photos,
  propertyId,
  onChange,
  pendingFiles = [],
  onPendingFiles,
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [errors,    setErrors]    = useState<string[]>([]);

  const totalCount = photos.length + pendingFiles.length;

  // ── Drag & drop handler ──────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (accepted: File[]) => {
      setErrors([]);

      // Validar archivos
      const validationErrors: string[] = [];
      const valid = accepted.filter((f) => {
        const err = validateFile(f);
        if (err) { validationErrors.push(err); return false; }
        return true;
      });

      // Limite total de fotos
      const slots = MAX_PHOTOS - totalCount;
      const toProcess = valid.slice(0, slots);
      if (valid.length > slots) {
        validationErrors.push(
          `Solo se pueden subir ${slots} foto(s) más (máximo ${MAX_PHOTOS} en total)`,
        );
      }

      if (validationErrors.length) setErrors(validationErrors);
      if (!toProcess.length) return;

      // Modo nuevo inmueble — acumular sin subir aún
      if (!propertyId) {
        onPendingFiles?.([...pendingFiles, ...toProcess]);
        return;
      }

      // Modo edición — subir inmediatamente a Cloudinary
      setUploading(true);
      try {
        const res = await photosApi.upload(propertyId, toProcess);
        onChange(res.data.data.photos);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error ?? 'Error al subir las fotos';
        setErrors([msg]);
      } finally {
        setUploading(false);
      }
    },
    [propertyId, photos, pendingFiles, totalCount, onChange, onPendingFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: MAX_SIZE,
    disabled: uploading || totalCount >= MAX_PHOTOS,
    noClick: false,
  });

  // ── Eliminar foto guardada ────────────────────────────────────────────────────

  async function removePhoto(url: string) {
    if (!propertyId) {
      // Modo nuevo inmueble — nunca debería ocurrir, pero por seguridad
      onChange(photos.filter((p) => p !== url));
      return;
    }
    try {
      const res = await photosApi.delete(propertyId, url);
      onChange(res.data.data.photos);
    } catch {
      setErrors(['No se pudo eliminar la foto. Intenta de nuevo.']);
    }
  }

  // ── Eliminar foto pendiente (aún no subida) ───────────────────────────────────

  function removePending(index: number) {
    const updated = pendingFiles.filter((_, i) => i !== index);
    onPendingFiles?.(updated);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Zona de drop ── */}
      {totalCount < MAX_PHOTOS && (
        <div
          {...getRootProps()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors select-none',
            isDragActive
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-green-400 hover:bg-green-50/50',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-sm font-medium text-green-700">Subiendo fotos...</p>
            </>
          ) : (
            <>
              <Upload className={cn('h-8 w-8', isDragActive ? 'text-green-600' : 'text-slate-400')} />
              <div>
                <p className="text-sm font-medium">
                  {isDragActive ? 'Suelta las fotos aquí' : 'Arrastra fotos aquí o haz clic para seleccionar'}
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  JPG, PNG o WebP · Máximo 5 MB por foto · Hasta {MAX_PHOTOS} fotos
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {totalCount >= MAX_PHOTOS && (
        <p className="text-xs text-slate-400 text-center py-2">
          Límite de {MAX_PHOTOS} fotos alcanzado. Elimina alguna para agregar nuevas.
        </p>
      )}

      {/* ── Errores ── */}
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-700">{e}</p>
          ))}
        </div>
      )}

      {/* ── Galería de fotos guardadas + pendientes ── */}
      {(photos.length > 0 || pendingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Fotos ya subidas a Cloudinary */}
          {photos.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {/* Badge de orden */}
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-green-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  Principal
                </span>
              )}
              {/* Botón eliminar */}
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Eliminar foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Archivos pendientes (inmueble nuevo, aún no subidos) */}
          {pendingFiles.map((file, i) => {
            const previewUrl = URL.createObjectURL(file);
            return (
              <div
                key={`pending-${i}`}
                className="group relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-yellow-400 bg-yellow-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`Pendiente ${i + 1}`}
                  className="h-full w-full object-cover opacity-80"
                />
                <span className="absolute bottom-1.5 left-1.5 right-1.5 bg-yellow-600/80 text-white text-[10px] text-center font-semibold px-1 py-0.5 rounded truncate">
                  Pendiente
                </span>
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Quitar foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {/* Placeholder vacío si no hay fotos */}
          {photos.length === 0 && pendingFiles.length === 0 && (
            <div className="aspect-square rounded-lg border border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
              <ImageIcon className="h-8 w-8 text-slate-300" />
            </div>
          )}
        </div>
      )}

      {/* Contador */}
      {totalCount > 0 && (
        <p className="text-xs text-slate-400">
          {photos.length} foto{photos.length !== 1 ? 's' : ''} guardada{photos.length !== 1 ? 's' : ''}
          {pendingFiles.length > 0 && ` · ${pendingFiles.length} pendiente${pendingFiles.length !== 1 ? 's' : ''} de guardar`}
          {' '}· máximo {MAX_PHOTOS}
        </p>
      )}
    </div>
  );
}
