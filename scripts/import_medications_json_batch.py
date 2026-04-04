import argparse
import glob
import json
import os
import re
import sqlite3
from html import unescape
from datetime import datetime, timezone

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')
DEFAULT_DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    '..',
    'src',
    'modules',
    'medications',
    'data',
    'aminoglycosides',
)

KNOWN_JSON_KEYS = {
    'nameRu', 'nameEn', 'activeSubstance', 'atcCode', 'icd10Codes',
    'packageDescription', 'manufacturer', 'forms',
    'pediatricDosing', 'adultDosing',
    'contraindications', 'cautionConditions', 'sideEffects', 'interactions',
    'pregnancy', 'lactation', 'indications', 'vidalUrl',
    'clinicalPharmGroup', 'pharmTherapyGroup',
    'minInterval', 'maxDosesPerDay', 'maxDurationDays',
    'routeOfAdmin', 'isFavorite', 'userTags',
    'isOtc', 'overdose', 'childDosing', 'childUsing',
    'renalInsuf', 'renalUsing', 'hepatoInsuf', 'hepatoUsing',
    'specialInstruction', 'pharmacokinetics', 'pharmacodynamics',
    'fullInstruction',
}


def to_json(value):
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


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


def normalize_forms(forms):
    if not isinstance(forms, list):
        return []
    out = []
    for form in forms:
        if not isinstance(form, dict):
            continue
        item = dict(form)
        item['type'] = normalize_form_type(item.get('type')) or 'other'
        if item.get('description') is not None:
            item['description'] = strip_html(item.get('description'))
        out.append(item)
    return out


def sanitize_full_instruction(value):
    if value is None:
        return None
    if isinstance(value, str):
        return strip_html(value)
    if isinstance(value, dict):
        parts = []
        for item in value.values():
            if item is None:
                continue
            clean = strip_html(item) if isinstance(item, str) else strip_html(str(item))
            if clean:
                parts.append(clean)
        return "\n\n".join(parts) if parts else None
    if isinstance(value, list):
        parts = []
        for item in value:
            clean = strip_html(item) if isinstance(item, str) else strip_html(str(item))
            if clean:
                parts.append(clean)
        return "\n\n".join(parts) if parts else None
    return strip_html(str(value))


def normalize_route(value):
    """
    Normalize any route string to valid RouteOfAdmin enum value.
    Handles: raw vidal ZipInfo text, short aliases, English terms, Russian terms.
    Valid output values: oral, rectal, iv_bolus, iv_infusion, iv_slow,
                         im, sc, sublingual, topical, inhalation, intranasal, transdermal
    """
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None

    # Exact match map (most common values from generator + user input)
    route_map = {
        # oral
        'oral': 'oral',
        'per os': 'oral',
        'peroral': 'oral',
        'внутрь': 'oral',
        'перорал': 'oral',
        # rectal
        'rectal': 'rectal',
        'ректальн': 'rectal',
        'per rectum': 'rectal',
        # iv variants
        'iv': 'iv_infusion',
        'intravenous': 'iv_infusion',
        'iv_infusion': 'iv_infusion',
        'в/в капельно': 'iv_infusion',
        'в/в': 'iv_infusion',
        'внутривенно': 'iv_infusion',
        'iv_bolus': 'iv_bolus',
        'iv bolus': 'iv_bolus',
        'болюс': 'iv_bolus',
        'болюсно': 'iv_bolus',
        'струйно': 'iv_bolus',
        'в/в струйно': 'iv_bolus',
        'iv_slow': 'iv_slow',
        'iv slow': 'iv_slow',
        'в/в медленно': 'iv_slow',
        # im
        'im': 'im',
        'intramuscular': 'im',
        'в/м': 'im',
        'внутримышечно': 'im',
        # sc
        'sc': 'sc',
        'subcutaneous': 'sc',
        'п/к': 'sc',
        'подкожно': 'sc',
        's/c': 'sc',
        # sublingual
        'sublingual': 'sublingual',
        'подъязычно': 'sublingual',
        'сублингвально': 'sublingual',
        # topical
        'topical': 'topical',
        'наружно': 'topical',
        'местно': 'topical',
        # inhalation
        'inhalation': 'inhalation',
        'ингаляционно': 'inhalation',
        # intranasal
        'intranasal': 'intranasal',
        'интраназально': 'intranasal',
        'назально': 'intranasal',
        # transdermal
        'transdermal': 'transdermal',
        'трансдермально': 'transdermal',
    }

    if text in route_map:
        return route_map[text]

    # Token-based fallback for longer/mixed strings (priority: bolus > slow > iv > im > sc > ...)
    if 'струйно' in text or 'болюс' in text:
        return 'iv_bolus'
    if ('в/в' in text or 'внутрив' in text) and 'медленно' in text:
        return 'iv_slow'
    if 'в/в' in text or 'внутрив' in text or 'iv' in text or 'инфуз' in text:
        return 'iv_infusion'
    if 'в/м' in text or 'внутрим' in text:
        return 'im'
    if 'п/к' in text or 'подкожн' in text:
        return 'sc'
    if 'сублингв' in text or 'подъязычн' in text:
        return 'sublingual'
    if 'трансдерм' in text or 'пластырь' in text:
        return 'transdermal'
    if 'ректальн' in text:
        return 'rectal'
    if 'назал' in text or 'интраназ' in text:
        return 'intranasal'
    if 'ингаля' in text:
        return 'inhalation'
    if any(k in text for k in ('наруж', 'местн', 'глазн', 'офтальм', 'ушн', 'вагинальн')):
        return 'topical'
    if any(k in text for k in ('перорал', 'внутрь')):
        return 'oral'

    return None


