-- Migration: add evidence_level to guideline_chunks, valid_until to clinical_guidelines
-- Created: 2026-04-07

ALTER TABLE "guideline_chunks" ADD COLUMN "evidence_level" TEXT;

ALTER TABLE "clinical_guidelines" ADD COLUMN "valid_until" DATETIME;
