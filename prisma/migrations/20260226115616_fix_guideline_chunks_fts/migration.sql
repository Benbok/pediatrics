-- Fix migration: make FTS teardown safe (FTS5 creates multiple shadow tables).
-- This migration must be idempotent because databases may not yet have these objects.

DROP TRIGGER IF EXISTS guideline_chunks_ai;
DROP TRIGGER IF EXISTS guideline_chunks_ad;
DROP TRIGGER IF EXISTS guideline_chunks_au;

PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "guideline_chunks_fts";
DROP TABLE IF EXISTS "guideline_chunks_fts_config";
DROP TABLE IF EXISTS "guideline_chunks_fts_content";
DROP TABLE IF EXISTS "guideline_chunks_fts_data";
DROP TABLE IF EXISTS "guideline_chunks_fts_docsize";
DROP TABLE IF EXISTS "guideline_chunks_fts_idx";
PRAGMA foreign_keys=on;
