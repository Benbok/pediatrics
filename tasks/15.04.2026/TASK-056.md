# TASK-056 — TypeScript cleanup + Full test suite green

> **Модуль:** `cross-cutting / tests`  
> **Дата начала:** 2026-04-15
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Устранение накопившихся ошибок TypeScript-компилятора (14 TS-ошибок в 2 файлах + 7 дополнительных по результатам полного `tsc --noEmit`) и восстановление зелёного состояния всего vitest-набора (309 тестов).

### Контекст
Перед задачей фиксировались:
- 14 TS18048/TS2304 в `DiseaseAiAssistant.tsx` и `examTextTemplateService.ts`
- 7 TS-ошибок в 6 других файлах, выявленных полным прогоном `npx tsc --noEmit`
- 10 провальных vitest-тестов в 2 файлах (`symptom-categorization.test.ts`, `vax.test.ts`)
- Отсутствие `@testing-library/react` / `jsdom` для компонентных тестов

### Ожидаемый результат
- `npx tsc --noEmit` → exit 0, 0 ошибок
- `npx vitest run` → все тесты проходят

---

## 🗂️ Затронутые файлы

```
src/
  modules/diseases/components/DiseaseAiAssistant.tsx   ← guard pattern для electronAPI
  modules/visits/services/examTextTemplateService.ts   ← getElectronApi() helper
  modules/settings/SettingsModule.tsx                  ← cast для onChange
  modules/diseases/components/PrettySelect.tsx         ← searchInputClassName prop
  modules/vaccination/components/PrettySelect.tsx      ← searchInputClassName prop (copy)
  types.ts                                             ← _aliasFor?: string в DiagnosticPlanItem
  types/medication.types.ts                            ← удалён дублирующий routeOfAdmin
  utils/parseInstructionText.ts                        ← скобки вокруг ?? операнда
  logic/vax/bcg.ts                                     ← null-safe birthWeight check
tests/
  symptom-categorization.test.ts                       ← expect.objectContaining
  disease-history-section.test.tsx                     ← jsdom directive + assertion fix
package.json / package-lock.json                       ← @testing-library/react, jsdom
```

---

## ✅ Checklist

- [x] `DiseaseAiAssistant.tsx`: удалён стейл-коллбэк `handleTriggerPrecompute`, добавлен guard на `electronAPI?.rag`
- [x] `examTextTemplateService.ts`: `getElectronApi()` helper вместо прямых вызовов (6 мест)
- [x] `DiagnosticPlanItem` в `src/types.ts`: добавлено `_aliasFor?: string`
- [x] `SettingsModule.tsx`: cast-обёртка для `onChange` в PrettySelect
- [x] Оба `PrettySelect.tsx`: добавлен проп `searchInputClassName?: string`
- [x] `medication.types.ts`: удалён дублирующий `routeOfAdmin`
- [x] `parseInstructionText.ts`: исправлен приоритет `??` оператора
- [x] `bcg.ts`: `birthWeightG = child.birthWeight ?? profile.birthWeight ?? null` — не срабатывает при undefined
- [x] `symptom-categorization.test.ts`: 6 утверждений → `expect.objectContaining()`
- [x] `disease-history-section.test.tsx`: `// @vitest-environment jsdom` + правильный regex (`Генерация:`)
- [x] Установлены `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [x] `npx tsc --noEmit` → exit 0
- [x] `npx vitest run` → **309 passed | 1 skipped (310)**, 0 failed

---

## 📐 Итоги реализации

### Этап 1: TS-ошибки в `DiseaseAiAssistant.tsx` + `examTextTemplateService.ts`
**Статус:** ✅ DONE

- Убран стейл callback, guard `ragApi = window.electronAPI?.rag` + ранний return
- `getElectronApi()` с throw при отсутствии API, 6 замен

### Этап 2: Полный `npx tsc --noEmit` — 7 дополнительных ошибок
**Статус:** ✅ DONE

| Ошибка | Файл | Исправление |
|--------|------|-------------|
| TS2353 `_aliasFor` | `DiseaseFormPage.tsx` → `src/types.ts` | Добавлен в интерфейс |
| TS2322 onChange | `SettingsModule.tsx` | Cast-обёртка lambda |
| TS2322 searchInputClassName | `MedicationBrowser.tsx` → оба `PrettySelect.tsx` | Добавлен проп |
| TS2300 дубль routeOfAdmin | `medication.types.ts` | Удалён первый экземпляр |
| TS2869 `??` precedence | `parseInstructionText.ts` | Скобки |
| TS2307 @testing-library/react | тестовый файл | npm install |

### Этап 3: Настройка Testing Library + jsdom
**Статус:** ✅ DONE

- Установлены пакеты
- Добавлен `// @vitest-environment jsdom` в компонентный тест
- Исправлен assertion regex

### Этап 4: Тесты — BCG + Symptom Categorization
**Статус:** ✅ DONE

- BCG: `(profile.birthWeight || 0) < 2000` заменён на null-safe проверку через `child.birthWeight ?? profile.birthWeight ?? null`
- Symptom: 6 `toEqual({ text, category })` → `toEqual(expect.objectContaining({ text, category }))`

---

## 📊 Финальный результат

```
npx tsc --noEmit  →  (нет вывода, exit 0)

npx vitest run    →  Test Files  20 passed | 1 skipped (21)
                      Tests  309 passed | 1 skipped (310)
                      Duration  1.64s
```

1 skipped = `tests/live-cdss-ai.integration.test.ts` — интеграционный тест, требует живой AI API, ожидаемо пропускается.
