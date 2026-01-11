-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "patient_shares" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "child_id" INTEGER NOT NULL,
    "shared_by" INTEGER NOT NULL,
    "shared_with" INTEGER NOT NULL,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_shares_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "patient_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "patient_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "children" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "patronymic" TEXT,
    "birth_date" TEXT NOT NULL,
    "birth_weight" INTEGER NOT NULL DEFAULT 0,
    "gender" TEXT NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "children_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vaccination_profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "child_id" INTEGER NOT NULL,
    "hep_b_risk_factors" TEXT,
    "pneumo_risk_factors" TEXT,
    "pertussis_contraindications" TEXT,
    "polio_risk_factors" TEXT,
    "mmr_contraindications" TEXT,
    "mening_risk_factors" TEXT,
    "varicella_risk_factors" TEXT,
    "hepa_risk_factors" TEXT,
    "flu_risk_factors" TEXT,
    "hpv_risk_factors" TEXT,
    "tbe_risk_factors" TEXT,
    "rota_risk_factors" TEXT,
    "mantoux_date" TEXT,
    "mantoux_result" BOOLEAN,
    "custom_vaccines" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vaccination_profiles_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vaccination_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "child_id" INTEGER NOT NULL,
    "vaccine_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_date" TEXT,
    "vaccine_brand" TEXT,
    "notes" TEXT,
    "dose" TEXT,
    "series" TEXT,
    "expiry_date" TEXT,
    "manufacturer" TEXT,
    "created_by_user_id" INTEGER,
    CONSTRAINT "vaccination_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vaccination_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "patient_shares_child_id_shared_with_key" ON "patient_shares"("child_id", "shared_with");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_profiles_child_id_key" ON "vaccination_profiles"("child_id");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_records_child_id_vaccine_id_key" ON "vaccination_records"("child_id", "vaccine_id");
