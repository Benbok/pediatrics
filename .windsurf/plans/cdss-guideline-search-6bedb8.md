# Углублённый CDSS: поиск диагноза по PDF-содержимому клинических рекомендаций

Расширить пайплайн диагностики так, чтобы после первичного отбора кандидатов по симптомам система дополнительно искала релевантные чанки из PDF клинических рекомендаций и использовала их для более точного ранжирования — с полным fallback'ом при отсутствии AI.

---

## Контекст: что уже есть

| Слой | Реализация |
|---|---|
| **Парсинг жалоб** | `parseComplaints()` → Gemini → симптомы + severity |
| **Нормализация** | `normalizeWithAI()` → словарь + batch Gemini, circuit breaker |
| **Семантический поиск** | `searchBySymptoms()` → embedding болезни (`symptomsEmbedding`) → cosine → топ-10 |
| **Ранжирование** | `rankDiagnoses()` → Gemini с симптомами + кандидаты → топ-5 |
| **Fallback** | Keyword search → vocabulary-enhanced scoring |
| **Guidelines** | `ClinicalGuideline` в БД: `chunks` (JSON `[{text, type}]` — без embeddings!), структурированные секции (`complaints`, `physicalExam`, `clinicalPicture`, ...), `content` |

**Ключевая проблема:** поле `chunks` уже существует, но embeddings чанков **не генерируются** при загрузке PDF. `searchBySymptoms` ищет только по `symptomsEmbedding` болезни, а богатый текст guidelines (клиническая картина, физикальный осмотр, диагностика) в поиске не участвует.

---

## Архитектура решения: трёхслойный RAG-пайплайн

```
ВХОД: complaints + physicalExam + vitalSigns + anamnesis
         │
         ▼
┌─────── СЛОЙ 1: Clinical Query Builder ──────────────┐
│  Объединяем жалобы + физикальный осмотр в           │
│  структурированный клинический запрос               │
│  Fallback: конкатенация полей без AI                │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────── СЛОЙ 2: Dual-Path Candidate Search ──────────┐
│  Path A: Symptom embeddings (текущий)               │
│    → queryEmbedding ↔ disease.symptomsEmbedding      │
│  Path B: Guideline chunk search (НОВЫЙ)             │
│    → queryEmbedding ↔ chunk.embedding (per chunk)   │
│  Merge: дедупликация + взвешенная сумма score       │
│  Fallback: keyword search по обоим путям            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────── СЛОЙ 3: Contextual Ranker ───────────────────┐
│  Берём топ-8 кандидатов                             │
│  Для каждой болезни: топ-2 релевантных чанка        │
│  Prompt = клин.данные + чанки → Gemini              │
│  Fallback: score-based без AI (weighted sum)        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
              DiagnosisSuggestion[]  (source: 'ai'|'semantic'|'keyword')
```

---

## Уровни деградации (самодостаточность без AI)

```
1. Full AI       — embeddings + Gemini ranking с chunk-контекстом из PDF
2. Semantic only — embeddings (без Gemini), cosine score → сортировка
3. Chunk keyword — текстовый поиск по chunks[].text + секциям guideline (complaints/physicalExam)
4. Symptom kw    — текущий _fallbackKeywordSearch по симптомам disease (уже есть)
```

Каждый уровень логируется через `logDegradation()`. Система возвращает результат на любом уровне.

---

## Задачи

### 1. Индексация chunk embeddings при загрузке PDF

**Где:** `electron/modules/diseases/service.cjs` — функция сохранения guideline

- При создании/обновлении `ClinicalGuideline` нарезать приоритетные секции на чанки (512–800 символов, перекрытие 100 символов): `clinicalPicture`, `complaints`, `physicalExam`, `labDiagnostics`, `instrumental`
- Генерировать `embedding` через `generateEmbedding()` для каждого чанка
- Сохранять в `chunks` как `[{ text, type, embedding: number[] }]`
- Добавить поле `physicalExamEmbedding` в `ClinicalGuideline` — агрегированный embedding секции физикального осмотра (для быстрого pre-filter)
- Embeddings генерируются **один раз**, не при каждом поиске

### 2. Clinical Query Builder

**Новый файл:** `electron/services/clinicalQueryBuilder.cjs`

