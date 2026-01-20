/*
  Warnings:

  - Added the required column `updated_at` to the `visits` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "informed_consents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "visit_id" INTEGER,
    "child_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "consent_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervention_description" TEXT NOT NULL,
    "goals" TEXT,
    "alternatives" TEXT,
    "risks" TEXT,
    "serious_complications_frequency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'given',
    "patient_signature" TEXT,
    "doctor_signature" TEXT,
    "signature_date" DATETIME,
    "parent_name" TEXT,
    "parent_relation" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "informed_consents_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "informed_consents_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "informed_consents_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visit_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "visit_type" TEXT NOT NULL,
    "specialty" TEXT,
    "description" TEXT,
    "template_data" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visit_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_visits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "child_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "visit_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visit_type" TEXT,
    "visit_place" TEXT,
    "visit_time" TEXT,
    "ticket_number" TEXT,
    "referring_doctor_id" INTEGER,
    "current_weight" REAL,
    "current_height" REAL,
    "bmi" REAL,
    "bsa" REAL,
    "disease_history" TEXT,
    "life_history" TEXT,
    "allergy_history" TEXT,
    "previous_diseases" TEXT,
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "pulse" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature" REAL,
    "oxygen_saturation" INTEGER,
    "consciousness_level" TEXT,
    "general_condition" TEXT,
    "consciousness" TEXT,
    "skin_mucosa" TEXT,
    "lymph_nodes" TEXT,
    "musculoskeletal" TEXT,
    "respiratory" TEXT,
    "cardiovascular" TEXT,
    "abdomen" TEXT,
    "urogenital" TEXT,
    "nervous_system" TEXT,
    "complaints" TEXT NOT NULL,
    "complaints_json" TEXT,
    "physical_exam" TEXT,
    "additional_examination_plan" TEXT,
    "laboratory_tests" TEXT,
    "instrumental_tests" TEXT,
    "consultation_requests" TEXT,
    "physiotherapy" TEXT,
    "is_first_time_diagnosis" BOOLEAN,
    "is_trauma" BOOLEAN,
    "primary_diagnosis" TEXT,
    "complications" TEXT,
    "comorbidities" TEXT,
    "primary_diagnosis_id" INTEGER,
    "complication_ids" TEXT,
    "comorbidity_ids" TEXT,
    "prescriptions" TEXT NOT NULL DEFAULT '[]',
    "recommendations" TEXT,
    "outcome" TEXT,
    "patient_route" TEXT,
    "hospitalization_indication" TEXT,
    "next_visit_date" DATETIME,
    "informed_consent_id" INTEGER,
    "disability_certificate" BOOLEAN,
    "preferential_prescription" BOOLEAN,
    "certificate_issued" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visits_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visits_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visits_primary_diagnosis_id_fkey" FOREIGN KEY ("primary_diagnosis_id") REFERENCES "diseases" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_visits" ("bmi", "bsa", "child_id", "comorbidity_ids", "complaints", "complaints_json", "complication_ids", "created_at", "current_height", "current_weight", "doctor_id", "id", "notes", "physical_exam", "prescriptions", "primary_diagnosis_id", "recommendations", "status", "visit_date", "updated_at") SELECT "bmi", "bsa", "child_id", "comorbidity_ids", "complaints", "complaints_json", "complication_ids", "created_at", "current_height", "current_weight", "doctor_id", "id", "notes", "physical_exam", "prescriptions", "primary_diagnosis_id", "recommendations", "status", "visit_date", "created_at" FROM "visits";
DROP TABLE "visits";
ALTER TABLE "new_visits" RENAME TO "visits";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "informed_consents_visit_id_key" ON "informed_consents"("visit_id");
