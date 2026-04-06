# TASK-034 — BUG: текст симптома исчезает при сохранении

**Дата:** 07.04.2026  
**Модуль:** diseases/form  
**Статус:** ✅ DONE

---

## Описание проблемы

Пользователь вводил развёрнутый текст (например, "Острое начало заболевания с невысокой (субфебрильной) температурой...") в поле ввода симптома в секции «Симптомы и клинические признаки» формы болезни. После сохранения текст исчезал.

---

## Root Cause

В `electron/utils/diseaseNormalization.cjs` функция `normalizeSymptomsToCategorized` — ветка `isNewFormat` (`{text, category}[]`) — вызывала `normalizeSymptomsWithPhrases` на каждом тексте симптома перед сохранением.

`normalizeSymptomsWithPhrases` делал **подстрочное совпадение** (`text.includes(token)`) заголовков вокабуляра против текста. Длинное предложение, содержавшее, например, "температур" (от "температурой"), заменялось короткой канонической формой ("Лихорадка"). Затем dedup-фильтр по `seen` удалял этот элемент, если каноническое слово уже было в массиве симптомов — итог: текст исчезал.

---

## Изменения

### `electron/utils/diseaseNormalization.cjs`
- В ветке `isNewFormat` убран вызов `normalizeSymptomsWithPhrases`.
- Текст симптома сохраняется **as-is** (только `trim()`).
- Валидность enum `category` по-прежнему проверяется.
- Dedup-фильтр сохранён (по точному lowercase тексту).

### `tests/symptom-categorization.test.ts`
- Добавлен тест `should preserve long paragraph text without vocabulary replacement (backend)`.
- Добавлен тест `should not deduplicate distinct long texts that share vocabulary tokens`.

---

## Тесты

```
Test Files  1 passed (1)
Tests       12 passed (12)
```

Полный прогон: **238 passed / 3 failed** (3 — pre-existing vax failures, не связаны с задачей).
