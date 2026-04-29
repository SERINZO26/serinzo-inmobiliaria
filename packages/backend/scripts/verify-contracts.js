const { PrismaClient } = require('../src/lib/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const rc = await prisma.rentalContract.count();
  const rp = await prisma.rentalPayment.count();
  const sc = await prisma.saleContract.count();
  console.log('rental_contracts rows:', rc, '✓');
  console.log('rental_payments rows:', rp, '✓');
  console.log('sale_contracts rows:', sc, '✓');
  console.log('PASO 1 verificado — todos los modelos accesibles.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('ERROR:', e.message);
    prisma.$disconnect();
    process.exit(1);
  });