def normalize_dosing_rules(rules):
    if not isinstance(rules, list):
        return []
    out = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        item = dict(rule)
        item['routeOfAdmin'] = normalize_route(item.get('routeOfAdmin'))
        out.append(item)
    return out


def infer_route_candidates_from_forms(forms):
    routes = []
    seen = set()
    for form in forms:
        if not isinstance(form, dict):
            continue
        route = normalize_route(form.get('description'))
        if route and route not in seen:
            seen.add(route)
            routes.append(route)
    return routes


def choose_route_of_admin(explicit_route, pediatric, adult, forms):
    route_of_admin = normalize_route(explicit_route)
    if route_of_admin is not None:
        return route_of_admin

    inferred_routes = []
    seen = set()

    for route in infer_route_candidates_from_forms(forms):
        if route not in seen:
            seen.add(route)
            inferred_routes.append(route)

    for rule in pediatric + adult:
        route = rule.get('routeOfAdmin')
        if route and route not in seen:
            seen.add(route)
            inferred_routes.append(route)

    if len(inferred_routes) == 1:
        return inferred_routes[0]
    return None


def map_payload(data):
    pediatric = normalize_dosing_rules(data.get('pediatricDosing') or [])
    adult = normalize_dosing_rules(data.get('adultDosing') or [])
    forms = normalize_forms(data.get('forms') or [])
    full_instruction = sanitize_full_instruction(data.get('fullInstruction'))

    name_ru = strip_html(data.get('nameRu')) or ''
    active_substance = strip_html(data.get('activeSubstance')) or name_ru

    route_of_admin = choose_route_of_admin(data.get('routeOfAdmin'), pediatric, adult, forms)

    return {
        'name_ru': name_ru,
        'name_en': strip_html(data.get('nameEn')),
        'active_substance': active_substance,
        'atc_code': data.get('atcCode'),
        'icd10_codes': to_json(data.get('icd10Codes') or []),
        'package_description': strip_html(data.get('packageDescription')),
        'manufacturer': strip_html(data.get('manufacturer')),
        'forms': to_json(forms),
        'pediatric_dosing': to_json(pediatric),
        'adult_dosing': to_json(adult),
        'contraindications': data.get('contraindications') or '',
        'caution_conditions': data.get('cautionConditions'),
        'side_effects': data.get('sideEffects'),
        'interactions': data.get('interactions'),
        'pregnancy': data.get('pregnancy'),
        'lactation': data.get('lactation'),
        'indications': to_json(data.get('indications') or []),
        'vidal_url': data.get('vidalUrl'),
        'clinical_pharm_group': data.get('clinicalPharmGroup'),
        'pharm_therapy_group': data.get('pharmTherapyGroup'),
        'min_interval': data.get('minInterval'),
        'max_doses_per_day': data.get('maxDosesPerDay'),
        'max_duration_days': data.get('maxDurationDays'),
        'route_of_admin': route_of_admin,
        'is_favorite': 1 if data.get('isFavorite') else 0,
        'user_tags': to_json(data.get('userTags')) if data.get('userTags') is not None else None,
        'is_otc': 1 if data.get('isOtc') else 0,
        'overdose': data.get('overdose'),
        'child_dosing': data.get('childDosing'),
        'child_using': data.get('childUsing'),
        'renal_insuf': data.get('renalInsuf'),
        'renal_using': data.get('renalUsing'),
        'hepato_insuf': data.get('hepatoInsuf'),
        'hepato_using': data.get('hepatoUsing'),
        'special_instruction': data.get('specialInstruction'),
        'pharmacokinetics': data.get('pharmacokinetics'),
        'pharmacodynamics': data.get('pharmacodynamics'),
        'full_instruction': full_instruction,
    }


