-- CreateTable: disease_qa_cache
-- Pre-computed RAG answers for standard clinical questions per disease.
-- Populated by the background precompute worker after guideline upload.

CREATE TABLE "disease_qa_cache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "disease_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disease_qa_cache_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "disease_qa_cache_disease_id_template_id_key" ON "disease_qa_cache"("disease_id", "template_id");

-- CreateIndex
CREATE INDEX "disease_qa_cache_disease_id_idx" ON "disease_qa_cache"("disease_id");
