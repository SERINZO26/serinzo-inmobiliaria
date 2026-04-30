import { env } from './lib/env'; // carga dotenv y valida antes que cualquier otra cosa
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authRouter } from './api/auth/router';
import { propertiesRouter } from './api/properties/router';
import { clientsRouter } from './api/clients/router';
import { appointmentsRouter } from './api/appointments/router';
import { dashboardRouter } from './api/dashboard/router';
import { availabilityRouter } from './api/availability/router';
import { staffRouter } from './api/staff/router';
import { conversationsRouter } from './api/conversations/router';
import { rentalRouter } from './api/contracts/rental-router';
import { saleRouter } from './api/contracts/sale-router';
import { settingsRouter } from './api/settings/router';
import { whatsappWebhookRouter } from './api/webhooks/whatsapp';
import { initScheduler } from './services/scheduler';

const app = express();

// Seguridad y parseo
app.use(helmet());
app.use(cors());
app.use(express.json());
// Twilio envía el body como application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// Health check público
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// Rutas de la API
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/properties', propertiesRouter);
app.use('/api/v1/clients', clientsRouter);
app.use('/api/v1/appointments', appointmentsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/availability', availabilityRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/conversations', conversationsRouter);
app.use('/api/v1/contracts/arriendos', rentalRouter);
app.use('/api/v1/contracts/ventas', saleRouter);
app.use('/api/v1/settings', settingsRouter);

// Webhooks externos (sin autenticación JWT — validados por firma de Twilio)
app.use('/api/v1/webhooks/whatsapp', whatsappWebhookRouter);

// 404 para rutas desconocidas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta ${req.method} ${req.path} no encontrada`,
  });
});

// Manejador de errores global — 4 parámetros requeridos por Express
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error({ mensaje: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} — entorno: ${env.NODE_ENV}`);
  // Iniciar jobs programados (alertas de contratos, cuotas vencidas)
  initScheduler();
});

export default app;
