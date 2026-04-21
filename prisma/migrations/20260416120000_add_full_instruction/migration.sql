-- AlterTable: add full_instruction column to medications
-- This column was missing from production database (added directly to dev.db without a migration).
ALTER TABLE "medications" ADD COLUMN "full_instruction" TEXT;
