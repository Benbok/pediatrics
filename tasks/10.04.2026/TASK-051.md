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
