"""
Apply migration 20260407120000_add_evidence_valid_until to prisma/dev.db.
Run from repo root: python scripts/apply_evidence_migration.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')
MIGRATION_NAME = '20260407120000_add_evidence_valid_until'

SQL_STATEMENTS = [
    'ALTER TABLE "guideline_chunks" ADD COLUMN "evidence_level" TEXT;',
    'ALTER TABLE "clinical_guidelines" ADD COLUMN "valid_until" DATETIME;',
]

def column_exists(cursor, table, column):
    cursor.execute(f'PRAGMA table_info("{table}")')
    return any(row[1] == column for row in cursor.fetchall())

def main():
    db = os.path.abspath(DB_PATH)
    if not os.path.exists(db):
        print(f'ERROR: dev.db not found at {db}', file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db)
    cur = conn.cursor()

    try:
        # Apply only if columns don't already exist (idempotent)
        if not column_exists(cur, 'guideline_chunks', 'evidence_level'):
            cur.execute('ALTER TABLE "guideline_chunks" ADD COLUMN "evidence_level" TEXT;')
            print('[OK] Added evidence_level to guideline_chunks')
        else:
            print('[SKIP] evidence_level already exists in guideline_chunks')

        if not column_exists(cur, 'clinical_guidelines', 'valid_until'):
            cur.execute('ALTER TABLE "clinical_guidelines" ADD COLUMN "valid_until" DATETIME;')
            print('[OK] Added valid_until to clinical_guidelines')
        else:
            print('[SKIP] valid_until already exists in clinical_guidelines')

        conn.commit()
        print('[DONE] Migration applied successfully')
    except Exception as e:
        conn.rollback()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
