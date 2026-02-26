-- CreateTable
CREATE TABLE "guideline_chunks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guideline_id" INTEGER NOT NULL,
    "disease_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "page_start" INTEGER,
    "page_end" INTEGER,
    "section_title" TEXT,
    "text" TEXT NOT NULL,
    "embedding_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guideline_chunks_guideline_id_fkey" FOREIGN KEY ("guideline_id") REFERENCES "clinical_guidelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "guideline_chunks_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "guideline_chunks_guideline_id_idx" ON "guideline_chunks"("guideline_id");
CREATE INDEX "guideline_chunks_disease_id_idx" ON "guideline_chunks"("disease_id");

-- FTS5 virtual table for fast lexical search (BM25)
-- Uses external content table guideline_chunks to keep rowid aligned with guideline_chunks.id
CREATE VIRTUAL TABLE "guideline_chunks_fts" USING fts5(
    text,
    chunk_id UNINDEXED,
    disease_id UNINDEXED,
    guideline_id UNINDEXED,
    type UNINDEXED,
    content='guideline_chunks',
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER guideline_chunks_ai AFTER INSERT ON guideline_chunks BEGIN
  INSERT INTO guideline_chunks_fts(rowid, text, chunk_id, disease_id, guideline_id, type)
  VALUES (new.id, new.text, new.id, new.disease_id, new.guideline_id, new.type);
END;

CREATE TRIGGER guideline_chunks_ad AFTER DELETE ON guideline_chunks BEGIN
  INSERT INTO guideline_chunks_fts(guideline_chunks_fts, rowid, text, chunk_id, disease_id, guideline_id, type)
  VALUES('delete', old.id, old.text, old.id, old.disease_id, old.guideline_id, old.type);
END;

CREATE TRIGGER guideline_chunks_au AFTER UPDATE ON guideline_chunks BEGIN
  INSERT INTO guideline_chunks_fts(guideline_chunks_fts, rowid, text, chunk_id, disease_id, guideline_id, type)
  VALUES('delete', old.id, old.text, old.id, old.disease_id, old.guideline_id, old.type);

  INSERT INTO guideline_chunks_fts(rowid, text, chunk_id, disease_id, guideline_id, type)
  VALUES (new.id, new.text, new.id, new.disease_id, new.guideline_id, new.type);
END;
