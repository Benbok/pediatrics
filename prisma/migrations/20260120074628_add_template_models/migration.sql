-- CreateTable
CREATE TABLE "medication_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "medication_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exam_text_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "system_key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "exam_text_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_visit_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "visit_type" TEXT NOT NULL,
    "specialty" TEXT,
    "description" TEXT,
    "template_data" TEXT NOT NULL,
    "medication_template_id" INTEGER,
    "exam_template_set_id" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "visit_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visit_templates_medication_template_id_fkey" FOREIGN KEY ("medication_template_id") REFERENCES "medication_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_visit_templates" ("created_at", "created_by_id", "description", "id", "is_default", "is_public", "name", "specialty", "template_data", "updated_at", "visit_type") SELECT "created_at", "created_by_id", "description", "id", "is_default", "is_public", "name", "specialty", "template_data", "updated_at", "visit_type" FROM "visit_templates";
DROP TABLE "visit_templates";
ALTER TABLE "new_visit_templates" RENAME TO "visit_templates";
CREATE INDEX "visit_templates_created_by_id_idx" ON "visit_templates"("created_by_id");
CREATE UNIQUE INDEX "visit_templates_created_by_id_name_key" ON "visit_templates"("created_by_id", "name");
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
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "visits_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visits_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visits_primary_diagnosis_id_fkey" FOREIGN KEY ("primary_diagnosis_id") REFERENCES "diseases" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_visits" ("abdomen", "additional_examination_plan", "allergy_history", "blood_pressure_diastolic", "blood_pressure_systolic", "bmi", "bsa", "cardiovascular", "certificate_issued", "child_id", "comorbidities", "comorbidity_ids", "complaints", "complaints_json", "complication_ids", "complications", "consciousness", "consciousness_level", "consultation_requests", "created_at", "current_height", "current_weight", "disability_certificate", "disease_history", "doctor_id", "general_condition", "hospitalization_indication", "id", "informed_consent_id", "instrumental_tests", "is_first_time_diagnosis", "is_trauma", "laboratory_tests", "life_history", "lymph_nodes", "musculoskeletal", "nervous_system", "next_visit_date", "notes", "outcome", "oxygen_saturation", "patient_route", "physical_exam", "physiotherapy", "preferential_prescription", "prescriptions", "previous_diseases", "primary_diagnosis", "primary_diagnosis_id", "pulse", "recommendations", "referring_doctor_id", "respiratory", "respiratory_rate", "skin_mucosa", "status", "temperature", "ticket_number", "updated_at", "urogenital", "visit_date", "visit_place", "visit_time", "visit_type") SELECT "abdomen", "additional_examination_plan", "allergy_history", "blood_pressure_diastolic", "blood_pressure_systolic", "bmi", "bsa", "cardiovascular", "certificate_issued", "child_id", "comorbidities", "comorbidity_ids", "complaints", "complaints_json", "complication_ids", "complications", "consciousness", "consciousness_level", "consultation_requests", "created_at", "current_height", "current_weight", "disability_certificate", "disease_history", "doctor_id", "general_condition", "hospitalization_indication", "id", "informed_consent_id", "instrumental_tests", "is_first_time_diagnosis", "is_trauma", "laboratory_tests", "life_history", "lymph_nodes", "musculoskeletal", "nervous_system", "next_visit_date", "notes", "outcome", "oxygen_saturation", "patient_route", "physical_exam", "physiotherapy", "preferential_prescription", "prescriptions", "previous_diseases", "primary_diagnosis", "primary_diagnosis_id", "pulse", "recommendations", "referring_doctor_id", "respiratory", "respiratory_rate", "skin_mucosa", "status", "temperature", "ticket_number", "updated_at", "urogenital", "visit_date", "visit_place", "visit_time", "visit_type" FROM "visits";
DROP TABLE "visits";
ALTER TABLE "new_visits" RENAME TO "visits";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "medication_templates_created_by_id_idx" ON "medication_templates"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_templates_created_by_id_name_key" ON "medication_templates"("created_by_id", "name");

-- CreateIndex
CREATE INDEX "exam_text_templates_created_by_id_system_key_idx" ON "exam_text_templates"("created_by_id", "system_key");
