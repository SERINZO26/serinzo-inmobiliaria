import { PrismaClient, Role, UserStatus, PropertyType, Operation, PropertyStatus, PropertySource, FeatureCategory, ClientSource, ClientStatus, AppointmentStatus } from '../src/lib/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // ─── USUARIOS ────────────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('Admin2024!', 12);
  const agentPassword = await bcrypt.hash('Agente2024!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@inmobiliaria.com' },
    update: {},
    create: {
      name: 'María García',
      email: 'admin@inmobiliaria.com',
      password: adminPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const agente = await prisma.user.upsert({
    where: { email: 'carlos@inmobiliaria.com' },
    update: {},
    create: {
      name: 'Carlos Rodríguez',
      email: 'carlos@inmobiliaria.com',
      password: agentPassword,
      role: Role.AGENT,
      status: UserStatus.ACTIVE,
      phone: '3002345678',
    },
  });

  console.log(`Usuarios creados: ${admin.name}, ${agente.name}`);

  // ─── INMUEBLES ───────────────────────────────────────────────────────────────

  const apartamento = await prisma.property.upsert({
    where: { slug: 'apartamento-2-habitaciones-chapinero-bogota' },
    update: {},
    create: {
      title: 'Apartamento en Chapinero con excelente ubicación',
      description: 'Hermoso apartamento de 2 habitaciones en el corazón de Chapinero. Edificio moderno con todas las comodidades. A 5 minutos de la Calle 72. Ideal para profesionales o pareja joven.',
      slug: 'apartamento-2-habitaciones-chapinero-bogota',
      type: PropertyType.APARTAMENTO,
      operation: Operation.ARRIENDO,
      price: 2800000,
      priceCurrency: 'COP',
      priceNegotiable: true,
      administrationFee: 250000,
      areaTotalM2: 68,
      areaBuiltM2: 65,
      bedrooms: 2,
      bathrooms: 2,
      halfBathrooms: 0,
      parking: 1,
      floor: 8,
      totalFloors: 15,
      ageYears: 5,
      strata: 4,
      address: 'Calle 63 # 7-28, Chapinero',
      city: 'Bogotá',
      neighborhood: 'Chapinero',
      department: 'Cundinamarca',
      lat: 4.6486,
      lng: -74.0586,
      photos: [],
      videos: [],
      status: PropertyStatus.DISPONIBLE,
      featured: true,
      published: true,
      ownerName: 'Pedro Martínez',
      ownerPhone: '3001234567',
      ownerEmail: 'pedro@email.com',
      ownerNotes: 'Propietario muy disponible, prefiere contacto por WhatsApp.',
      visitDays: ['lunes', 'miércoles', 'viernes'],
      visitTimeSlots: [{ from: '09:00', to: '12:00' }, { from: '14:00', to: '17:00' }],
      visitSpecialInstructions: 'Informar al portero con anticipación. Preguntar por el apto 804.',
      source: PropertySource.MANUAL,
      metaTitle: 'Arriendo Apartamento 2 Habitaciones Chapinero Bogotá | $2.800.000',
      metaDescription: 'Apartamento moderno en Chapinero, Bogotá. 2 habitaciones, 2 baños, parqueadero, gimnasio. Estrato 4. $2.800.000/mes.',
      assignedAgentId: agente.id,
      addedById: agente.id,
    },
  });

  await prisma.propertyFeature.createMany({
    data: [
      { propertyId: apartamento.id, category: FeatureCategory.EXTERIOR, name: 'Ascensor', value: 'Sí' },
      { propertyId: apartamento.id, category: FeatureCategory.ZONA_COMUN, name: 'Gimnasio', value: 'Comunal' },
      { propertyId: apartamento.id, category: FeatureCategory.SEGURIDAD, name: 'Vigilancia 24h', value: 'Sí' },
      { propertyId: apartamento.id, category: FeatureCategory.EXTERIOR, name: 'Parqueadero', value: '1' },
    ],
    skipDuplicates: true,
  });

  const casa = await prisma.property.upsert({
    where: { slug: 'casa-4-habitaciones-laureles-medellin' },
    update: {},
    create: {
      title: 'Casa campestre en Laureles con piscina y jardín',
      description: 'Espectacular casa de 4 habitaciones en el exclusivo barrio Laureles de Medellín. Amplios espacios, piscina privada, jardín y cuarto de servicio. Perfecta para familia. Dos parqueaderos cubiertos.',
      slug: 'casa-4-habitaciones-laureles-medellin',
      type: PropertyType.CASA,
      operation: Operation.VENTA,
      price: 650000000,
      priceCurrency: 'COP',
      priceNegotiable: true,
      areaTotalM2: 320,
      areaBuiltM2: 280,
      bedrooms: 4,
      bathrooms: 4,
      halfBathrooms: 1,
      parking: 2,
      floor: 1,
      totalFloors: 2,
      ageYears: 12,
      strata: 5,
      address: 'Cra. 76 # 33-15, Laureles',
      city: 'Medellín',
      neighborhood: 'Laureles',
      department: 'Antioquia',
      lat: 6.2476,
      lng: -75.5933,
      photos: [],
      videos: [],
      status: PropertyStatus.DISPONIBLE,
      featured: false,
      published: true,
      ownerName: 'Ana Gómez',
      ownerPhone: '3109876543',
      ownerEmail: 'ana@email.com',
      ownerNotes: 'Propietaria viaja frecuentemente. Coordinar con anticipación.',
      visitDays: ['martes', 'jueves', 'sábado'],
      visitTimeSlots: [{ from: '10:00', to: '13:00' }],
      visitSpecialInstructions: 'La casa tiene alarma. El código lo suministra el propietario el día de la visita.',
      source: PropertySource.MANUAL,
      metaTitle: 'Venta Casa 4 Habitaciones Laureles Medellín | $650.000.000',
      metaDescription: 'Casa con piscina en Laureles, Medellín. 4 hab, 4 baños, jardín, 2 parqueaderos. Estrato 5. $650 millones.',
      assignedAgentId: agente.id,
      addedById: agente.id,
    },
  });

  await prisma.propertyFeature.createMany({
    data: [
      { propertyId: casa.id, category: FeatureCategory.EXTERIOR, name: 'Jardín', value: 'Privado' },
      { propertyId: casa.id, category: FeatureCategory.ZONA_COMUN, name: 'Piscina', value: 'Privada' },
      { propertyId: casa.id, category: FeatureCategory.INTERIOR, name: 'Cuarto de servicio', value: 'Sí' },
      { propertyId: casa.id, category: FeatureCategory.EXTERIOR, name: 'Parqueadero', value: '2' },
      { propertyId: casa.id, category: FeatureCategory.SEGURIDAD, name: 'Alarma', value: 'Sí' },
    ],
    skipDuplicates: true,
  });

  const local = await prisma.property.upsert({
    where: { slug: 'local-comercial-el-poblado-medellin' },
    update: {},
    create: {
      title: 'Local comercial en El Poblado con alta visibilidad',
      description: 'Local comercial estratégicamente ubicado en El Poblado, Medellín. Ideal para restaurante, boutique o consultorio. Cuenta con vitrina amplia, baño completo y depósito. Zona de alto tráfico peatonal y vehicular.',
      slug: 'local-comercial-el-poblado-medellin',
      type: PropertyType.LOCAL,
      operation: Operation.VENTA_O_ARRIENDO,
      price: 180000000,
      priceCurrency: 'COP',
      priceNegotiable: false,
      administrationFee: 320000,
      areaTotalM2: 85,
      areaBuiltM2: 80,
      bedrooms: 0,
      bathrooms: 1,
      parking: 0,
      floor: 1,
      totalFloors: 1,
      ageYears: 8,
      strata: 6,
      address: 'Calle 10 # 43D-45, El Poblado',
      city: 'Medellín',
      neighborhood: 'El Poblado',
      department: 'Antioquia',
      lat: 6.2086,
      lng: -75.5705,
      photos: [],
      videos: [],
      status: PropertyStatus.DISPONIBLE,
      featured: false,
      published: true,
      ownerName: 'Luis Herrera',
      ownerPhone: '3157654321',
      ownerEmail: 'luis@email.com',
      ownerNotes: 'Prefiere venta, pero acepta arriendo con contrato mínimo 2 años.',
      visitDays: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
      visitTimeSlots: [{ from: '08:00', to: '18:00' }],
      visitSpecialInstructions: 'El local está actualmente en uso. Coordinar hora exacta con el agente.',
      source: PropertySource.MANUAL,
      metaTitle: 'Local Comercial El Poblado Medellín | Venta o Arriendo',
      metaDescription: 'Local comercial 85m² en El Poblado, Medellín. Alta visibilidad, vitrina, baño, depósito. Estrato 6.',
      assignedAgentId: agente.id,
      addedById: agente.id,
    },
  });

  await prisma.propertyFeature.createMany({
    data: [
      { propertyId: local.id, category: FeatureCategory.EXTERIOR, name: 'Vitrina', value: 'Amplia' },
      { propertyId: local.id, category: FeatureCategory.INTERIOR, name: 'Baño', value: 'Completo' },
      { propertyId: local.id, category: FeatureCategory.INTERIOR, name: 'Depósito', value: 'Sí' },
    ],
    skipDuplicates: true,
  });

  console.log(`Inmuebles creados: ${apartamento.title.substring(0, 30)}..., ${casa.title.substring(0, 30)}..., ${local.title.substring(0, 30)}...`);

  // ─── CLIENTES ────────────────────────────────────────────────────────────────

  const valentina = await prisma.client.upsert({
    where: { id: 'seed-client-valentina' },
    update: {},
    create: {
      id: 'seed-client-valentina',
      name: 'Valentina Torres',
      phone: '3204567890',
      email: 'valentina.torres@email.com',
      source: ClientSource.WHATSAPP,
      budgetMin: 2500000,
      budgetMax: 3500000,
      budgetCurrency: 'COP',
      preferredType: ['APARTAMENTO'],
      preferredZones: ['Chapinero', 'Usaquén'],
      preferredOperation: Operation.ARRIENDO,
      minBedrooms: 2,
      interestLevel: 4,
      qualificationNotes: 'Trabaja cerca a Chapinero. Busca aparto con parqueadero y buena seguridad. Capacidad de pago verificada.',
      status: ClientStatus.CALIFICADO,
      assignedAgentId: agente.id,
      lastContactAt: new Date(),
    },
  });

  const andres = await prisma.client.upsert({
    where: { id: 'seed-client-andres' },
    update: {},
    create: {
      id: 'seed-client-andres',
      name: 'Andrés Morales',
      phone: '3118765432',
      email: 'andres.morales@email.com',
      source: ClientSource.WEB,
      budgetMin: 500000000,
      budgetMax: 800000000,
      budgetCurrency: 'COP',
      preferredType: ['CASA', 'APARTAMENTO'],
      preferredZones: ['Laureles', 'El Poblado'],
      preferredOperation: Operation.VENTA,
      minBedrooms: 3,
      interestLevel: 3,
      qualificationNotes: 'Empresario. Busca para inversión o vivienda familiar. Aún explorando opciones.',
      status: ClientStatus.CONTACTADO,
      assignedAgentId: agente.id,
      lastContactAt: new Date(),
    },
  });

  console.log(`Clientes creados: ${valentina.name}, ${andres.name}`);

  // ─── DISPONIBILIDAD DEL AGENTE ───────────────────────────────────────────────

  for (let dia = 1; dia <= 5; dia++) {
    await prisma.availability.upsert({
      where: { id: `seed-availability-carlos-${dia}` },
      update: {},
      create: {
        id: `seed-availability-carlos-${dia}`,
        userId: agente.id,
        dayOfWeek: dia,
        startTime: '08:00',
        endTime: '18:00',
        isBlocked: false,
      },
    });
  }

  console.log('Disponibilidad de Carlos creada (lunes a viernes 08:00-18:00)');

  // ─── CITA ────────────────────────────────────────────────────────────────────

  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(10, 0, 0, 0);

  const cita = await prisma.appointment.upsert({
    where: { id: 'seed-appointment-valentina' },
    update: {},
    create: {
      id: 'seed-appointment-valentina',
      clientId: valentina.id,
      propertyId: apartamento.id,
      agentId: agente.id,
      scheduledAt: manana,
      durationMinutes: 60,
      status: AppointmentStatus.CONFIRMADA,
      confirmationSent: true,
      reminder24hSent: false,
      reminder1hSent: false,
      notes: 'Cliente muy interesada. Confirmar con el portero antes de llegar.',
      requestedTimes: [{ date: manana.toISOString(), preference: 'primera opción' }],
    },
  });

  console.log(`Cita creada: ${valentina.name} — ${apartamento.city} — ${manana.toLocaleDateString('es-CO')}`);

  // ─── KPI SNAPSHOT ────────────────────────────────────────────────────────────

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  await prisma.kpiSnapshot.upsert({
    where: { date: hoy },
    update: {
      totalProperties: 3,
      availableProperties: 3,
      newClients: 2,
      qualifiedClients: 1,
      appointmentsScheduled: 1,
      appointmentsCompleted: 0,
      appointmentsCancelled: 0,
      conversationsTotal: 0,
    },
    create: {
      date: hoy,
      totalProperties: 3,
      availableProperties: 3,
      newClients: 2,
      qualifiedClients: 1,
      appointmentsScheduled: 1,
      appointmentsCompleted: 0,
      appointmentsCancelled: 0,
      conversationsTotal: 0,
    },
  });

  console.log('KpiSnapshot de hoy creado');
  console.log('\n✅ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
