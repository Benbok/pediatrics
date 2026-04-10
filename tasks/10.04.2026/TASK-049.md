# TASK-049: Кнопка рефакторинга полей через локальный LLM в "Анамнез заболевания"

## Статус
✅ Завершена (10.04.2026)

## Описание
Добавить функцию быстрого рефакторинга текстовых полей в `DiseaseHistorySection` (жалобы, анамнез, лечение) через локальный LLM `Qwen2.5-7B-Instruct`. Проверка орфографии, пунктуация — без изменения клинического содержания.

## Участники
- Тех: Electron IPC, Node LLaMA, React streaming
- Архитектура: 4 слоя (Main Process → IPC → React → UI)

## Параметры LLM
- temperature: 0.12 (минимум галлюцинаций)
- topP: 0.9 (отсечение low-prob токенов)
- repeatPenalty: 1.15
- stopStrings: `['</s>']`

## Системный промпт
```
Ты — медицинский редактор. Исправь опечатки, добавь правильную пунктуацию.
НЕ добавляй новую информацию. НЕ изменяй клинический смысл.
Верни только исправленный текст без пояснений.
```

## Реализация
- [x] Создать TASK-049 в TASKS.md
- [x] Добавить `llm:refine-field` обработчик → перенесён в `electron/modules/llm/handlers.cjs`
- [x] Добавить API в `electron/preload.cjs`
- [x] Добавить типы в `src/types.ts` (включая `stop`, `genId`, `activeGenerations`)
- [x] Добавить состояние + обработчик в `VisitFormPage.tsx` (результат применяется к `formData`)
- [x] Добавить UI + кнопки в `DiseaseHistorySection.tsx`
- [x] Compliance fixes: ChatML промпт, ALLOWED_FIELDS, no-throw, параллельные генерации, batchSize=1
- [ ] Тестирование: опечатки → рефакторинг → abort (требует ручной проверки после запуска)

## Файлы
- `electron/main.cjs` — IPC handler + streaming
- `electron/preload.cjs` — API для renderer
- `src/types.ts` — типы
- `src/modules/visits/VisitFormPage.tsx` — состояние + пропсы
- `src/modules/visits/components/DiseaseHistorySection.tsx` — UI
