-- AlterTable: Add Vidal clinical fields to medications
ALTER TABLE "medications" ADD COLUMN "is_otc" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medications" ADD COLUMN "overdose" TEXT;
ALTER TABLE "medications" ADD COLUMN "child_dosing" TEXT;
ALTER TABLE "medications" ADD COLUMN "child_using" TEXT;
ALTER TABLE "medications" ADD COLUMN "renal_insuf" TEXT;
ALTER TABLE "medications" ADD COLUMN "renal_using" TEXT;
ALTER TABLE "medications" ADD COLUMN "hepato_insuf" TEXT;
ALTER TABLE "medications" ADD COLUMN "hepato_using" TEXT;
ALTER TABLE "medications" ADD COLUMN "special_instruction" TEXT;
ALTER TABLE "medications" ADD COLUMN "pharmacokinetics" TEXT;
ALTER TABLE "medications" ADD COLUMN "pharmacodynamics" TEXT;
