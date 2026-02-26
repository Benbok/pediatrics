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
    'лечение': 'treatment',
    'реабилитац': 'rehabilitation',
    'профилактик': 'prevention',
}


def classify_section(title: str) -> str:
    if not title:
        return 'other'
    title_lower = title.strip().lower()
    for key, section_type in SECTION_TYPE_MAP.items():
        if key in title_lower:
            return section_type
    return 'other'


def normalize_text(text: str) -> str:
    if not text:
        return ''
    # Remove problematic chars + normalize whitespace
    text = ''.join(ch if ord(ch) < 0xF000 or ord(ch) > 0xFFFF else ' ' for ch in text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


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


def extract_sections_from_page(text: str):
    """Split a page into (sectionTitle, sectionText) pairs.

    Heuristic: split by headers like '1.1 Определение' or '2.3 ...'.
    If no headers are found, return single section with None title.
    """
    if not text:
        return []

    # Keep delimiters (headers) in split result
    parts = re.split(r'(\d+\.\d+\s+[А-ЯЁ][А-ЯЁа-яё\s]{3,})', text)
    if len(parts) <= 1:
        return [(None, text)]

    sections = []
    preamble = parts[0].strip()
    if preamble:
        sections.append(("Введение / Общая информация", preamble))

    for i in range(1, len(parts), 2):
        header = parts[i].strip()
        content = parts[i + 1].strip() if i + 1 < len(parts) else ''
        if content:
            sections.append((header, content))

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
                    out.append({
                        'page': page_num,
                        'sectionTitle': section_title or f"Страница {page_num}",
                        'type': section_type,
                        'text': chunk,
                    })

    return out


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}, ensure_ascii=False))
        sys.exit(1)

    file_path = str(Path(sys.argv[1]).absolute())

    # Optional args: chunk_size, overlap
    chunk_size = 700
    overlap = 100
    if len(sys.argv) >= 3:
        try:
            chunk_size = int(sys.argv[2])
        except Exception:
            chunk_size = 700
    if len(sys.argv) >= 4:
        try:
            overlap = int(sys.argv[3])
        except Exception:
            overlap = 100

    result = create_clinical_chunks(file_path, chunk_size=chunk_size, overlap=overlap)
    print(json.dumps(result, ensure_ascii=False))
