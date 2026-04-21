/**
 * prepare-pdf-bundle.cjs
 *
 * Pre-build script: copies clinical guideline PDFs from their absolute paths
 * stored in dev.db into prisma/clinical_guidelines/ so electron-builder
 * can pack them into the installer (asarUnpack).
 *
 * Run automatically as part of electron:build / electron:release.
 * Safe to run multiple times — skips files already copied.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DEV_DB = path.join(ROOT, 'prisma', 'dev.db');
const BUNDLE_DIR = path.join(ROOT, 'prisma', 'clinical_guidelines');

if (!fs.existsSync(DEV_DB)) {
    console.error('[pdf-bundle] dev.db not found at:', DEV_DB);
    process.exit(1);
}

fs.mkdirSync(BUNDLE_DIR, { recursive: true });

const db = new Database(DEV_DB, { readonly: true });

let rows;
try {
    rows = db.prepare('SELECT id, title, pdf_path FROM clinical_guidelines WHERE pdf_path IS NOT NULL').all();
} finally {
    db.close();
}

if (rows.length === 0) {
    console.log('[pdf-bundle] No PDF entries in clinical_guidelines — nothing to copy.');
    process.exit(0);
}

let copied = 0;
let missing = 0;
let skipped = 0;

for (const row of rows) {
    const src = row.pdf_path;
    const fileName = path.basename(src);
    const dest = path.join(BUNDLE_DIR, fileName);

    if (fs.existsSync(dest)) {
        console.log(`[pdf-bundle] Already bundled: ${fileName}`);
        skipped++;
        continue;
    }

    if (!fs.existsSync(src)) {
        console.warn(`[pdf-bundle] ⚠ Source PDF not found (id=${row.id}, "${row.title}"): ${src}`);
        missing++;
        continue;
    }

    fs.copyFileSync(src, dest);
    console.log(`[pdf-bundle] ✓ Copied (id=${row.id}): ${fileName}`);
    copied++;
}

console.log(`\n[pdf-bundle] Done. Copied: ${copied}, Already bundled: ${skipped}, Missing: ${missing}`);

if (missing > 0) {
    console.warn('[pdf-bundle] Some PDFs were not found — they will be seeded without a pdf_path (CDSS chunks will still work).');
}
