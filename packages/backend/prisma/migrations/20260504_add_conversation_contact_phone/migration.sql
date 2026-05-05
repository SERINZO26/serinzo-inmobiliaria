-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "contactPhone" TEXT;

-- CreateIndex
CREATE INDEX "conversations_contactPhone_idx" ON "conversations"("contactPhone");
