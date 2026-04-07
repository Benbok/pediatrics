import json
import sys
import io
import os
import re
from pathlib import Path

# Force UTF-8 for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def log(msg):
    try:
        print(f"[INFO] {msg}", file=sys.stderr)
    except:
        pass

def log_error(msg):
    try:
        print(f"[ERROR] {msg}", file=sys.stderr)
    except:
        pass

# Load .env.local and setup proxies
def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    k = key.strip()
                    v = value.strip()
                    os.environ[k] = v
                    # Crucial for some regions
                    if k.lower() in ['http_proxy', 'https_proxy']:
                        log(f"Configuring proxy: {k}")

load_env()

def fix_mojibake(text: str) -> str:
    if not text: return ""
    if not re.search(r'[╬╤╥╨╡╢]', text):
        return text
    try:
        return text.encode('cp866', errors='ignore').decode('cp1251', errors='ignore')
    except:
        try:
            return text.encode('latin1', errors='ignore').decode('cp1251', errors='ignore')
        except:
            return text

# Паттерны для извлечения года "Пересмотр не позднее"
_VALID_UNTIL_PATTERNS = [
    re.compile(r'Пересмотр\s+не\s+позднее[:\s]+(\d{4})', re.IGNORECASE),
    re.compile(r'Дата\s+пересмотра[:\s]+(\d{4})', re.IGNORECASE),
    re.compile(r'revision\s+no\s+later\s+than[:\s]+(\d{4})', re.IGNORECASE),
]


def extract_valid_until(text: str):
    """Extract the review/expiry year from Russian MoH clinical guidelines.

    Looks for strings like "Пересмотр не позднее: 2026"
    Returns ISO date string "YYYY-12-31" or None.
    """
    if not text:
        return None
    for pattern in _VALID_UNTIL_PATTERNS:
        m = pattern.search(text)
        if m:
            year = int(m.group(1))
            if 2020 <= year <= 2040:
                return f"{year}-12-31"
    return None


def extract_metadata_locally(text: str) -> dict:
    """
    Извлекает коды МКБ-10 и valid_until из клинических рекомендаций.

    Структура клинических рекомендаций МЗ РФ:
    - Раздел 1.4: Особенности кодирования (содержит коды МКБ-10)
    """
    metadata = {"icd10_codes": [], "valid_until": None}

    # Извлекаем valid_until из титульной страницы / оглавления
    metadata["valid_until"] = extract_valid_until(text)
    
    # ================== ИЗВЛЕЧЕНИЕ КОДОВ МКБ-10 ==================
    # Ищем раздел 1.4 "Особенности кодирования" 
    
    section_14_patterns = [
        r'1\.4\s+Особенности\s+кодирования[^\n]*\n(.+?)(?:\n1\.5|\n2\.)',
        r'Особенности\s+кодирования[^\n]*классификации[^\n]*\n(.+?)(?:\n1\.5|\n2\.)',
    ]
    
    icd_section = None
    for pattern in section_14_patterns:
        match = re.search(pattern, text, re.DOTALL | re.I)
        if match:
            icd_section = match.group(1)
            log(f"Found ICD section 1.4, length: {len(icd_section)} chars")
            break
    
    # Извлекаем коды из раздела 1.4
    if icd_section:
        # Паттерн для кодов: B97.4, J00, J02.8, J04.1 и т.д.
        icd_codes = re.findall(r'\b([A-Z]\d{2}(?:\.\d{1,2})?)\b', icd_section)
        if icd_codes:
            metadata["icd10_codes"] = list(set(icd_codes))
            log(f"Found ICD codes in section 1.4: {metadata['icd10_codes']}")
    
    # Fallback: ищем коды во всем тексте
    if not metadata["icd10_codes"]:
        all_codes = re.findall(r'\b([A-Z]\d{2}(?:\.\d{1,2})?)\b', text)
        if all_codes:
            # Фильтруем только релевантные коды (исключаем A1, B2 и т.д.)
            filtered = [c for c in all_codes if re.match(r'^[A-Z]\d{2}', c)]
            metadata["icd10_codes"] = list(set(filtered))
    
    return metadata

