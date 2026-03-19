/*
  Warnings:

  - You are about to drop the `guideline_chunks_fts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `guideline_chunks_fts_config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `guideline_chunks_fts_content` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `guideline_chunks_fts_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `guideline_chunks_fts_docsize` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `guideline_chunks_fts_idx` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `birth_weight` on the `children` table. All the data in the column will be lost.

*/
-- NOTE:
-- FTS tables are managed by dedicated guideline migrations.
-- Nutrition migration must not alter them to avoid trigger/shadow DB conflicts.

-- CreateTable
CREATE TABLE "nutrition_age_norms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feeding_stage" TEXT NOT NULL,
    "age_min_days" INTEGER NOT NULL,
    "age_max_days" INTEGER NOT NULL,
    "energy_kcal_per_kg" REAL,
    "fixed_energy_kcal" REAL,
    "volume_factor_min" REAL,
    "volume_factor_max" REAL,
    "total_food_min_g" REAL,
    "total_food_max_g" REAL,
    "meals_per_day" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "nutrition_product_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_age_days" INTEGER NOT NULL,
    "max_age_days" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "nutrition_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_id" INTEGER NOT NULL,
    "brand" TEXT,
    "name" TEXT NOT NULL,
    "energy_kcal_per_100ml" REAL,
    "energy_kcal_per_100g" REAL,
    "protein_g_per_100g" REAL,
    "fat_g_per_100g" REAL,
    "carbs_g_per_100g" REAL,
    "min_age_days" INTEGER NOT NULL,
    "max_age_days" INTEGER NOT NULL,
    "formula_type" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "composition_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "nutrition_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "nutrition_product_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nutrition_feeding_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "age_min_days" INTEGER NOT NULL,
    "age_max_days" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "nutrition_feeding_template_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "template_id" INTEGER NOT NULL,
    "meal_order" INTEGER NOT NULL,
    "product_category_id" INTEGER NOT NULL,
    "portion_size_g" REAL NOT NULL,
    "is_example" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    CONSTRAINT "nutrition_feeding_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "nutrition_feeding_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nutrition_feeding_template_items_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "nutrition_product_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "child_feeding_plans" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "child_id" INTEGER NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "age_days" INTEGER NOT NULL,
    "weight_kg" REAL NOT NULL,
    "birth_weight_g" INTEGER,
    "feeding_type" TEXT NOT NULL,
    "daily_energy_need_kcal" REAL NOT NULL,
    "daily_volume_need_ml" REAL,
    "meals_per_day" INTEGER NOT NULL,
    "estimated_breast_milk_ml" REAL,
    "formula_volume_ml" REAL,
    "formula_id" INTEGER,
    "comments" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "child_feeding_plans_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "child_feeding_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_feeding_plans_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "nutrition_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_children" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "patronymic" TEXT,
    "birth_date" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "children_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_children" ("birth_date", "created_at", "created_by_user_id", "gender", "id", "name", "patronymic", "surname") SELECT "birth_date", "created_at", "created_by_user_id", "gender", "id", "name", "patronymic", "surname" FROM "children";
DROP TABLE "children";
ALTER TABLE "new_children" RENAME TO "children";
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("created_at", "first_name", "id", "is_active", "is_admin", "last_name", "middle_name", "password_hash", "username") SELECT "created_at", "first_name", "id", "is_active", "is_admin", "last_name", "middle_name", "password_hash", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_product_categories_code_key" ON "nutrition_product_categories"("code");

-- CreateIndex
CREATE INDEX "child_feeding_plans_child_id_idx" ON "child_feeding_plans"("child_id");
