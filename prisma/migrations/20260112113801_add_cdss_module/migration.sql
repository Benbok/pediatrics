-- CreateTable
CREATE TABLE "diseases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "icd10_code" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL DEFAULT '[]',
    "symptoms_vector" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "clinical_guidelines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "disease_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "pdf_path" TEXT,
    "content" TEXT NOT NULL,
    "chunks" TEXT NOT NULL,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_guidelines_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT,
    "active_substance" TEXT NOT NULL,
    "atc_code" TEXT,
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

-- CreateTable
CREATE TABLE "disease_medications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "disease_id" INTEGER NOT NULL,
    "medication_id" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "dosing" TEXT,
    "duration" TEXT,
    CONSTRAINT "disease_medications_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "disease_medications_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "child_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "visit_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaints" TEXT NOT NULL,
    "complaints_json" TEXT,
    "physical_exam" TEXT,
    "primary_diagnosis_id" INTEGER,
    "complication_ids" TEXT,
    "comorbidity_ids" TEXT,
    "prescriptions" TEXT NOT NULL DEFAULT '[]',
    "recommendations" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visits_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visits_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "visits_primary_diagnosis_id_fkey" FOREIGN KEY ("primary_diagnosis_id") REFERENCES "diseases" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "diseases_icd10_code_key" ON "diseases"("icd10_code");

-- CreateIndex
CREATE UNIQUE INDEX "disease_medications_disease_id_medication_id_key" ON "disease_medications"("disease_id", "medication_id");
