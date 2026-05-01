-- AlterTable
ALTER TABLE "settings" ADD COLUMN "notifyNewClient" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "notifyHighInterest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "notifyAppointment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "notifyAppointmentReminder" BOOLEAN NOT NULL DEFAULT true;
