-- CreateTable
CREATE TABLE "diagnostic_test_catalog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_ru" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "is_standard" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_test_catalog_name_ru_key" ON "diagnostic_test_catalog"("name_ru");

-- CreateIndex
CREATE INDEX "diagnostic_test_catalog_type_idx" ON "diagnostic_test_catalog"("type");
