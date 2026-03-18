-- CreateTable
CREATE TABLE "vaccine_catalog_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaccine_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "age_month_start" INTEGER NOT NULL,
    "description" TEXT,
    "required_risk_factor" TEXT,
    "excluded_risk_factor" TEXT,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "available_brands" TEXT,
    "lecture_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_catalog_entries_vaccine_id_key" ON "vaccine_catalog_entries"("vaccine_id");
