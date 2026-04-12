# TASK-051: Миграция LLM с node-llama-cpp на HTTP-клиент LM Studio

**Статус:** 🔄 В работе  
**Приоритет:** Высокий  
**Дата создания:** 2026-04-10

## Описание

Полная замена встроенного LLM-инференса (`node-llama-cpp`) на HTTP-клиент к LM Studio REST API (OpenAI-совместимый эндпоинт `localhost:1234`). Устраняет зависимость от нативных GPU-библиотек (~500MB), решает проблему с Vulkan-бекендом (100% CPU, ~45с на 32 токена) и позволяет запускать приложение на слабых машинах без GPU.

## Причина

- `node-llama-cpp` автоматически выбирает Vulkan (не CUDA) — катастрофически медленно
- CUDA prebuilt несовместим, сборка из исходников требует CUDA Toolkit
- LM Studio на том же оборудовании: ~0.23с, 25 tok/s (CUDA)
- На слабых ПК: модель можно загрузить через LM Studio (CPU) или указать удалённый эндпоинт

## Этапы реализации

### Этап 1: Перезапись localLlmService.cjs ✅
### Этап 2: Адаптация handlers.cjs ✅
### Этап 3: Обновление types.ts ✅
### Этап 4: Обновление preload.cjs ✅
### Этап 5: Обновление main.cjs ✅
### Этап 6: Обновление VisitFormPage.tsx ✅
### Этап 7: Очистка package.json ✅
### Этап 8: Верификация ✅
### Этап 9: Промежуточное подтверждение применения рефайна ✅

### Подзадача: Сравнение Gemini vs Local LLM в Knowledge Dashboard (2026-04-10)

#### Этап A1: Prisma schema / migration ✅ (N/A)
- Изменения БД не требуются: RAG-контекст и источники остаются без изменения схемы.

#### Этап A2: Validators ✅ (N/A)
- Входной валидатор `KnowledgeQueryRequestSchema` сохранён без изменений.
- Расширение касается только shape ответа (контракт TypeScript + backend payload).

#### Этап A3: IPC handler backend ✅
- `electron/services/knowledgeQueryService.cjs` расширен: добавлен параллельный вызов двух провайдеров (`Gemini` + `localLlmService`/LM Studio).
- Добавлены отдельные поля результата: `geminiAnswer`, `localAnswer`, `geminiErrorMessage`, `localErrorMessage`, `geminiDurationMs`, `localDurationMs`.
- Поле `answer` сохранено для обратной совместимости (`Gemini-first`, fallback на local).

#### Этап A4: Types sync ✅
- `src/types.ts` синхронизирован с новым контрактом `KnowledgeQueryResponse` для dual-provider ответа и метрик.

#### Этап A5: Service layer ✅
- `src/services/knowledgeQuery.service.ts` оставлен как единая точка вызова (без прямого IPC в UI), совместим с расширенным response.

#### Этап A6: UI components ✅
- `src/modules/dashboard/components/KnowledgeQueryWidget.tsx` обновлён: 2 колонки-карточки (Gemini / Локальная LLM), отдельные тайминги, отдельные ошибки.
- Добавлены раздельные блоки «вывода терминала» (trace) по каждому провайдеру.

