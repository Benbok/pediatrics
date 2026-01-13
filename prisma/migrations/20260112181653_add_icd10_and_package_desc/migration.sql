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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_medications" ("active_substance", "adult_dosing", "atc_code", "caution_conditions", "contraindications", "created_at", "forms", "id", "indications", "interactions", "lactation", "manufacturer", "name_en", "name_ru", "pediatric_dosing", "pregnancy", "registration_number", "side_effects", "updated_at", "vidal_url") SELECT "active_substance", "adult_dosing", "atc_code", "caution_conditions", "contraindications", "created_at", "forms", "id", "indications", "interactions", "lactation", "manufacturer", "name_en", "name_ru", "pediatric_dosing", "pregnancy", "registration_number", "side_effects", "updated_at", "vidal_url" FROM "medications";
DROP TABLE "medications";
ALTER TABLE "new_medications" RENAME TO "medications";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
