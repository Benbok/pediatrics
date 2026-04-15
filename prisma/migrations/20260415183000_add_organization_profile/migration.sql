-- CreateTable
CREATE TABLE "organization_profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Медицинская организация',
    "legal_name" TEXT,
    "department" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "inn" TEXT,
    "ogrn" TEXT,
    "chief_doctor" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_profiles_singleton_id_check" CHECK ("id" = 1)
);

-- Seed singleton row
INSERT INTO "organization_profiles" ("id", "name")
VALUES (1, 'Медицинская организация')
ON CONFLICT("id") DO NOTHING;
