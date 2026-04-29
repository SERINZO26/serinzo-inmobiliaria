-- CreateEnum
CREATE TYPE "RentalContractStatus" AS ENUM ('BORRADOR', 'ACTIVO', 'RENOVADO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO', 'PARCIAL');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'EN_PROCESO', 'FIRMADO', 'REGISTRADO', 'CANCELADO');

-- AlterTable: add inverse relations (no SQL needed — they are virtual in Prisma)

-- CreateTable: rental_contracts
CREATE TABLE "rental_contracts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyRent" DECIMAL(65,30) NOT NULL,
    "rentCurrency" TEXT NOT NULL DEFAULT 'COP',
    "adminFee" DECIMAL(65,30),
    "depositAmount" DECIMAL(65,30),
    "depositCurrency" TEXT NOT NULL DEFAULT 'COP',
    "depositReturned" BOOLEAN NOT NULL DEFAULT false,
    "commissionPct" DECIMAL(65,30),
    "status" "RentalContractStatus" NOT NULL DEFAULT 'BORRADOR',
    "pdfUrl" TEXT,
    "notes" TEXT,
    "lastAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rental_payments
CREATE TABLE "rental_payments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "amount" DECIMAL(65,30) NOT NULL,
    "ownerPayment" DECIMAL(65,30),
    "commission" DECIMAL(65,30),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sale_contracts
CREATE TABLE "sale_contracts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "salePrice" DECIMAL(65,30) NOT NULL,
    "saleCurrency" TEXT NOT NULL DEFAULT 'COP',
    "commissionPct" DECIMAL(65,30),
    "commissionAmount" DECIMAL(65,30),
    "promiseDate" TIMESTAMP(3),
    "signDate" TIMESTAMP(3),
    "registrationDate" TIMESTAMP(3),
    "status" "SaleStatus" NOT NULL DEFAULT 'BORRADOR',
    "pdfUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_contracts_status_idx" ON "rental_contracts"("status");
CREATE INDEX "rental_contracts_propertyId_idx" ON "rental_contracts"("propertyId");
CREATE INDEX "rental_contracts_clientId_idx" ON "rental_contracts"("clientId");
CREATE INDEX "rental_contracts_endDate_idx" ON "rental_contracts"("endDate");

CREATE INDEX "rental_payments_contractId_idx" ON "rental_payments"("contractId");
CREATE INDEX "rental_payments_status_idx" ON "rental_payments"("status");
CREATE INDEX "rental_payments_dueDate_idx" ON "rental_payments"("dueDate");

CREATE INDEX "sale_contracts_status_idx" ON "sale_contracts"("status");
CREATE INDEX "sale_contracts_propertyId_idx" ON "sale_contracts"("propertyId");
CREATE INDEX "sale_contracts_clientId_idx" ON "sale_contracts"("clientId");

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "rental_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_contracts" ADD CONSTRAINT "sale_contracts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_contracts" ADD CONSTRAINT "sale_contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_contracts" ADD CONSTRAINT "sale_contracts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
