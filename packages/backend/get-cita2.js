const { PrismaClient } = require('./src/lib/generated/prisma');
const prisma = new PrismaClient();
prisma.appointment.findFirst({
  where: { client: { name: { contains: 'Andrea' } } },
  include: {
    client: { select: { name: true, phone: true } },
    property: { select: { title: true } }
  },
  orderBy: { createdAt: 'desc' }
}).then(r => {
  console.log('ID:', r.id);
  console.log('Cliente:', r.client.name, r.client.phone);
  console.log('Inmueble:', r.property.title);
  console.log('Fecha:', r.scheduledAt);
  process.exit(0);
});