```javascript
buildClinicalQuery(visit) → string
// "Симптомы: кашель, температура 38.5°C
//  Физикальный осмотр: хрипы в лёгких, ЧД 28/мин
//  Возраст: 24 мес, вес: 12 кг"
```

- Без AI: конкатенация `complaints + physicalExam + vitalSigns`
- С AI (опционально): Gemini нормализует и расставляет приоритеты клинических находок поверх базового текста

### 3. Dual-Path Search → `searchByClinicalData()`

**Где:** `electron/modules/diseases/service.cjs`

```
score = 0.4 × symptom_similarity + 0.6 × chunk_similarity
```

- Path A: существующий поиск по `symptomsEmbedding`
- Path B: cosine similarity запроса ↔ каждый chunk.embedding → берём max per disease
- Merge по `diseaseId`, взвешенная сумма → топ-20 → в ранжирование
- Fallback: если chunk embeddings нет → только Path A

### 4. Contextual Ranker → `rankDiagnosesWithContext()`

**Где:** `electron/services/cdssService.cjs`

Prompt-структура (≤300 токенов на кандидата, ≤8 кандидатов):
```
Клинические данные пациента: [complaints, physicalExam, vitalSigns]

Кандидат 1: "Пневмония" (J18)
  Из клинических рекомендаций:
  - Жалобы/клиника: "кашель, одышка, лихорадка..."
  - Физикальный осмотр: "укорочение перкуторного звука..."
  Симптомы: [кашель, лихорадка, одышка]

Кандидат 2: ...
→ Верни JSON: [{diseaseId, confidence, reasoning, matchedSymptoms}]
```

- Для каждого кандидата: выбираются **топ-2 чанка** по cosine similarity с запросом
- Fallback: `_enhancedFallbackRanking()` (уже есть) + дополнительный вес для chunk-совпадений по тексту

### 5. Reindex endpoint

**IPC:** `diseases:reindex-guideline-chunks`

- Пересчитать embeddings для всех существующих guidelines (одноразово)
- Батч по 5 guidelines с паузой 500ms (обход rate limit)
- Прогресс через события → frontend может показать статус

### 6. Обновить `analyzeVisit()` в `visits/service.cjs`

- Вызывать `searchByClinicalData()` вместо `searchBySymptoms()`
- Передавать chunk-контекст в `rankDiagnosesWithContext()`

---

## Оптимизация токенов

| Операция | Стратегия |
|---|---|
| Индексация chunks | Один раз при загрузке PDF (не при каждом поиске) |
| Query embedding | 1 вызов на весь поиск |
| Chunk selection | Топ-2 per кандидат по cosine (не весь guideline) |
| Ranking prompt | JSON-структура, ≤300 токенов/кандидат, max 8 кандидатов |
| Symptom parsing | Batch (уже есть) |
| Caching | TTL-кэш results + LRU embeddings (уже есть, расширить) |

---

## Изменения схемы (Prisma)

```prisma
model ClinicalGuideline {
  // ... существующие поля ...
  physicalExamEmbedding String? @map("physical_exam_embedding") // НОВОЕ
  // chunks — формат меняется: добавляется поле embedding в каждый объект
}
```

Миграция: `npx prisma migrate dev --name add-chunk-embeddings`

---

## Файлы к изменению

| Файл | Действие |
|---|---|
| `prisma/schema.prisma` | Добавить `physicalExamEmbedding` |
| `electron/services/clinicalQueryBuilder.cjs` | Создать |
| `electron/services/cdssService.cjs` | Добавить `rankDiagnosesWithContext()` |
| `electron/modules/diseases/service.cjs` | Обновить сохранение guideline + `searchByClinicalData()` |
| `electron/modules/diseases/handlers.cjs` | Добавить reindex endpoint |
| `electron/modules/visits/service.cjs` | Обновить `analyzeVisit()` |
| `src/modules/visits/services/visitService.ts` | Типы (если нужно) |

---

## Порядок реализации

1. Prisma миграция (`physicalExamEmbedding`)
2. `clinicalQueryBuilder.cjs`
3. Chunk embedding generation при сохранении guideline
4. Reindex endpoint для существующих guidelines
5. `searchByClinicalData()` в `DiseaseService`
6. `rankDiagnosesWithContext()` в `cdssService`
7. Обновить `analyzeVisit()`
8. Тест fallback при отключённом AI
