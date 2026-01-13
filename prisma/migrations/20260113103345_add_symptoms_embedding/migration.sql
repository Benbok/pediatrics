/*
  Warnings:

  - You are about to drop the column `symptoms_vector` on the `diseases` table. All the data in the column will be lost.

*/
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
    "symptoms_embedding" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_diseases" ("created_at", "description", "icd10_code", "icd10_codes", "id", "name_en", "name_ru", "symptoms") SELECT "created_at", "description", "icd10_code", "icd10_codes", "id", "name_en", "name_ru", "symptoms" FROM "diseases";
DROP TABLE "diseases";
ALTER TABLE "new_diseases" RENAME TO "diseases";
CREATE UNIQUE INDEX "diseases_icd10_code_key" ON "diseases"("icd10_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
