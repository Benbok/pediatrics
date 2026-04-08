import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()
cur.execute("""
    SELECT name_ru FROM medications 
    WHERE atc_code IN ('R05CB01', 'R05CB02', 'R05CB03', 'R05CB06') 
    ORDER BY atc_code, name_ru
""")

for i, (name,) in enumerate(cur.fetchall(), 1):
    print(f'{i}. {name}')

conn.close()
