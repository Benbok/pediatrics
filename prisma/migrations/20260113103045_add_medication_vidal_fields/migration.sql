-- AlterTable
ALTER TABLE "medications" ADD COLUMN "max_doses_per_day" INTEGER;
ALTER TABLE "medications" ADD COLUMN "max_duration_days" INTEGER;
ALTER TABLE "medications" ADD COLUMN "min_interval" INTEGER;
ALTER TABLE "medications" ADD COLUMN "route_of_admin" TEXT;
