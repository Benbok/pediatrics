# TASK-032 — UI-виджет связывания нового названия теста с псевдонимом каталога

**Дата:** 06.04.2026  
**Модуль:** diseases/form  
**Статус:** ✅ DONE

---

## Проблема

При сохранении болезни `_ensureTestNamesInCatalog` автоматически создаёт новые канонические записи в `DiagnosticTestCatalog` для каждого неизвестного названия теста.  
Это приводит к дублям в каталоге: «Общий анализ крови» и «Общий анализ крови (развёрнутый)» становятся отдельными каноническими записями вместо того, чтобы одна была алиасом другой.

---

## Решение

После `blur` в поле «Исследование», если имя не найдено в каталоге — показать инлайн-виджет под полем с выбором:

- **Вариант A:** «Сохранить как новое исследование» (оставить как есть — текущее поведение)
- **Вариант B:** «Связать с: [PrettySelect канонических имён]» — при сохранении сохранить текст как алиас выбранного канонического теста, в `item.test` записать каноническое имя

### Поведение при сохранении

- Если пользователь выбрал «Связать с X»:
  - Backend добавляет набранный текст в `aliases[]` у записи `X` в `DiagnosticTestCatalog`
  - В `diagnosticPlan[i].test` сохраняется отображаемое имя — **каноническое** имя X
  - `_ensureTestNamesInCatalog` НЕ создаёт новую запись для этого item (он уже aliased)
- Если пользователь выбрал «Новое исследование» или не трогал виджет и тип не определён:
  - Поведение как раньше — auto-create canonical entry

---

## Файлы изменений

| Файл | Изменение |
|------|-----------|
| `electron/modules/diseases/handlers.cjs` | + handler `diseases:link-test-alias` |
| `electron/modules/diseases/service.cjs` | + метод `linkTestAlias(aliasText, canonicalName)`, изменение `_ensureTestNamesInCatalog` |
| `electron/preload.cjs` | + `linkDiseaseTestAlias` |
| `src/modules/diseases/services/diseaseService.ts` | + `linkTestAlias` |
| `src/modules/diseases/DiseaseFormPage.tsx` | + состояние `pendingAliasChoices` + inline-виджет |
| `tests/disease-alias-linking.test.ts` | новые unit-тесты |

---

## Критерии завершения

- [ ] Blur без совпадения показывает виджет выбора
- [ ] «Новое исследование» закрывает виджет без изменений
- [ ] «Связать с X» вызывает IPC `diseases:link-test-alias`, обновляет `item.test = X`, закрывает виджет
- [ ] При сохранении aliased items не создают дублей canonical
- [ ] Тесты ≥ 5 новых, все зелёные
