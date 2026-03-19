"""
Fix migration 20260319080016 FTS shadow table DROP issue.

Root cause: DROP TABLE "guideline_chunks_fts" auto-drops all FTS5 shadow tables.
Subsequent DROP TABLE "guideline_chunks_fts_config" etc. fail with "no such table".

Fix: add IF EXISTS to all DROP TABLE statements in this migration,
     then update the checksum in _prisma_migrations to match the new file.
"""
import hashlib
import sqlite3
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
migration_file = os.path.join(BASE, "prisma", "migrations", "20260319080016_add_nutrition_module", "migration.sql")
db_file = os.path.join(BASE, "prisma", "dev.db")
migration_name = "20260319080016_add_nutrition_module"

# Read original
with open(migration_file, "r", encoding="utf-8") as f:
    original = f.read()

print("=== ORIGINAL ===")
print(original)
print()

# Calculate original hash
original_hash = hashlib.sha256(original.encode("utf-8")).hexdigest()
print("Original SHA-256:", original_hash)

# Check DB record
conn = sqlite3.connect(db_file)
c = conn.cursor()
c.execute("SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name = ?", (migration_name,))
row = c.fetchone()
print("DB row:", row)
conn.close()

# Build fixed SQL: drop main virtual table (cascades), then IF EXISTS for shadows
fixed = """/*
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
"""

new_hash = hashlib.sha256(fixed.encode("utf-8")).hexdigest()
print("\nNew SHA-256:", new_hash)

# Write fixed file
with open(migration_file, "w", encoding="utf-8") as f:
    f.write(fixed)
print("Migration file updated.")

# Update checksum in DB
conn = sqlite3.connect(db_file)
c = conn.cursor()
c.execute(
    "UPDATE _prisma_migrations SET checksum = ? WHERE migration_name = ?",
    (new_hash, migration_name)
)
conn.commit()
rows_affected = c.rowcount
conn.close()

print(f"Updated {rows_affected} row(s) in _prisma_migrations.")
print("\nDone. Now run: npx prisma migrate status")