#### Этап A7: Tests ✅
- Прогнан целевой набор: `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- Дополнительно выполнен `npx tsc --noEmit`: обнаружены pre-existing ошибки вне scope подзадачи (не блокируют точечный rollout).

#### Этап A8: UI эвристика сравнения ✅
- В `KnowledgeQueryWidget` добавлен блок «Сравнение моделей (эвристика)» с авто-выводами:
  - скорость (кто быстрее и на сколько),
  - полнота (сопоставимый/более развёрнутый ответ по объёму текста).
- Логика работает на существующих полях `geminiDurationMs/localDurationMs` и `geminiAnswer/localAnswer` без изменения backend-контракта.

#### Этап A9: Runtime hotfix по логам прода ✅
- Исправлен `query parameter limit exceeded` в `searchMedicationsByChunkMentions()`:
  - термы ранжируются по частоте,
  - применяется лимит `MAX_BASE_TERMS`,
  - Prisma-запросы идут батчами (`BATCH_SIZE`) с дедупликацией результатов.
- Усилен local LLM fallback в `localLlmService`:
  - при `stream` с `tokens=0` выполняется повторный запрос в non-stream режиме,
  - извлекается `choices[0].message.content` и прокидывается в общий `onToken`.
- Улучшена классификация ошибок:
  - Gemini `high demand` → понятный текст о перегрузке,
  - local `empty answer` → отдельное сообщение «вернула пустой ответ».

#### Этап A10: Адаптивный backoff контекста для local LLM ✅
- В `generateLocalAnswer()` добавлен многошаговый retry с уменьшающимся лимитом контекста при ошибках переполнения (`n_keep`, `context length`).
- Базовый локальный cap снижен до 8000 символов и может быть переопределён через `LOCAL_LLM_CONTEXT_CAP_CHARS`.
- Для локальной модели теперь предусмотрены последовательные cap-уровни (base → 65% → 45%), что снижает риск HTTP 400 от LM Studio на больших RAG-контекстах.

## Технические детали

### API эндпоинт (OpenAI-совместимый)
```
POST http://localhost:1234/v1/chat/completions
Content-Type: application/json

{
  "model": "qwen2.5-7b-instruct",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "temperature": 0.12,
  "max_tokens": 64,
  "stream": true
}
```

### SSE формат ответа
```
data: {"id":"...","choices":[{"delta":{"content":"token"}}]}

