# TASK-039 — GuidelineChunk metadata enrichment: evidence_level + valid_until

> **Модуль:** `diseases/guidelines` + `knowledge/rag`  
> **Дата начала:** 07.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Добавить два поля в данные о клинических рекомендациях:

1. **`evidence_level`** (`GuidelineChunk`) — уровень доказательности (УУР/УДД), извлекается regex-ом при chunking: `"УУР А"`, `"УДД I"`, `"B-II"`, `"A-I"` и т.д.
2. **`valid_until`** (`ClinicalGuideline`) — дата истечения срока действия протокола, извлекается из "Пересмотр не позднее: 2026" в PDF.

### Контекст

Анализ предложенного формата чанков (TASK-039 инициирован после обсуждения) выявил, что в системе отсутствует:
- `evidence_level` — нельзя фильтровать рекомендации по доказанности в промпте
- `valid_until` — нельзя предупреждать врача об устаревших протоколах

### Ожидаемый результат

- `GuidelineChunk.evidenceLevel` хранится в БД, попадает в FTS и в промпт Gemini
- `ClinicalGuideline.validUntil` хранится в БД; UI показывает badge "Истёк" / "Истекает скоро" в списке гайдлайнов
- `buildContext()` в `knowledgeQueryService.cjs` добавляет evidence_level к чанкам в промпте

---

## 🗂️ Затрагиваемые файлы

```
prisma/
  schema.prisma                                      ← add evidenceLevel, validUntil
  migrations/20260407_add_evidence_valid_until/      ← manual migration

scripts/
  create_clinical_chunks.py                          ← regex evidence extraction
  parse_pdf.py                                       ← valid_until extraction
  apply_evidence_migration.py                        ← apply migration SQL to dev.db

electron/
  modules/diseases/service.cjs                       ← save validUntil in uploadGuidelineSingle
  services/knowledgeQueryService.cjs                 ← include evidenceLevel in context block

src/
  (optional) components/diseases/GuidelinesList.tsx  ← expired/expiring badge
```

---

## ✅ Checklist

- [ ] `prisma/schema.prisma` обновлён
- [ ] Ручная миграция создана и применена
- [ ] `npx prisma generate` успешен
- [ ] `create_clinical_chunks.py` извлекает `evidence_level`
- [ ] `parse_pdf.py` извлекает `valid_until`
- [ ] `uploadGuidelineSingle` сохраняет `validUntil` в `ClinicalGuideline`
- [ ] `buildContext()` включает evidence_level строку
- [ ] `logger.*` везде, `console.*` не добавлен
- [ ] Миграция зарегистрирована через `migrate resolve --applied`

---

## 📐 План реализации

### Этап 1: Schema + Migration
**Статус:** ⬜ TODO  
**Файлы:** `prisma/schema.prisma`, `prisma/migrations/`, `scripts/apply_evidence_migration.py`

- [ ] Добавить `evidenceLevel String? @map("evidence_level")` в `GuidelineChunk`
- [ ] Добавить `validUntil DateTime? @map("valid_until")` в `ClinicalGuideline`
- [ ] Создать `prisma/migrations/20260407120000_add_evidence_valid_until/migration.sql`
- [ ] Создать Python-скрипт для применения SQL к `dev.db`
- [ ] Применить миграцию и зарегистрировать через `migrate resolve --applied`
- [ ] `npx prisma generate`

### Этап 2: Extraction — create_clinical_chunks.py
**Статус:** ⬜ TODO  
**Файлы:** `scripts/create_clinical_chunks.py`

- [ ] Regex для УУР/УДД: `r'УУР\s*[А-ЕA-E]'`, `r'УДД\s*[IVX1-5]+'`
- [ ] Regex для латинских уровней: `r'\b[A-C]-[IVX]+\b'`
- [ ] Функция `extract_evidence_level(text) -> str | None` — возвращает первый найденный уровень
- [ ] Каждый чанк получает поле `evidence_level` в JSON-выходе

### Этап 3: Extraction — parse_pdf.py
**Статус:** ⬜ TODO  
**Файлы:** `scripts/parse_pdf.py`

- [ ] Regex для "Пересмотр не позднее: 2026" → `valid_until: "2026-12-31"`
- [ ] Fallback: null если строка не найдена
- [ ] `valid_until` добавлен в JSON-аутпут скрипта

### Этап 4: Backend — service.cjs + knowledgeQueryService.cjs
**Статус:** ⬜ TODO  
**Файлы:** `electron/modules/diseases/service.cjs`, `electron/services/knowledgeQueryService.cjs`

- [ ] `uploadGuidelineSingle`: читать `validUntil` из metadata, сохранять в `ClinicalGuideline`
- [ ] `uploadGuidelineSingle`: сохранять `evidenceLevel` в `GuidelineChunk` rows
- [ ] `buildContext()`: добавить `[УУР/УДД: X]` к строкам чанков где есть уровень
- [ ] `reindexGuidelineChunks()`: также извлекать evidence_level при переиндексации

---

## 📝 Лог выполнения

- `07.04.2026` — задача создана, план согласован
