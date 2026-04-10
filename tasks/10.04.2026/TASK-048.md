# TASK-048: Интеграция локального LLM-агента через node-llama-cpp

## Статус
🔄 В работе

## Описание
Добавить централизованный локальный LLM-сервис в Electron-приложение для загрузки и использования `Qwen2.5-7B-Instruct` на основе `node-llama-cpp`.

## Цель
Обеспечить локальный инференс в main-процессе через новый сервис и IPC API, с поддержкой:
- загрузки модели из `./models/` в dev и `process.resourcesPath/models/` в prod;
- проверки свободной памяти (минимум 6 ГБ);
- потоковой отправки токенов в renderer;
- прерывания генерации через `AbortController`;
- безопасного освобождения ресурсов при завершении приложения;
- graceful degradation, если модель не найдена или не может быть загружена.

## Реализовано
- `electron/services/localLlmService.cjs` — сервис и lifecycle для локального LLM.
- `electron/modules/llm/handlers.cjs` — IPC-контракты `llm:generate`, `llm:abort`, `llm:get-status`.
- `electron/preload.cjs` — экспонирование `electronAPI.llm`.
- `electron/main.cjs` — регистрация `setupLlmHandlers()`, инициализация при старте, очистка при закрытии.
- `src/types.ts` — типы для `electronAPI.llm`.

## Проверка
1. Запустить приложение в dev-режиме без наличия модели и проверить, что приложение стартует.
2. Поместить модель `qwen2.5-7b-instruct.Q4_K_M.gguf` в `./models/`.
3. Вызвать `window.electronAPI.llm.getStatus()` и убедиться, что `isLoaded` становится `true`.
4. Запустить `window.electronAPI.llm.generate(prompt)` и получить события `llm:token`.
5. Вызвать `window.electronAPI.llm.abort()` во время генерации и проверить статус `aborted`.
6. Закрыть приложение и убедиться, что `dispose()` выполняется без ошибок.

## Статус задач
- [x] Создание IPC-слоя
- [x] Добавление preload-контракта
- [x] Размещение инициализации в main
- [ ] Тестирование в dev
- [ ] Проверка сборки
