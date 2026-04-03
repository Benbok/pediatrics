# TASK-002 — Связь препаратов с болезнями через коды МКБ-10

> **Модуль:** `medications`  
> **Дата начала:** 03.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Улучшить модуль Препараты: сделать видимой связь между препаратом и записями из модуля Болезни, которая строится на совпадении кодов МКБ-10.

**Реализованы два варианта:**

1. **Inline preview** — под полем «Коды МКБ-10» в форме редактирования препарата показываются чипы совпавших болезней из базы (матчинг по точному коду и по префиксу).  
2. **Вкладка «Болезни»** — на карточке препарата (только режим редактирования) появляется вкладка с полным списком связанных болезней и навигацией к ним.

### Контекст

На backend уже есть:
- `Medication.icd10Codes` (JSON array)
- `DiseaseMedication` junction table
- IPC `medications:get-by-disease` с префиксным матчингом
- `getMedication(id)` возвращает `{ diseases: DiseaseMedication[] }` (с embedded disease объектом)

Связь была реализована, но никак не отображалась в UI.

---

## 🗂️ Затрагиваемые файлы

```
src/
  modules/medications/
    MedicationFormPage.tsx         ← Variant 1 (preview) + Tab switcher
    components/
      MedicationDiseasesTab.tsx    ← NEW — Variant 3 (tab)
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Type hints на всех функциях
- [x] Производные списки через useMemo, не useState + useEffect
- [x] Код в правильном слое (Component — только UI)
- [x] logger.* вместо console.*
- [x] Нет изменений Backend/IPC/Schema — только frontend

---

## 📐 План реализации

### Этап 1: MedicationDiseasesTab
**Статус:** ✅ DONE  
**Файлы:** `src/modules/medications/components/MedicationDiseasesTab.tsx`

- [x] Принять props: `medicationId`, `icd10Codes`
- [x] Загрузить данные через `medicationService.getMedication(id)` → `data.diseases`
- [x] Отрисовать список болезней с навигацией к `/diseases/{id}`
- [x] Пустое состояние и loading state

### Этап 2: Inline preview (Variant 1)
**Статус:** ✅ DONE  
**Файлы:** `src/modules/medications/MedicationFormPage.tsx`

- [x] Загрузить список болезней через `diseaseService.getDiseases()`
- [x] useMemo для matchingDiseases (точный + префиксный матчинг)
- [x] Отрисовать чипы совпавших болезней под полем МКБ-10
- [x] Предупреждение для кодов без совпадений

### Этап 3: Tab switcher (Variant 3)
**Статус:** ✅ DONE  
**Файлы:** `src/modules/medications/MedicationFormPage.tsx`

- [x] Добавить state `activeTab: 'form' | 'diseases'`
- [x] Tab switcher рендерить только в режиме редактирования (isEdit)
- [x] Подключить MedicationDiseasesTab

---

## 📓 Журнал

### 03.04.2026 — Все этапы завершены
- Создан `MedicationDiseasesTab.tsx` — список болезней, сгруппированных по МКБ-коду
- В `MedicationFormPage.tsx` добавлен inline preview под полем МКБ-10
- Добавлен tab switcher «Основная информация / Связанные болезни» (только в edit mode)
- Backend/IPC/Schema не изменялись

### 03.04.2026 — Расширение: привязка болезней из вкладки + автомерж кодов
- Добавлен backend: `medications:unlink-disease` IPC + `unlinkFromDisease` по всей цепочке (service → handler → preload → types → frontend service)
- `MedicationDiseasesTab` расширен: поиск по имени/коду, дропдаун, привязка с выбором приоритета, отвязка
- При привязке болезни: все её коды МКБ (primary + icd10Codes[]) автоматически мержатся в `Medication.icd10Codes` через `upsertMedication`
- Callback `onIcd10CodesUpdated` мгновенно обновляет textarea «Коды МКБ-10» в форме
- **Задача закрыта 03.04.2026**
