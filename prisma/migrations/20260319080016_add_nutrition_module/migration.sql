/*
  Fix: FTS5 shadow tables are auto-dropped when the main virtual table is dropped.
  Using IF EXISTS prevents "no such table" errors in shadow database validation.
*/

-- DropTable (FTS virtual table - cascades to all shadow tables)
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts";
PRAGMA foreign_keys=on;

-- DropTable (shadow tables - may already be gone after dropping the virtual table)
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts_config";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts_content";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts_data";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts_docsize";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts_idx";
PRAGMA foreign_keys=on;
