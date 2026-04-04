import argparse
import glob
import json
import os
import sqlite3
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


def to_json(value):
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def map_payload(data):
    return {
        'name_ru': data.get('nameRu') or '',
        'name_en': data.get('nameEn'),
        'active_substance': data.get('activeSubstance') or (data.get('nameRu') or ''),
        'atc_code': data.get('atcCode'),
        'icd10_codes': to_json(data.get('icd10Codes') or []),
        'package_description': data.get('packageDescription'),
        'manufacturer': data.get('manufacturer'),
        'forms': to_json(data.get('forms') or []),
        'pediatric_dosing': to_json(data.get('pediatricDosing') or []),
        'adult_dosing': to_json(data.get('adultDosing') or []),
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
        'route_of_admin': data.get('routeOfAdmin'),
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
    return parser.parse_args()


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

    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                payload = json.load(f)
            row = map_payload(payload)
            if not row['name_ru']:
                raise ValueError('nameRu is required')

            existing = cur.execute('SELECT id FROM medications WHERE name_ru = ?', (row['name_ru'],)).fetchone()
            ts = now_iso()

            if existing and args.on_duplicate == 'update':
                row['updated_at'] = ts
                row['name_ru_where'] = row['name_ru']
                if not args.dry_run:
                    cur.execute(
                        '''
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
                            updated_at = :updated_at
                        WHERE name_ru = :name_ru_where
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
                            special_instruction, pharmacokinetics, pharmacodynamics,
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
                            :special_instruction, :pharmacokinetics, :pharmacodynamics,
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
    print(f'Created: {created}, Updated: {updated}, Errors: {errors}')
    print(f'Total medications in DB: {total}')


if __name__ == '__main__':
    main()
