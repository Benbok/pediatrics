import sqlite3
db = sqlite3.connect('prisma/dev.db')
c = db.cursor()
print("=== guideline* objects ===")
c.execute("SELECT type, name FROM sqlite_master WHERE name LIKE 'guideline%' ORDER BY type, name")
for r in c.fetchall():
    print(r)
print("\n=== nutrition* tables ===")
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nutrition%' ORDER BY name")
for r in c.fetchall():
    print(r)
db.close()
