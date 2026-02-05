-- Split full_name into lastName, firstName, middleName (Фамилия, Имя, Отчество)
ALTER TABLE "users" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "middle_name" TEXT NOT NULL DEFAULT '';

-- Backfill: put existing full_name into last_name (users can edit and split later)
UPDATE "users" SET "last_name" = "full_name", "first_name" = '', "middle_name" = '' WHERE 1=1;

ALTER TABLE "users" DROP COLUMN "full_name";
