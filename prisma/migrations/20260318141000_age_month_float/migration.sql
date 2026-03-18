-- Recreate vaccine_catalog_entries with REAL age_month_start
CREATE TABLE "new_vaccine_catalog_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaccine_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "age_month_start" REAL NOT NULL,
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

INSERT INTO "new_vaccine_catalog_entries" (
    "id", "vaccine_id", "name", "disease", "age_month_start", "description",
    "required_risk_factor", "excluded_risk_factor", "is_live", "is_recommended",
    "available_brands", "lecture_id", "is_deleted", "created_at", "updated_at"
)
SELECT
    "id", "vaccine_id", "name", "disease", CAST("age_month_start" AS REAL), "description",
    "required_risk_factor", "excluded_risk_factor", "is_live", "is_recommended",
    "available_brands", "lecture_id", "is_deleted", "created_at", "updated_at"
FROM "vaccine_catalog_entries";

DROP TABLE "vaccine_catalog_entries";
ALTER TABLE "new_vaccine_catalog_entries" RENAME TO "vaccine_catalog_entries";

CREATE UNIQUE INDEX "vaccine_catalog_entries_vaccine_id_key" ON "vaccine_catalog_entries"("vaccine_id");
