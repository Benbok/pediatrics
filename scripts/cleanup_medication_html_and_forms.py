import json
import os
import re
import sqlite3
from html import unescape

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')


def strip_html(value):
    if value is None:
        return None
    text = str(value)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def normalize_form_type(value):
    if not value:
        return None
    text = str(value).strip().lower()
    form_map = {
        'мазь': 'ointment',
        'ointment': 'ointment',
        'таблетки': 'tablet',
        'таблетка': 'tablet',
        'tablet': 'tablet',
        'капсулы': 'capsule',
        'капсула': 'capsule',
        'capsule': 'capsule',
        'раствор': 'solution',
        'solution': 'solution',
        'сироп': 'syrup',
        'syrup': 'syrup',
        'суспензия': 'suspension',
        'suspension': 'suspension',
        'порошок': 'powder',
        'powder': 'powder',
        'капли': 'drops',
        'drops': 'drops',
        'крем': 'cream',
        'cream': 'cream',
    }
    return form_map.get(text, text)


def normalize_forms_json(forms_json):
    if not forms_json:
        return forms_json
    try:
        forms = json.loads(forms_json)
    except Exception:
        return forms_json
    if not isinstance(forms, list):
        return forms_json

    changed = False
    out = []
    for form in forms:
        if not isinstance(form, dict):
            out.append(form)
            continue
        item = dict(form)
        old_type = item.get('type')
        new_type = normalize_form_type(old_type) or 'other'
        if new_type != old_type:
            item['type'] = new_type
            changed = True

        old_desc = item.get('description')
        if old_desc is not None:
            new_desc = strip_html(old_desc)
            if new_desc != old_desc:
                item['description'] = new_desc
                changed = True

        out.append(item)

    if not changed:
        return forms_json
    return json.dumps(out, ensure_ascii=False)


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute('SELECT id, name_ru, name_en, active_substance, forms FROM medications')
    rows = cur.fetchall()

    updated = 0
    for med_id, name_ru, name_en, active_substance, forms_json in rows:
        new_name_ru = strip_html(name_ru) or ''
        new_name_en = strip_html(name_en)
        new_active = strip_html(active_substance) or new_name_ru
        new_forms = normalize_forms_json(forms_json)

        if (
            new_name_ru != name_ru
            or new_name_en != name_en
            or new_active != active_substance
            or new_forms != forms_json
        ):
            cur.execute(
                '''
                UPDATE medications
                SET name_ru = ?,
                    name_en = ?,
                    active_substance = ?,
                    forms = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                ''',
                (new_name_ru, new_name_en, new_active, new_forms, med_id),
            )
            updated += 1

    conn.commit()
    conn.close()
    print(f'Updated medications: {updated}')


if __name__ == '__main__':
    main()