def parse_with_gemini(pdf_path: str, extracted_text: str, local_meta: dict) -> dict:
    """AI структуризация. Если ИИ недоступен - возвращает лучший локальный результат"""
    # Используем модель из окружения или дефолтную
    model_name = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
    
    # Пытаемся взять VITE_ ключ (основной)
    api_key = os.getenv('VITE_GEMINI_API_KEY')
    if not api_key:
        return local_meta 
    
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        is_text_usable = len(re.findall(r'[А-Яа-яёЁ]', extracted_text)) > 50
        
        prompt = """
Изучи предоставленные материалы (текст или PDF) и сформируй строго валидный JSON объект.

СТРУКТУРА JSON:
{
  "icd10_codes": ["СПИСОК КОДОВ МКБ-10"]
}

ПРАВИЛА ИЗВЛЕЧЕНИЯ:
1. "icd10_codes": Найди все коды МКБ-10, указанные в документе (например, J04.1, J21.0).

ВАЖНО: Верни ТОЛЬКО JSON без каких-либо пояснений и markdown-разметки!
"""
        contents = [prompt]
        
        if is_text_usable:
            log("Sending text to AI...")
            # Ограничиваем текст, чтобы не переполнить контекст, но берем самое начало
            contents.append(f"ТЕКСТ КЛИНИЧЕСКИХ РЕКОМЕНДАЦИЙ:\n{extracted_text[:15000]}")
        else:
            log("Sending PDF to AI (Vision mode)...")
            uploaded_file = client.files.upload(file=pdf_path)
            while uploaded_file.state == 'PROCESSING':
                import time
                time.sleep(1)
                uploaded_file = client.files.get(name=uploaded_file.name)
            contents.append(uploaded_file)

        # Используем модель из переменной GEMINI_MODEL
        try:
            log(f"Calling Gemini ({model_name})...")
            response = client.models.generate_content(
                model=model_name,
                contents=contents
            )
        except Exception as e:
            log_error(f"Model {model_name} failed: {e}")
            # If 400 location error - we can't do much with AI, return local
            if "FAILED_PRECONDITION" in str(e) or "location" in str(e).lower():
                log("Regional block detected. AI results might be limited.")
            raise e
                
        text = response.text.strip()
        log(f"AI Response raw: {text[:200]}...")
        text = re.sub(r'```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```', '', text).strip()
        
        ai_data = json.loads(text)
        
        # Сливаем AI данные с локальными (только коды МКБ)
        final_data = {
            "icd10_codes": list(set(ai_data.get("icd10_codes", []) + local_meta.get("icd10_codes", [])))
        }
        return final_data
        
    except Exception as e:
        log_error(f"Gemini error: {e}. Using local metadata.")
        # Фолбек на локальные данные
        if not local_meta.get("icd10_codes"):
            local_meta["icd10_codes"] = []
        return local_meta

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No path"}))
        sys.exit(1)
    
    file_path = str(Path(sys.argv[1]).absolute())
    
    # 1. Извлекаем текст
    import fitz
    doc = fitz.open(file_path)
    text = ""
    for i in range(min(12, doc.page_count)):
        text += fix_mojibake(doc[i].get_text()) + "\n"
    doc.close()
    
    # 2. Парсим локально
    local_meta = extract_metadata_locally(text)
    
    # 3. Пытаемся через AI, если нет - вернем local_meta
    result = parse_with_gemini(file_path, text, local_meta)
    
    # Гарантируем наличие полей для фронтенда
    final_result = {
        "icd10_codes": result.get("icd10_codes", []),
        "valid_until": result.get("valid_until") or local_meta.get("valid_until"),
    }

    print(json.dumps(final_result, ensure_ascii=False))
