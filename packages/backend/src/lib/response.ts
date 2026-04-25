import { Request, Response, NextFunction } from 'express';

interface Meta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const success = (
  res: Response,
  data: unknown,
  statusCode = 200,
  meta?: Meta
): Response =>
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta && { meta }),
  });

export const error = (
  res: Response,
  message: string,
  statusCode = 400
): Response =>
  res.status(statusCode).json({
    success: false,
    error: message,
  });

export const notFound = (res: Response, entity = 'Recurso'): Response =>
  res.status(404).json({
    success: false,
    error: `${entity} no encontrado`,
  });

// Envuelve handlers async para que sus errores lleguen al middleware de Express
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
