import { PrismaClient } from '../src/lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const agent = await prisma.user.findUnique({ where: { email: 'agente@serinzo.com' } });
  if (!agent) {
    console.log('❌ Agente no encontrado');
    return;
  }

  // Eliminar disponibilidad previa para evitar duplicados
  const deleted = await prisma.availability.deleteMany({ where: { userId: agent.id } });
  console.log(`🗑️  Registros eliminados: ${deleted.count}`);

  // Lunes (1) a Sábado (6), 08:00 - 19:00
  const days = [1, 2, 3, 4, 5, 6];
  const created = await prisma.availability.createMany({
    data: days.map((d) => ({
      userId: agent.id,
      dayOfWeek: d,
      startTime: '08:00',
      endTime: '19:00',
      isBlocked: false,
    })),
  });

  console.log(`✅ Disponibilidad creada: ${created.count} días para ${agent.name} (${agent.email})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
