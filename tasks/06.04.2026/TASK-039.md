# TASK-039 — AI-агент поиска по базе знаний на главной странице

> **Модуль:** `dashboard / knowledge`  
> **Дата начала:** 06.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Реализовать раздел «Спросить базу знаний» на главной странице (Dashboard). Пользователь вводит клинический вопрос в свободной форме (например: «Какие антибиотики назначают при пневмонии у детей до 5 лет?» или «Признаки ларинготрахеита?»). AI-агент проходит по внутренней базе знаний (болезни + препараты), собирает релевантные фрагменты и генерирует ответ **исключительно на основе найденных данных**, с явным указанием источников и дисклеймером.

### Контекст

- В приложении уже есть: Gemini API (apiKeyManager), FTS-поиск по diseases (`guideline_chunks_fts`), семантические эмбеддинги (`embeddingService`), поиск по препаратам через Prisma.
- CDSS (TASK-001) — отдельный сценарий «симптомы → диагнозы»; данная задача — «вопрос → развёрнутый ответ», принципиально другой UX.
- Ответ должен содержать: основной текст, список источников (название болезни / препарата), предупреждение «только для медицинского персонала».

### Ожидаемый результат

- На Dashboard появляется виджет «Поиск по базе знаний» с полем ввода и зоной ответа.
- IPC-handler `knowledge:query` принимает вопрос, возвращает `{ answer, sources, disclaimer }`.
- RAG-сервис собирает до 5 болезней + 5 препаратов, передаёт контекст в Gemini с жёстким grounding-промптом.
- Ответ формируется **только из найденных данных**; если данных нет — агент честно сообщает об этом.

---

## 🗂️ Затрагиваемые файлы

```
electron/
  modules/knowledge/
    handlers.cjs              ← новый IPC module
  services/
    knowledgeQueryService.cjs ← новый RAG-сервис
  main.cjs                    ← регистрация handlers
  preload.cjs                 ← expose queryKnowledge

src/
  types.ts                    ← KnowledgeQueryRequest, KnowledgeQueryResponse
  validators/
    knowledgeQuery.validator.ts ← Zod-схемы
  services/
    knowledgeQuery.service.ts ← frontend service
  modules/dashboard/
    components/
      KnowledgeQueryWidget.tsx ← UI виджет
    Dashboard.tsx              ← добавить виджет

tests/
  knowledgeQuery.test.ts      ← unit тесты
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [ ] Синхронизация context7 перед стартом
- [ ] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend
- [ ] `ensureAuthenticated` на IPC handler
- [ ] `logger.*` вместо `console.*`
- [ ] Нет business logic в компоненте (только в service)
- [ ] Грамотный grounding-промпт — ответ только из переданного контекста
- [ ] Дисклеймер в ответе (не заменяет консультацию врача)
- [ ] Обработка случая «данные не найдены» (graceful degradation)
- [ ] Unit тесты написаны

---

## 📐 Технический дизайн

### RAG-пайплайн (knowledgeQueryService.cjs)

```
Вопрос пользователя
        │
        ▼
 [1] FTS поиск в guideline_chunks_fts
        │
        ▼
 [2] Semantic search (embedding) по болезням (если есть API ключ)
        │
        ▼
 [3] Поиск в diseases: nameRu, description, symptoms JSON
        │
        ▼
 [4] Поиск в medications: nameRu, indications, clinPharmGroup
        │
        ▼
 [5] Merge + deduplicate → Top 5 diseases + Top 5 medications
        │
        ▼
 [6] Сборка контекстного блока (текстовые фрагменты)
        │
        ▼
 [7] Gemini: systemPrompt = "Отвечай ТОЛЬКО на основе предоставленных данных"
        │
        ▼
 [8] { answer: string, sources: Source[], disclaimer: string }
```

### Grounding-промпт (системная инструкция для Gemini)

```
Ты — клинический справочный ассистент для врача-педиатра.
Отвечай ИСКЛЮЧИТЕЛЬНО на основе предоставленных данных из базы знаний.
Не добавляй информацию из общих знаний.
Если в предоставленных данных ответа нет — честно скажи: «В базе знаний достаточных данных по этому вопросу не найдено.»
Формат: краткий структурированный ответ, затем «Источники: [список]».
Язык: русский.
```

### IPC Contract

```typescript
// Request
interface KnowledgeQueryRequest {
  query: string; // 3–500 символов
}

