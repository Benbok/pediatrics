-- Удаляем старое поле symptoms_vector, если оно существует
-- и переименовываем в symptoms_embedding, если нужно

-- Проверяем, существует ли старое поле
-- SQLite не поддерживает IF EXISTS для ALTER TABLE, поэтому используем другой подход

-- Если поле symptoms_vector существует, создаем новую таблицу без него
-- и копируем данные (если symptoms_embedding еще не существует)

PRAGMA foreign_keys=OFF;

-- Создаем временную таблицу с правильной структурой
CREATE TABLE IF NOT EXISTS "diseases_temp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "icd10_code" TEXT NOT NULL,
    "icd10_codes" TEXT NOT NULL DEFAULT '[]',
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL DEFAULT '[]',
    "symptoms_embedding" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Копируем данные из старой таблицы (игнорируя symptoms_vector, если он есть)
INSERT INTO "diseases_temp" ("id", "icd10_code", "icd10_codes", "name_ru", "name_en", "description", "symptoms", "symptoms_embedding", "created_at")
SELECT 
    "id",
    "icd10_code",
    "icd10_codes",
    "name_ru",
    "name_en",
    "description",
    "symptoms",
    COALESCE("symptoms_embedding", "symptoms_vector", NULL) as "symptoms_embedding",
    "created_at"
FROM "diseases";

-- Удаляем старую таблицу
DROP TABLE IF EXISTS "diseases";

-- Переименовываем временную таблицу
ALTER TABLE "diseases_temp" RENAME TO "diseases";

-- Восстанавливаем индекс
CREATE UNIQUE INDEX IF NOT EXISTS "diseases_icd10_code_key" ON "diseases"("icd10_code");

PRAGMA foreign_keys=ON;
