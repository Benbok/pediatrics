"""One-time helper: create generate_macrolide_jsons.py from aminoglycoside template."""
src = open("scripts/generate_aminoglycoside_jsons.py", encoding="utf-8").read()

# 1. Change output directory
src = src.replace(
    r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\aminoglycosides",
    r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\macrolides",
)

# 2. Change clinical pharm group filter
old_filter = "WHERE cg.Name LIKE '%\u0430\u043c\u0438\u043d\u043e\u0433\u043b\u0438\u043a\u043e\u0437%'"
new_filter = "WHERE cg.ClPhGroupsID IN (187, 188)  -- \u043c\u0430\u043a\u0440\u043e\u043b\u0438\u0434\u044b + \u0430\u0437\u0430\u043b\u0438\u0434\u044b"
src = src.replace(old_filter, new_filter)

with open("scripts/generate_macrolide_jsons.py", "w", encoding="utf-8") as f:
    f.write(src)
print("Done")