// Response
interface KnowledgeQueryResponse {
  answer: string;
  sources: Array<{
    type: 'disease' | 'medication';
    name: string;
    id: number;
  }>;
  disclaimer: string;
  searchedAt: string; // ISO timestamp
}
```

---

## 📐 План реализации

### Этап 1: Backend — RAG-сервис + IPC handler
**Статус:** ✅ DONE  
**Файлы:**
- `electron/services/knowledgeQueryService.cjs`
- `electron/modules/knowledge/handlers.cjs`

- [ ] Создать `knowledgeQueryService.cjs`:
  - `searchDiseases(query)` — FTS + Prisma fallback, top-5
  - `searchMedications(query)` — Prisma LIKE по name/indications, top-5
  - `buildContext(diseases, medications)` — сборка текстового контекста
  - `generateAnswer(query, context, apiKey)` — вызов Gemini с grounding-промптом
  - `queryKnowledge(query)` — оркестратор: search → build → generate → return
- [ ] Создать `electron/modules/knowledge/handlers.cjs`:
  - `ipcMain.handle('knowledge:query', ensureAuthenticated(...))`
  - Zod-валидация запроса (query: string, min 3, max 500)
  - Вызов `knowledgeQueryService.queryKnowledge(query)`
  - Обработка ошибок (degradation: если нет API ключа → вернуть только raw sources без AI-ответа)

### Этап 2: IPC Contract — preload + main.cjs
**Статус:** ✅ DONE  
**Файлы:**
- `electron/preload.cjs`
- `electron/main.cjs`

- [ ] Добавить в `preload.cjs`: `queryKnowledge: (req) => ipcRenderer.invoke('knowledge:query', req)`
- [ ] Зарегистрировать модуль в `main.cjs`: `require('./modules/knowledge/handlers.cjs').register(ipcMain)`

### Этап 3: Types + Validator
**Статус:** ✅ DONE  
**Файлы:**
- `src/types.ts`
- `src/validators/knowledgeQuery.validator.ts`

- [ ] Добавить типы `KnowledgeQueryRequest`, `KnowledgeQueryResponse`, `KnowledgeSource` в `src/types.ts`
- [ ] Добавить `queryKnowledge` в electronAPI интерфейс
- [ ] Создать `knowledgeQuery.validator.ts`: `KnowledgeQueryRequestSchema`

### Этап 4: Frontend Service
**Статус:** ✅ DONE  
**Файлы:**
- `src/services/knowledgeQuery.service.ts`

- [ ] Валидация input через `KnowledgeQueryRequestSchema`
- [ ] Вызов `window.electronAPI.queryKnowledge(validated)`
- [ ] Типизация ответа, export `knowledgeQueryService`

### Этап 5: UI — KnowledgeQueryWidget + Dashboard
**Статус:** ✅ DONE  
**Файлы:**
- `src/modules/dashboard/components/KnowledgeQueryWidget.tsx`
- `src/modules/dashboard/Dashboard.tsx`

- [ ] Создать `KnowledgeQueryWidget`:
  - Input-поле с placeholder «Задайте клинический вопрос...»
  - Кнопка «Найти» / Enter
  - Состояния: idle / loading / answer / error
  - Зона ответа: текст + список источников (ссылки на болезнь/препарат) + дисклеймер
  - Graceful fallback: если нет API ключа — показать только найденные источники без AI-ответа
- [ ] Добавить виджет в `Dashboard.tsx` как отдельный раздел

### Этап 6: Тесты
**Статус:** ✅ DONE  
**Файлы:**
- `tests/knowledgeQuery.test.ts`

- [ ] Unit-тест `KnowledgeQueryRequestSchema` (граничные значения: 2 символа → error, 3 → ok, 500 → ok, 501 → error)
- [ ] Unit-тест `knowledgeQuery.service.ts`: mock electronAPI, проверка валидации
- [ ] Тест graceful degradation: пустой ответ от Gemini → return raw sources

---

## 📝 Журнал выполнения

### 06.04.2026 — Старт задачи
- Задача зафиксирована в `tasks/TASKS.md` (TASK-039)
- Создан план реализации
- Проведён анализ инфраструктуры: Gemini API, FTS, embeddings — всё готово
- Определён RAG-пайплайн и grounding-промпт

### 06.04.2026 — Дополнение по наблюдаемости (после релиза)
- Добавлено расширенное системное логирование в `knowledgeQueryService.cjs`: текст запроса, результаты поиска, превью контекста, текст ответа, трассировка этапов, метаданные времени.
- В `KnowledgeQueryWidget.tsx` добавлено отображение пути обработки запроса (этапы/trace) и времени выполнения агента.
- Усилена блокировка повторной отправки запроса: новый запрос не отправляется, пока не завершён текущий.

---

## 🔗 Связанные файлы и ресурсы

- `electron/services/cdssService.cjs` — паттерн вызова Gemini (переиспользовать)
- `electron/services/cdssSearchService.cjs` — FTS-поиск (переиспользовать `_ftsChunkSearch`)
- `electron/services/embeddingService.cjs` — semantic search (опционально)
- `electron/services/apiKeyManager.cjs` — получение API ключа
- `AI_CODING_GUIDELINES.md` — обязательно следовать
- `TASKS.md` — обновить статус при завершении

---

## ✅ Финальный отчёт

<!-- Заполняется при завершении задачи -->

**Дата завершения:** 06.04.2026  
**Итог:** RAG-пайплайн реализован полностью. Виджет добавлен на Dashboard. 10/10 тестов пройдено.  
**Изменённые файлы:**
- `electron/services/knowledgeQueryService.cjs` — RAG-сервис (FTS + LIKE + Gemini)
- `electron/modules/knowledge/handlers.cjs` — IPC handler `knowledge:query`
- `electron/preload.cjs` — expose `queryKnowledge`
- `electron/main.cjs` — регистрация `registerKnowledgeHandlers`
- `src/types.ts` — `KnowledgeSource`, `KnowledgeQueryResponse`, метод в electronAPI
- `src/validators/knowledgeQuery.validator.ts` — Zod-схема
- `src/services/knowledgeQuery.service.ts` — frontend service
- `src/modules/dashboard/components/KnowledgeQueryWidget.tsx` — UI виджет
- `src/modules/dashboard/Dashboard.tsx` — добавлен виджет
- `tests/knowledgeQuery.test.ts` — 10 unit-тестов
