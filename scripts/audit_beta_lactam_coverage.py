import sqlite3
from collections import Counter


VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
DEV_DB = r"C:\Users\Arty\Desktop\Django\pediatrics\prisma\dev.db"

GROUPS = [
    ("penicillins", ["J01C%"]),
    ("cephalosporins", ["J01DB%", "J01DC%", "J01DD%", "J01DE%", "J01DI%"]),
    ("monobactams", ["J01DF%"]),
    ("carbapenems", ["J01DH%"]),
]


def build_like_clause(column_name, patterns):
    return " OR ".join(f"{column_name} LIKE '{pattern}'" for pattern in patterns)


def fetch_vidal_counts(conn):
    result = {}
    total = 0
    for group_name, patterns in GROUPS:
        where_clause = build_like_clause("patc.ATCCode", patterns)
        count = conn.execute(
            f"""
            SELECT COUNT(DISTINCT pd.DocumentID)
            FROM Product_ATC patc
            JOIN Product_Document pd ON pd.ProductID = patc.ProductID
            WHERE {where_clause}
            """
        ).fetchone()[0]
        result[group_name] = count
        total += count
    return result, total


def fetch_dev_counts(conn):
    result = {}
    total = 0
    for group_name, patterns in GROUPS:
        where_clause = build_like_clause("atc_code", patterns)
        count = conn.execute(
            f"SELECT COUNT(*) FROM medications WHERE {where_clause}"
        ).fetchone()[0]
        result[group_name] = count
        total += count
    return result, total


def fetch_route_counts(conn):
    where_parts = []
    for _, patterns in GROUPS:
        where_parts.extend(patterns)
    where_clause = build_like_clause("atc_code", where_parts)
    rows = conn.execute(
        f"SELECT route_of_admin FROM medications WHERE {where_clause}"
    ).fetchall()
    counter = Counter((row[0] or "<null>") for row in rows)
    return dict(sorted(counter.items(), key=lambda item: (item[0], item[1])))


def print_summary(title, counts, total):
    print(title)
    print("-" * len(title))
    for group_name, value in counts.items():
        print(f"{group_name}: {value}")
    print(f"total: {total}")
    print()


def main():
    vidal = sqlite3.connect(VIDAL_DB)
    dev = sqlite3.connect(DEV_DB)

    try:
        vidal_counts, vidal_total = fetch_vidal_counts(vidal)
        dev_counts, dev_total = fetch_dev_counts(dev)
        route_counts = fetch_route_counts(dev)

        print_summary("Vidal source coverage", vidal_counts, vidal_total)
        print_summary("Imported dev.db coverage", dev_counts, dev_total)

        print("Coverage delta (source - imported)")
        print("-------------------------------")
        for group_name, _ in GROUPS:
            delta = vidal_counts[group_name] - dev_counts[group_name]
            print(f"{group_name}: {delta}")
        print()

        print("Route distribution in dev.db")
        print("----------------------------")
        for route, count in route_counts.items():
            print(f"{route}: {count}")
    finally:
        vidal.close()
        dev.close()


if __name__ == "__main__":
    main()