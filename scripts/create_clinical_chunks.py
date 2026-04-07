import json
import sys
import io
import os
import re
from pathlib import Path

import PyPDF2

# Force UTF-8 encoding for stdout (Windows)
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SECTION_TYPE_MAP = {
    'определение': 'definition',
    'дифференциальн': 'definition',
    'этиология': 'etiology',
    'патогенез': 'etiology',
    'эпидемиолог': 'epidemiology',
    'классификац': 'classification',
    'клиническая картина': 'clinicalPicture',
    'клиника': 'clinicalPicture',
    'жалобы': 'complaints',
    'анамнез': 'complaints',
    'физикал': 'physicalExam',
    'осмотр': 'physicalExam',
    'лаборатор': 'labDiagnostics',
    'инструментал': 'instrumental',
    'иные диагностическ': 'instrumental',
    'лечение': 'treatment',
    'хирургическ': 'treatment',
    'медикаментозн': 'treatment',
    'немедикаментозн': 'treatment',
    'консервативн': 'treatment',
    'реабилитац': 'rehabilitation',
    'профилактик': 'prevention',
    'диспансер': 'prevention',
}


def classify_section(title: str) -> str:
    if not title:
        return 'other'
    title_lower = title.strip().lower()
    for key, section_type in SECTION_TYPE_MAP.items():
        if key in title_lower:
            return section_type
    return 'other'


# Паттерны уровней доказательности МЗ РФ.
# Реальный формат в PDF: «(УУР - C; УДД - 5)» — с дефисом и пробелами.
# УУР принимает значения А/В/С (кириллица), УДД — 1-5 или I-V.
_EVIDENCE_PATTERNS = [
    # Объединённый формат с дефисом: «УУР - C; УДД - 5» (наиболее распространён в КР МЗ РФ)
    re.compile(r'УУР\s*[-–—]?\s*[А-ЯA-Z]\s*[;,]\s*УДД\s*[-–—]?\s*[IVXivx0-9]+', re.UNICODE),
    # Одиночный УУР с дефисом или без: «УУР - C», «УУР А»
    re.compile(r'УУР\s*[-–—]?\s*[А-ЯA-Z]\b', re.UNICODE),
    # Одиночный УДД с дефисом или без: «УДД - 5», «УДД III»
    re.compile(r'УДД\s*[-–—]?\s*[IVXivx0-9]+', re.UNICODE),
    # Латинский формат: A-I, B-II, C-V
    re.compile(r'\b[A-Ca-c]-[IVXivx]{1,4}\b'),
]


def extract_evidence_level(text: str):
    """Извлечь первый найденный уровень доказательности из текста чанка.

    Returns:
        str | None — например "УУР А; УДД I" или "B-II", либо None
    """
    if not text:
        return None
    for pattern in _EVIDENCE_PATTERNS:
        m = pattern.search(text)
        if m:
            return m.group(0).strip()
    return None


def normalize_text(text: str) -> str:
    if not text:
        return ''
    # Remove PUA/private-use Unicode chars (common PDF extraction artifacts)
    text = ''.join(ch if ord(ch) < 0xF000 or ord(ch) > 0xFFFF else ' ' for ch in text)
    # Collapse horizontal whitespace but PRESERVE newlines — required for line-based section detection
    text = re.sub(r'[^\S\n]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def chunk_text(text: str, chunk_size: int, overlap: int):
    if not text:
        return []
    if chunk_size <= 0:
        return [text]
    if overlap < 0:
        overlap = 0

    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


# Numbered section header: «1.1», «3.1.1» followed by a capital Cyrillic word
_SECTION_HEADER_RE = re.compile(r'^(\d+(?:\.\d+){1,2})\s+([А-ЯЁ][А-ЯЁа-яё].*)')


def extract_sections_from_page(text: str):
    """Split a page into (sectionTitle, sectionText) pairs.

    Line-based detection: lines matching «1.1 Заголовок» or «3.1.1 Заголовок» are
    treated as section boundaries. Content lines are accumulated between headers.
    Falls back to single-section when no headers are found.
    """
    if not text:
        return []

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return [(None, text)]

    sections = []
    current_title = None
    current_parts: list = []

    for line in lines:
        m = _SECTION_HEADER_RE.match(line)
        if m:
            # Flush accumulated content
            if current_parts:
                content = ' '.join(current_parts).strip()
                if content:
                    sections.append((current_title or 'Введение / Общая информация', content))
            # Start new section, cap title at 90 chars to avoid eating content
            current_title = line[:90].strip()
            current_parts = []
        else:
            current_parts.append(line)

    # Flush the final section
    if current_parts:
        content = ' '.join(current_parts).strip()
        if content:
            sections.append((current_title or 'Введение / Общая информация', content))

    # No headers found → return entire page as one section
    if not sections:
        return [(None, ' '.join(lines))]

    return sections


def create_clinical_chunks(pdf_path: str, chunk_size: int = 700, overlap: int = 100):
    """Create clinical chunks for downstream indexing.

    Output format:
    [{"page": 1, "sectionTitle": "...", "type": "physicalExam", "text": "..."}]

    Note: embeddings are generated in JS (electron) layer.
    """
    if not os.path.exists(pdf_path):
        return {"error": f"File not found: {pdf_path}"}

    out = []
    with open(pdf_path, 'rb') as pdf_file:
        reader = PyPDF2.PdfReader(pdf_file)
        for page_num, page in enumerate(reader.pages, start=1):
            raw = page.extract_text() or ''
            text = normalize_text(raw)
            if not text:
                continue

            for section_title, section_text in extract_sections_from_page(text):
                section_type = classify_section(section_title or '')
                for chunk in chunk_text(section_text, chunk_size=chunk_size, overlap=overlap):
                    evidence = extract_evidence_level(chunk)
                    out.append({
                        'page': page_num,
                        'sectionTitle': section_title or f"Страница {page_num}",
                        'type': section_type,
                        'text': chunk,
                        'evidenceLevel': evidence,
                    })

    return out


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}, ensure_ascii=False))
        sys.exit(1)

    file_path = str(Path(sys.argv[1]).absolute())

    # Optional args: chunk_size, overlap
    chunk_size = 1400
    overlap = 250
    if len(sys.argv) >= 3:
        try:
            chunk_size = int(sys.argv[2])
        except Exception:
            chunk_size = 1400
    if len(sys.argv) >= 4:
        try:
            overlap = int(sys.argv[3])
        except Exception:
            overlap = 250

    result = create_clinical_chunks(file_path, chunk_size=chunk_size, overlap=overlap)
    print(json.dumps(result, ensure_ascii=False))