def parse_args():
    parser = argparse.ArgumentParser(
        description='Universal batch JSON importer for medications table.'
    )
    parser.add_argument(
        '--dir',
        dest='data_dir',
        default=DEFAULT_DATA_DIR,
        help='Directory with medication JSON files (default: medications/data/aminoglycosides)'
    )
    parser.add_argument(
        '--db',
        dest='db_path',
        default=DEFAULT_DB_PATH,
        help='Path to sqlite database file (default: prisma/dev.db)'
    )
    parser.add_argument(
        '--pattern',
        default='*.json',
        help='Glob pattern for files (default: *.json)'
    )
    parser.add_argument(
        '--recursive',
        action='store_true',
        help='Search files recursively in --dir'
    )
    parser.add_argument(
        '--on-duplicate',
        choices=['update', 'skip'],
        default='update',
        help='What to do when nameRu already exists (default: update)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Parse and validate files without writing to DB'
    )
    parser.add_argument(
        '--upsert-by',
        choices=['name_ru', 'name_ru_atc', 'name_ru_active_substance'],
        default='name_ru',
        help='Upsert matching strategy (default: name_ru)'
    )
    parser.add_argument(
        '--strict-keys',
        action='store_true',
        help='Fail file import when JSON has unknown top-level keys'
    )
    return parser.parse_args()


def validate_payload_keys(payload, strict_keys=False):
    unknown = sorted(set(payload.keys()) - KNOWN_JSON_KEYS)
    if not unknown:
        return
    msg = f'Unknown keys: {", ".join(unknown)}'
    if strict_keys:
        raise ValueError(msg)
    print(f'Warning: {msg}')


def build_upsert_match(row, strategy):
    if strategy == 'name_ru':
        return (
            'name_ru = :match_name_ru',
            {'match_name_ru': row['name_ru']}
        )

    if strategy == 'name_ru_atc':
        return (
            'name_ru = :match_name_ru AND COALESCE(atc_code, "") = COALESCE(:match_atc_code, "")',
            {
                'match_name_ru': row['name_ru'],
                'match_atc_code': row['atc_code'],
            }
        )

    if strategy == 'name_ru_active_substance':
        return (
            'name_ru = :match_name_ru AND COALESCE(active_substance, "") = COALESCE(:match_active_substance, "")',
            {
                'match_name_ru': row['name_ru'],
                'match_active_substance': row['active_substance'],
            }
        )

    raise ValueError(f'Unsupported upsert strategy: {strategy}')


