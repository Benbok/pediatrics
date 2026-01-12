-- AlterTable
ALTER TABLE "clinical_guidelines" ADD COLUMN "classification" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "clinical_picture" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "complaints" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "definition" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "epidemiology" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "etiology" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "instrumental" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "lab_diagnostics" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "medications" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "physical_exam" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "prevention" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "rehabilitation" TEXT;
ALTER TABLE "clinical_guidelines" ADD COLUMN "treatment" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_diseases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "icd10_code" TEXT NOT NULL,
    "icd10_codes" TEXT NOT NULL DEFAULT '[]',
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL DEFAULT '[]',
    "symptoms_vector" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_diseases" ("created_at", "description", "icd10_code", "id", "name_en", "name_ru", "symptoms", "symptoms_vector") SELECT "created_at", "description", "icd10_code", "id", "name_en", "name_ru", "symptoms", "symptoms_vector" FROM "diseases";
DROP TABLE "diseases";
ALTER TABLE "new_diseases" RENAME TO "diseases";
CREATE UNIQUE INDEX "diseases_icd10_code_key" ON "diseases"("icd10_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
