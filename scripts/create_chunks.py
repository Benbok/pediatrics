import PyPDF2
import json
import sys
import io
import os
import re

# Force UTF-8 encoding for stdout
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def create_chunks(pdf_path: str):
    """Split PDF into searchable chunks with page numbers and section context"""
    try:
        if not os.path.exists(pdf_path):
            return {"error": f"File not found: {pdf_path}"}

        chunks = []
        with open(pdf_path, 'rb') as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text()
                if not text:
                    continue

                # Remove problematic characters
                text = ''.join(char if ord(char) < 0xF000 or ord(char) > 0xFFFF else ' ' for char in text)
                text = re.sub(r'\s+', ' ', text).strip()

                if not text:
                    continue

                # For now, let's treat each page as a chunk
                # We can refine this to split by section headers later
                # Finding section headers (e.g., "1.1 Определение")
                sections = re.split(r'(\d+\.\d+\s+[А-ЯЁ][а-яё\s]{5,})', text)
                
                if len(sections) > 1:
                    # The first part before any section header
                    if sections[0].strip():
                        chunks.append({
                            "page": page_num,
                            "sectionTitle": "Введение / Общая информация",
                            "text": sections[0].strip()[:1000]
                        })
                    
                    # Pairs of (header, content)
                    for i in range(1, len(sections), 2):
                        header = sections[i].strip()
                        content = sections[i+1].strip() if i+1 < len(sections) else ""
                        if content:
                            chunks.append({
                                "page": page_num,
                                "sectionTitle": header,
                                "text": content[:1000]
                            })
                else:
                    # No clear headers, just the whole page text
                    chunks.append({
                        "page": page_num,
                        "sectionTitle": f"Страница {page_num}",
                        "text": text[:1000]
                    })
                    
        return chunks
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    result = create_chunks(file_path)
    print(json.dumps(result, ensure_ascii=False))
