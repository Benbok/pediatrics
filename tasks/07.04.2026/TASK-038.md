# TASK-038 — RAG-сервис: TTL-кэш запросов + педиатрический хард-фильтр + rule-based planner

> **Модуль:** `knowledge/rag`  
> **Дата начала:** 07.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Три независимых улучшения `knowledgeQueryService.cjs`, устраняющих ключевые архитектурные слабости RAG-пайплайна:

1. **In-memory TTL-кэш** — повторяющиеся запросы (60-70% нагрузки) возвращают результат за ~0ms вместо 2-5 сек.
2. **Педиатрический хард-фильтр** — препараты с `childUsing = 'Not'` физически исключаются из SQL до LLM. Безопасность гарантируется базой данных, не промптом.
3. **Rule-based intent classifier** — простые запросы ("доза", "лечение", "диагностика") классифицируются regex без LLM-вызова, срезая 300-500ms задержки планировщика.

### Контекст

Анализ текущего `knowledgeQueryService.cjs`:
- `planQueryWithLLM()` всегда делает LLM-вызов, даже когда intent очевиден
- Препараты фильтруются только по `indications` LIKE, поле `childUsing` игнорируется
- Нет кэша — каждый повторный запрос проходит полный RAG-пайплайн (~3-5 сек)

### Ожидаемый результат

- Запрос "антибиотики при пневмонии детям" за второй и последующие разы: < 5ms
- Препарат с `childUsing = 'Not'` не попадает в контекст LLM ни при каких обстоятельствах
- Простые запросы с явным интентом не тратят 1 LLM-вызов на планировщик

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/knowledgeQueryService.cjs  ← все изменения только здесь
```

**Нет изменений:** schema.prisma, IPC handlers, preload, типы, UI — задача не затрагивает.

---

## ✅ Checklist

- [ ] `logger.*` вместо `console.*` — уже используется, не нарушаем
- [ ] Нет magic numbers — TTL константа вынесена
- [ ] Кэш — only in-process (Electron main process), нет внешних зависимостей
- [ ] Хард-фильтр применяется во ВСЕХ местах поиска препаратов
- [ ] Rule-based classifier — fallback на LLM при неопределённых запросах
- [ ] Кэш — нормализация ключа (lowercase, trim, collapse whitespace)

---

## 📐 План реализации

### Этап 1: In-memory TTL-кэш
**Статус:** ✅ DONE  
**Файлы:** `electron/services/knowledgeQueryService.cjs`

- [x] Добавить `QueryCache` класс с TTL (24h) и max-size (200 записей) в начало файла
- [x] Нормализация ключа: lowercase + trim + collapse whitespace
- [x] В `queryKnowledge()`: check cache → return hit; on success → set cache
- [x] Инвалидация: LRU eviction при превышении 200 записей

### Этап 2: Педиатрический хард-фильтр
**Статус:** ✅ DONE  
**Файлы:** `electron/services/knowledgeQueryService.cjs`

- [x] В `searchMedicationsByLike()` добавить `childUsing: { not: 'Not' }` в WHERE
- [x] В `searchMedicationsByDiseaseNames()` — то же
- [x] В `searchMedicationsByChunkMentions()` — то же
- [x] Добавить `childUsing` в `select` для всех трёх функций (для логирования)

### Этап 3: Rule-based intent classifier
**Статус:** ✅ DONE  
**Файлы:** `electron/services/knowledgeQueryService.cjs`

- [x] Функция `classifyIntentByRules(query)` → возвращает plan-объект или null
- [x] Паттерны: дозировка, лечение, диагностика, противопоказания
- [x] В `planQueryWithLLM()`: сначала пробуем rule-based, LLM только если null
- [x] Логировать источник плана: 'rules' / 'llm' / 'fallback'

---

## 📋 Execution Log

| Время | Этап | Действие | Результат |
|-------|------|----------|-----------|
| 07.04.2026 | 1 | QueryCache класс + wiring в queryKnowledge | ✅ TTL 24ч, max 200, LRU eviction |
| 07.04.2026 | 2 | childUsing хард-фильтр в 3 функциях | ✅ Физическое исключение из SQL |
| 07.04.2026 | 3 | classifyIntentByRules + wiring в planQueryWithLLM | ✅ 4 паттерна, LLM только fallback |
