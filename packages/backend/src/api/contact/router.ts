import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { success, error, asyncHandler } from '../../lib/response';
import { sendEmail } from '../../services/messaging';

// Escapar HTML porque el contenido viene de un formulario público
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const contactSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('El email no es válido').optional().or(z.literal('')),
  phone: z.string().min(7, 'El teléfono debe tener al menos 7 dígitos'),
  message: z.string().min(1, 'El mensaje es requerido'),
});

export const contactRouter = Router();

// POST /api/v1/contact — PÚBLICO (formulario de contacto del sitio web, sin auth)
contactRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return error(res, parsed.error.errors[0].message, 400);

    const { name, email, phone, message } = parsed.data;

    // Guardar el lead en el CRM antes de intentar el email —
    // si el email falla, el contacto no se pierde
    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        source: 'WEB',
        additionalRequirements: message.trim(),
        lastContactAt: new Date(),
      },
    });

    const to = process.env.CONTACT_EMAIL_TO || 'info@serinzo.com';
    const subject = `📩 Nuevo mensaje desde el sitio web — ${name.trim()}`;
    const html = [
      `<p><strong>Nombre:</strong> ${escapeHtml(name.trim())}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(email?.trim() || 'No proporcionado')}</p>`,
      `<p><strong>Teléfono:</strong> ${escapeHtml(phone.trim())}</p>`,
      `<p><strong>Mensaje:</strong><br/>${escapeHtml(message.trim()).replace(/\n/g, '<br/>')}</p>`,
    ].join('\n');

    try {
      await sendEmail(to, subject, html);
    } catch (err) {
      console.error({
        error: err,
        context: { clientId: client.id, action: 'contact_form_email' },
      });
    }

    return success(res, { id: client.id }, 201);
  })
);
