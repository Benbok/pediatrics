-- CreateTable
CREATE TABLE "vaccine_plan_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plan_id" TEXT NOT NULL,
    "vaccine_base_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "description" TEXT,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "available_brands" TEXT,
    "lecture_id" TEXT,
    "doses" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_plan_templates_plan_id_key" ON "vaccine_plan_templates"("plan_id");
