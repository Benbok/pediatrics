import sqlite3

db = sqlite3.connect('prisma/dev.db')
c = db.cursor()

# List all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
print('All tables:')
for r in c.fetchall():
    print(' ', r[0])

# Find disease table by checking columns
for table in ['diseases', 'Disease', 'disease']:
    try:
        c.execute(f'PRAGMA table_info("{table}")')
        cols = [r[1] for r in c.fetchall()]
        if cols:
            print(f'\nTable "{table}" columns:', cols)
            if 'clinical_recommendations' not in cols:
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN clinical_recommendations TEXT')
                db.commit()
                print(f'Column added to "{table}"')
            else:
                print(f'Column already exists in "{table}"')
    except Exception as e:
        pass

db.close()