def main():
    args = parse_args()
    search_pattern = os.path.join(
        args.data_dir,
        '**',
        args.pattern
    ) if args.recursive else os.path.join(args.data_dir, args.pattern)

    files = sorted(glob.glob(search_pattern, recursive=args.recursive))
    if not files:
        print(f'No json files found in {args.data_dir} ({args.pattern})')
        return

    db = sqlite3.connect(args.db_path)
    db.execute('PRAGMA foreign_keys=ON')
    cur = db.cursor()

    created = 0
    updated = 0
    errors = 0
    warnings = 0

    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                payload = json.load(f)

            pre_warn_count = warnings
            unknown_keys = sorted(set(payload.keys()) - KNOWN_JSON_KEYS)
            if unknown_keys:
                validate_payload_keys(payload, strict_keys=args.strict_keys)
                if not args.strict_keys:
                    warnings += 1

            row = map_payload(payload)
            if not row['name_ru']:
                raise ValueError('nameRu is required')

            where_sql, match_params = build_upsert_match(row, args.upsert_by)
            existing = cur.execute(
                f'SELECT id FROM medications WHERE {where_sql}',
                match_params,
            ).fetchone()
            ts = now_iso()

            if existing and args.on_duplicate == 'update':
                row['updated_at'] = ts
                row.update(match_params)
                if not args.dry_run:
                    cur.execute(
                        f'''
                        UPDATE medications SET
                            name_en = :name_en,
                            active_substance = :active_substance,
                            atc_code = :atc_code,
                            icd10_codes = :icd10_codes,
                            package_description = :package_description,
                            manufacturer = :manufacturer,
                            forms = :forms,
                            pediatric_dosing = :pediatric_dosing,
                            adult_dosing = :adult_dosing,
                            contraindications = :contraindications,
                            caution_conditions = :caution_conditions,
                            side_effects = :side_effects,
                            interactions = :interactions,
                            pregnancy = :pregnancy,
                            lactation = :lactation,
                            indications = :indications,
                            vidal_url = :vidal_url,
                            clinical_pharm_group = :clinical_pharm_group,
                            pharm_therapy_group = :pharm_therapy_group,
                            min_interval = :min_interval,
                            max_doses_per_day = :max_doses_per_day,
                            max_duration_days = :max_duration_days,
                            route_of_admin = :route_of_admin,
                            is_favorite = :is_favorite,
                            user_tags = :user_tags,
                            is_otc = :is_otc,
                            overdose = :overdose,
                            child_dosing = :child_dosing,
                            child_using = :child_using,
                            renal_insuf = :renal_insuf,
                            renal_using = :renal_using,
                            hepato_insuf = :hepato_insuf,
                            hepato_using = :hepato_using,
                            special_instruction = :special_instruction,
                            pharmacokinetics = :pharmacokinetics,
                            pharmacodynamics = :pharmacodynamics,
                            full_instruction = :full_instruction,
                            updated_at = :updated_at
                        WHERE {where_sql}
                        ''',
                        row,
                    )
                updated += 1
            elif existing and args.on_duplicate == 'skip':
                continue
            else:
                row['created_at'] = ts
                row['updated_at'] = ts
                if not args.dry_run:
                    cur.execute(
                        '''
                        INSERT INTO medications (
                            name_ru, name_en, active_substance, atc_code, icd10_codes,
                            package_description, manufacturer, forms, pediatric_dosing, adult_dosing,
                            contraindications, caution_conditions, side_effects, interactions,
                            pregnancy, lactation, indications, vidal_url,
                            clinical_pharm_group, pharm_therapy_group,
                            min_interval, max_doses_per_day, max_duration_days,
                            route_of_admin, is_favorite, user_tags,
                            is_otc, overdose, child_dosing, child_using,
                            renal_insuf, renal_using, hepato_insuf, hepato_using,
                            special_instruction, pharmacokinetics, pharmacodynamics, full_instruction,
                            created_at, updated_at
                        ) VALUES (
                            :name_ru, :name_en, :active_substance, :atc_code, :icd10_codes,
                            :package_description, :manufacturer, :forms, :pediatric_dosing, :adult_dosing,
                            :contraindications, :caution_conditions, :side_effects, :interactions,
                            :pregnancy, :lactation, :indications, :vidal_url,
                            :clinical_pharm_group, :pharm_therapy_group,
                            :min_interval, :max_doses_per_day, :max_duration_days,
                            :route_of_admin, :is_favorite, :user_tags,
                            :is_otc, :overdose, :child_dosing, :child_using,
                            :renal_insuf, :renal_using, :hepato_insuf, :hepato_using,
                            :special_instruction, :pharmacokinetics, :pharmacodynamics, :full_instruction,
                            :created_at, :updated_at
                        )
                        ''',
                        row,
                    )
                created += 1
        except Exception as e:
            errors += 1
            print(f'Error importing {os.path.basename(file_path)}: {e}')

    if args.dry_run:
        db.rollback()
    else:
        db.commit()
    total = cur.execute('SELECT COUNT(*) FROM medications').fetchone()[0]
    db.close()

    print(f'Imported files: {len(files)}')
    print(f'Data dir: {args.data_dir}')
    print(f'DB path: {args.db_path}')
    mode = 'DRY-RUN' if args.dry_run else 'WRITE'
    print(f'Mode: {mode} | on-duplicate={args.on_duplicate}')
    print(f'Upsert strategy: {args.upsert_by} | strict-keys={args.strict_keys}')
    print(f'Created: {created}, Updated: {updated}, Errors: {errors}')
    print(f'Warnings: {warnings}')
    print(f'Total medications in DB: {total}')


if __name__ == '__main__':
    main()
