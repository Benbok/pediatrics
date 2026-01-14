/*
  Warnings:

  - You are about to drop the column `registration_number` on the `medications` table. All the data in the column will be lost.

*/
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
INSERT INTO "new_medications" ("active_substance", "adult_dosing", "atc_code", "caution_conditions", "clinical_pharm_group", "contraindications", "created_at", "forms", "icd10_codes", "id", "indications", "interactions", "is_favorite", "lactation", "last_used_at", "manufacturer", "max_doses_per_day", "max_duration_days", "min_interval", "name_en", "name_ru", "package_description", "pediatric_dosing", "pharm_therapy_group", "pregnancy", "route_of_admin", "side_effects", "updated_at", "usage_count", "user_tags", "vidal_url") SELECT "active_substance", "adult_dosing", "atc_code", "caution_conditions", "clinical_pharm_group", "contraindications", "created_at", "forms", "icd10_codes", "id", "indications", "interactions", "is_favorite", "lactation", "last_used_at", "manufacturer", "max_doses_per_day", "max_duration_days", "min_interval", "name_en", "name_ru", "package_description", "pediatric_dosing", "pharm_therapy_group", "pregnancy", "route_of_admin", "side_effects", "updated_at", "usage_count", "user_tags", "vidal_url" FROM "medications";
DROP TABLE "medications";
ALTER TABLE "new_medications" RENAME TO "medications";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
