-- CreateTable
CREATE TABLE "medication_change_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medication_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_type" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "medication_change_logs_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "medication_change_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_medications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT,
    "active_substance" TEXT NOT NULL,
    "atc_code" TEXT,
    "icd10_codes" TEXT NOT NULL DEFAULT '[]',
    "package_description" TEXT,
    "manufacturer" TEXT,
    "forms" TEXT NOT NULL,
    "pediatric_dosing" TEXT NOT NULL,
    "adult_dosing" TEXT,
    "contraindications" TEXT NOT NULL,
    "caution_conditions" TEXT,
    "side_effects" TEXT,
    "interactions" TEXT,
    "pregnancy" TEXT,
    "lactation" TEXT,
    "indications" TEXT NOT NULL,
    "registration_number" TEXT,
    "vidal_url" TEXT,
    "clinical_pharm_group" TEXT,
    "pharm_therapy_group" TEXT,
    "min_interval" INTEGER,
    "max_doses_per_day" INTEGER,
    "max_duration_days" INTEGER,
    "route_of_admin" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "user_tags" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_medications" ("active_substance", "adult_dosing", "atc_code", "caution_conditions", "contraindications", "created_at", "forms", "icd10_codes", "id", "indications", "interactions", "lactation", "manufacturer", "max_doses_per_day", "max_duration_days", "min_interval", "name_en", "name_ru", "package_description", "pediatric_dosing", "pregnancy", "registration_number", "route_of_admin", "side_effects", "updated_at", "vidal_url") SELECT "active_substance", "adult_dosing", "atc_code", "caution_conditions", "contraindications", "created_at", "forms", "icd10_codes", "id", "indications", "interactions", "lactation", "manufacturer", "max_doses_per_day", "max_duration_days", "min_interval", "name_en", "name_ru", "package_description", "pediatric_dosing", "pregnancy", "registration_number", "route_of_admin", "side_effects", "updated_at", "vidal_url" FROM "medications";
DROP TABLE "medications";
ALTER TABLE "new_medications" RENAME TO "medications";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
