import sqlite3

db = sqlite3.connect('prisma/dev.db')
c = db.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS "diagnostic_test_catalog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_ru" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "is_standard" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
)
""")

c.execute("""
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_test_catalog_name_ru_key"
ON "diagnostic_test_catalog"("name_ru")
""")

c.execute("""
CREATE INDEX IF NOT EXISTS "diagnostic_test_catalog_type_idx"
ON "diagnostic_test_catalog"("type")
""")

db.commit()

# Verify
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostic_test_catalog'")
row = c.fetchone()
if row:
    print("OK: table 'diagnostic_test_catalog' created successfully")
else:
    print("ERROR: table was not created")

db.close()
