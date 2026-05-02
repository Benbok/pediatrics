import openpyxl

def load_monthly(path, skip_last=False):
    wb = openpyxl.load_workbook(path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))[1:]
    if skip_last:
        rows = rows[:-1]
    return [(int(r[0]), float(r[1]), float(r[2]), float(r[3])) for r in rows if r[0] is not None]

BASE = r'D:\Workspace\Projects\pediatrics\zscores'

boys = (
    load_monthly(BASE + r'\lhfa_boys_0-to-2-years_zscores.xlsx', skip_last=True) +
    load_monthly(BASE + r'\lhfa_boys_2-to-5-years_zscores.xlsx', skip_last=True) +
    load_monthly(BASE + r'\hfa-boys-z-who-2007-exp.xlsx')
)
girls = (
    load_monthly(BASE + r'\lhfa_girls_0-to-2-years_zscores.xlsx', skip_last=True) +
    load_monthly(BASE + r'\lhfa_girls_2-to-5-years_zscores.xlsx', skip_last=True) +
    load_monthly(BASE + r'\hfa-girls-z-who-2007-exp.xlsx')
)

lines = [
    "/**",
    " * WHO Height/Length-for-age LMS reference tables",
    " * Sources:",
    " *   0-60 months:  WHO Child Growth Standards (2006)",
    " *   61-228 months: WHO Growth Reference 2007",
    " * L = Box-Cox power, M = median (cm), S = coefficient of variation",
    " * Note: 0-24 months = recumbent length; 24+ months = standing height",
    " */",
    "",
    "import type { LMSEntry } from './who-lms-bmi';",
    "",
    "export const WHO_HFA_BOYS: LMSEntry[] = [",
]
for (age, L, M, S) in boys:
    lines.append(f"  {{ age: {age}, L: {L}, M: {M}, S: {S} }},")
lines.append("];")
lines.append("")
lines.append("export const WHO_HFA_GIRLS: LMSEntry[] = [")
for (age, L, M, S) in girls:
    lines.append(f"  {{ age: {age}, L: {L}, M: {M}, S: {S} }},")
lines.append("];")

out = "\n".join(lines) + "\n"
dest = r'D:\Workspace\Projects\pediatrics\src\data\who-lms-hfa.ts'
with open(dest, 'w', encoding='utf-8') as f:
    f.write(out)
print(f"Written {dest}, {len(out)} chars, boys={len(boys)}, girls={len(girls)}")
