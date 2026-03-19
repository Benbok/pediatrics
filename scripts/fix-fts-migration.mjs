/**
 * Fix migration 20260319080016: FTS5 shadow tables DROP issue.
 *
 * Root cause: `DROP TABLE "guideline_chunks_fts"` drops the FTS5 virtual table
 * AND auto-cascades to all shadow tables (_config, _data, _idx, _docsize, _content).
 * Subsequent `DROP TABLE "guideline_chunks_fts_config"` etc. fail with
 * "no such table" in Prisma's shadow database validation.
 *
 * Fix: add IF EXISTS to all DROP TABLE statements so the shadow DB validation
 * passes whether or not the tables still exist at that point.
 * Then update the SHA-256 checksum in _prisma_migrations to match.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '..');

const MIGRATION_FILE = path.join(
  BASE,
  'prisma/migrations/20260319080016_add_nutrition_module/migration.sql'
);
const DB_FILE = path.join(BASE, 'prisma/dev.db');
const MIGRATION_NAME = '20260319080016_add_nutrition_module';

// Read original
const original = fs.readFileSync(MIGRATION_FILE, 'utf8');
const originalHash = crypto.createHash('sha256').update(original).digest('hex');
console.log('Original hash:', originalHash);

// Build fixed content – add IF EXISTS to every DROP TABLE
const fixed = original
  .replace(/DROP TABLE "guideline_chunks_fts"/g, 'DROP TABLE IF EXISTS "guideline_chunks_fts"')
  .replace(/DROP TABLE "guideline_chunks_fts_config"/g, 'DROP TABLE IF EXISTS "guideline_chunks_fts_config"')
  .replace(/DROP TABLE "guideline_chunks_fts_content"/g, 'DROP TABLE IF EXISTS "guideline_chunks_fts_content"')
  .replace(/DROP TABLE "guideline_chunks_fts_data"/g, 'DROP TABLE IF EXISTS "guideline_chunks_fts_data"')
  .replace(/DROP TABLE "guideline_chunks_fts_docsize"/g, 'DROP TABLE IF EXISTS "guideline_chunks_fts_docsize"')
  .replace(/DROP TABLE "guideline_chunks_fts_idx"/g, 'DROP TABLE IF EXISTS "guideline_chunks_fts_idx"');

const newHash = crypto.createHash('sha256').update(fixed).digest('hex');
console.log('New hash:     ', newHash);

if (original === fixed) {
  console.log('No changes needed – already has IF EXISTS.');
  process.exit(0);
}

console.log('\n=== FIXED SQL ===');
console.log(fixed);

// Write file
fs.writeFileSync(MIGRATION_FILE, fixed, 'utf8');
console.log('\nMigration file written.');

// Update DB checksum
const db = new Database(DB_FILE);
const stmt = db.prepare(
  'UPDATE _prisma_migrations SET checksum = ? WHERE migration_name = ?'
);
const result = stmt.run(newHash, MIGRATION_NAME);
db.close();
console.log(`Updated ${result.changes} row(s) in _prisma_migrations.`);
console.log('\nDone. Run: npx prisma migrate status');
