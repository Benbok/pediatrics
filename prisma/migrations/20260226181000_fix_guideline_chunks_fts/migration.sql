-- Drop previous FTS table/triggers if they exist (created in earlier migration)
DROP TRIGGER IF EXISTS guideline_chunks_ai;
DROP TRIGGER IF EXISTS guideline_chunks_ad;
DROP TRIGGER IF EXISTS guideline_chunks_au;

DROP TABLE IF EXISTS guideline_chunks_fts;

-- Re-create FTS5 virtual table without external content linkage.
-- This avoids relying on content table columns beyond the indexed `text`.
CREATE VIRTUAL TABLE "guideline_chunks_fts" USING fts5(
    text,
    chunk_id UNINDEXED,
    disease_id UNINDEXED,
    guideline_id UNINDEXED,
    type UNINDEXED
);

-- Triggers to keep FTS in sync with guideline_chunks
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
