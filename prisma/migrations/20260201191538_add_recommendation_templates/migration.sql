-- CreateTable
CREATE TABLE "recommendation_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "recommendation_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "recommendation_templates_created_by_id_idx" ON "recommendation_templates"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_templates_created_by_id_name_key" ON "recommendation_templates"("created_by_id", "name");