data: [DONE]
```

## Затрагиваемые файлы
- `electron/services/localLlmService.cjs` — полная переработка
- `electron/modules/llm/handlers.cjs` — адаптация
- `electron/preload.cjs` — добавление healthCheck
- `electron/main.cjs` — удаление init/dispose
- `src/types.ts` — обновление типов LLM
- `src/modules/visits/VisitFormPage.tsx` — проверка доступности
- `package.json` — очистка зависимостей

## Лог задачи
- 2026-04-10: Задача создана. Причина: Vulkan backend в node-llama-cpp непригоден для продакшена.
- 2026-04-10: Все 8 этапов выполнены. node-llama-cpp удалён (-87 пакетов). localLlmService переписан на HTTP fetch + SSE к LM Studio. handlers.cjs: ChatML удалён, messages[] API. preload/types обновлены с healthCheck(). main.cjs: удалены initialize/dispose/llm:ready. AppShell: убран badge загрузки модели. VisitFormPage: добавлена проверка доступности LM Studio перед refine. Все CJS проходят node --check, TS ошибок нет (кроме pre-existing).
- 2026-04-10 21:48: Добавлен промежуточный этап подтверждения для рефайна полей (pending proposal with original/refined + accept/reject). Применение в форму происходит только после явного подтверждения врача. Механизм реализован через универсальный словарь pendingRefinements по ключу поля, что позволяет масштабировать тот же подход на другие разделы.
- 2026-04-10 21:56: Стабилизирован prompt для `llm:refine-field`: добавлены явные ограничения против форматирования (заголовки/двоеточия/новая структура), требование обычного письменного регистра (без ALL CAPS для обычных слов), снижены sampling-параметры (temperature 0.05, top_p 0.8) для более детерминированного исправления орфографии/пунктуации.
- 2026-04-10 22:03: Вынесены строки и параметры рефайна в конфиг по секциям: создан `electron/modules/llm/refine.constants.cjs` (карта секций, поля, system/user prompts, generation options). `handlers.cjs` переведен на `buildRefineMessages()` и `buildRefineGenerationOptions()`, что упрощает масштабирование рефайн-кнопок для других разделов.
- 2026-04-10 22:12: Устранен конфликт инструкций в refine prompt (буквальное сохранение vs нормализация регистра). Prompt переработан на режим орфография/пунктуация/регистр без изменения смысла, сохранение аббревиатур и кодов отдельно. Параметры генерации сделаны детерминированными (`temperature=0`, `top_p=1`) для более стабильного качества.
- 2026-04-10 22:20: Добавлены правила однострочного вывода и интерпретации троек чисел как дат в refine-конфиг. На сервере введена пост-обработка результата: переносы строк схлопываются в пробелы, последовательности вида `23 10 25` нормализуются в `23.10.25`. Исправлен контракт `buildRefineGenerationOptions()` — теперь он получает исходный текст и корректно вычисляет лимит токенов.
- 2026-04-10 22:27: Усилена детерминированная нормализация дат в `handlers.cjs`: поддержаны разделители пробел/точка/слэш/дефис, а безопасный fallback теперь возвращает не сырой исходный текст, а его нормализованную форму (одна строка + дата `ДД.ММ.ГГ`). Это снимает зависимость от того, исправила ли сама модель формат даты.
- 2026-04-10 22:35: В пост-обработку refine добавлена эвристическая сборка предложений из многострочного текста: переносы строк трактуются как границы предложений, а короткие фрагменты с предлогов (`с`, `без`, `при` и т.п.) присоединяются к предыдущей фразе через запятую. Цель — получать одну строку без потери структуры клинической записи.
- 2026-04-10 22:18: Старт подзадачи сравнения ответов в Knowledge Dashboard (Gemini vs Local LLM) в рамках TASK-051.
- 2026-04-10 22:20: Этапы A1/A2 зафиксированы как N/A (без Prisma/validator изменений), scope подтверждён: IPC/types/service/UI/tests.
- 2026-04-10 22:22: В `knowledgeQueryService.cjs` добавлен dual-provider orchestration: параллельная генерация, отдельные ошибки/тайминги, обратносуместимое поле `answer`.
- 2026-04-10 22:23: В `src/types.ts` и `KnowledgeQueryWidget.tsx` добавлен контракт и UI двух колонок с карточками, раздельными trace-выводами и статусами провайдеров.
- 2026-04-10 22:24: Тесты: `npx vitest run tests/knowledgeQuery.test.ts` PASS (10/10). `npx tsc --noEmit` выявил pre-existing ошибки в несвязанных модулях (diseases/settings/medication/tests), без новых ошибок в затронутых файлах.
- 2026-04-10 22:46: Внесены продакшен-правки для refine-контура: LM Studio-специфичные `topK`/`repeatPenalty` перенесены в `extra_body` OpenAI-совместимого payload, усилен `extractProtectedTokens()` для медицинских единиц (`°C`, `мм рт. ст.`, `SpO2`, `pH`, `%`, дозы и коды), пороги guardrail-валидации вынесены в именованные константы, добавлено измерение времени `validateRefinementOutput()` и отдельный warning для `empty-output`.
- 2026-04-10 23:02: Реализован следующий шаг refine-v2 без расширения модели до "автора": `refine.constants.cjs` получил field-specific prompt rules внутри секции `diseaseHistory` (разный стиль для жалоб, начала, течения и лечения), в `handlers.cjs` добавлены отдельные инварианты для числовых значений и единиц измерения, а в `DiseaseHistorySection.tsx` карточка подтверждения upgraded до локального diff-view с подсветкой изменений и короткими человекочитаемыми метками (`Числа сохранены`, `Нормализована дата`, `Исправлена пунктуация`, `Нормализован регистр`).
- 2026-04-10 22:26: Добавлен UI-блок «Сравнение моделей (эвристика)» в Knowledge Dashboard: автоматические выводы по скорости и полноте ответов Gemini vs Local LLM.
- 2026-04-10 22:26: Повторный целевой прогон `npx vitest run tests/knowledgeQuery.test.ts` — PASS (10/10), регрессий в scope подзадачи не выявлено.
- 2026-04-10 22:31: По runtime-логам добавлен hotfix в RAG knowledge pipeline: устранено переполнение лимита SQL-параметров при chunk-mention поиске препаратов (ранжирование + батчи), добавлен non-stream fallback для LM Studio при пустом stream-ответе.
- 2026-04-10 22:32: Проверки после hotfix: `node --check electron/services/localLlmService.cjs` + `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 22:36: Добавлен адаптивный retry local LLM по контексту: при `n_keep/context length` сервис повторяет генерацию на меньшем контексте (base, 65%, 45%).
- 2026-04-10 22:36: Проверки после A10: `node --check electron/services/knowledgeQueryService.cjs` + `node --check electron/services/localLlmService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 22:38: По запросу увеличен дефолтный лимит локального контекста `LOCAL_LLM_CONTEXT_CAP_CHARS` в `knowledgeQueryService` с 8000 до 24000 символов (для моделей/инстансов LM Studio с `n_ctx` до 32768).
- 2026-04-10 22:38: Проверки после увеличения cap: `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 22:40: По логам LM Studio выявлена причина `Local LLM generation aborted`: клиентский таймаут 45s завершал соединение во время prompt-processing (`Client disconnected`).
- 2026-04-10 22:41: В `localLlmService.cjs` внедрён адаптивный timeout (по объёму prompt) с дефолтом 120s и увеличением до 180s для больших запросов; добавлен env `LOCAL_LLM_REQUEST_TIMEOUT_MS` и явная ошибка `LM Studio timeout after ...` вместо неинформативного `aborted`.
- 2026-04-10 22:41: Проверки после timeout-fix: `node --check electron/services/localLlmService.cjs` + `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 22:47: По запросу увеличено время ожидания local LLM: дефолтный timeout повышен до 300000 ms (5 минут). Для крупных prompt теперь адаптивные значения 320000/360000 ms.
- 2026-04-10 22:47: Проверки после увеличения timeout: `node --check electron/services/localLlmService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 22:52: По логам с выводом `????` добавлен guard качества local LLM-ответа: детект «garbled output» (аномально высокий `?`/низкая доля букв) и авто-retry в `forceNonStream` с детерминированными параметрами (`temperature=0`, `top_p=1`, `top_k=40`, `repeatPenalty=1.12`).
- 2026-04-10 22:52: Для local LLM добавлен non-stream режим в `localLlmService.generate(options.forceNonStream)` и отдельный user-facing маппинг ошибки «Локальная LLM вернула поврежденный текст».
- 2026-04-10 22:52: Проверки после garbled-output fix: `node --check electron/services/localLlmService.cjs` + `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 23:00: Оптимизация latency local LLM: введён адаптивный `maxTokens` по intent в `knowledgeQueryService` (`diagnosis=320`, `general=420`, `treatment/dosing=560`) + env override `LOCAL_LLM_MAX_TOKENS`.
- 2026-04-10 23:00: Для fallback non-stream maxTokens ограничен до `min(localMaxTokens, 512)` для ускорения и снижения риска «длинных» ответов.
- 2026-04-10 23:00: Проверки после speed-opt: `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 23:07: Добавлен intent-aware postprocess для local LLM: при `intent=diagnosis` автоматически удаляется блок `**Препараты:**`, если модель уходит в лечение.
- 2026-04-10 23:07: Для `diagnosis` ужесточены параметры локальной генерации (`temperature=0`, `top_p=1`, `top_k=40`, `repeatPenalty=1.12`) и снижен maxTokens до 260 для ускорения.
- 2026-04-10 23:07: Проверки после diagnosis-guard: `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
- 2026-04-10 23:13: Расширен rule-based диагноз intent: запросы с «клиника», «проявления», «жалобы» теперь попадают в `diagnosis` (раньше часть кейсов уходила в `none/general` и брала завышенный maxTokens).
- 2026-04-10 23:13: Оптимизирован recovery от `garbled output`: сначала переход на меньший cap контекста, дорогой `non-stream` fallback запускается только на последней (минимальной) попытке и с малым лимитом токенов (до 220).
- 2026-04-10 23:13: Для `diagnosis` добавлен пониженный базовый cap контекста local LLM (14000) при отсутствии env override — ускоряет prompt-processing на слабых системах.
- 2026-04-10 23:13: Проверки после runtime-opt: `node --check electron/services/knowledgeQueryService.cjs` → OK; `npx vitest run tests/knowledgeQuery.test.ts` → PASS (10/10).
