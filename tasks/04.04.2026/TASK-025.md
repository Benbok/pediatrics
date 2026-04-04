# TASK-025 — Браузерные вкладки для Препаратов, Базы знаний, Кодов МКБ

**Дата:** 04.04.2026  
**Модуль:** tabs / navigation  
**Статус:** ✅ DONE

---

## Описание

Расширить систему вкладок (TabsContext) для поддержки навигационных вкладок модулей:
- **Препараты** (`/medications`)
- **База знаний** (`/diseases`)
- **Коды МКБ** (`/icd-codes`)

**Поведение:** При переходе в модуль автоматически открывается вкладка. При навигации внутри модуля (поиск, фильтры, открытие карточки) маршрут вкладки обновляется. При клике на вкладку осуществляется возврат к последнему состоянию (точному URL). Максимум 1 вкладка на модуль. Вкладки модулей не имеют "грязного" состояния (не требуют подтверждения закрытия).

---

## Файлы затронуты

| Файл | Изменение |
|------|-----------|
| `src/context/TabsContext.tsx` | Новые типы вкладок, авто-открытие, методы |
| `src/components/layout/TabBar.tsx` | Рендер вкладок модулей |
| `src/modules/diseases/DiseasesModule.tsx` | URL params для поиска `?q=` |
| `src/modules/icd-codes/IcdCodesModule.tsx` | URL params для поиска `?q=` и категории `?cat=` |

---

## Архитектурные решения

### Типы вкладок
```typescript
export type TabType = 'visit-form' | 'medications' | 'diseases' | 'icd-codes' | 'other';
export type ModuleTabType = 'medications' | 'diseases' | 'icd-codes';
```

### Принцип route-as-state
Вкладки модулей хранят **полный URL** (path + search params). При изменении состояния модуля URL обновляется → вкладка обновляет маршрут. При клике на вкладку → `navigate(tab.route)` → состояние восстанавливается из URL.

### Авто-открытие
В `TabsProvider` добавляется `useEffect`, слушающий `location`. При переходе на `/medications*`, `/diseases*`, `/icd-codes*` — соответствующая вкладка открывается или обновляется.

### URL params для Diseases и ICD
`DiseasesModule` и `IcdCodesModule` переводятся на `useSearchParams`, чтобы поиск/фильтры хранились в URL (аналогично `MedicationsModule`).

---

## План выполнения

### Этап 1 — TabsContext (Core) ✅ DONE
- Добавить `'medications' | 'diseases' | 'icd-codes'` в `TabType`
- Экспортировать `MODULE_TAB_CONFIGS`, `isModuleTabType()`
- Добавить `getModuleTabs()` в контекст
- Добавить `updateModuleTabRoute()` в контекст
- В `TabsProvider`: `useEffect` для авто-открытия/обновления модульных вкладок
- Исправить `setActiveTab`: сравнивать полный URL (path+search)
- Исправить `activeTabId` useEffect: prefix-matching для модульных вкладок

### Этап 2 — TabBar (UI) ✅ DONE
- Импортировать иконки `BookOpen`, `Pill` (FileText уже есть)
- Получить `getModuleTabs()` из контекста
- Показывать TabBar при `moduleTabs.length > 0 || visitTabs.length > 0`
- Рендерить секцию вкладок модулей + визуальный разделитель + вкладки приёмов
- Для модульных вкладок: иконка по типу, без индикатора dirty, простое закрытие

### Этап 3 — DiseasesModule URL params ✅ DONE
- Импортировать `useSearchParams`
- Инициализировать `searchQuery` из `?q=`
- Синхронизировать `searchQuery → URL` через `useEffect`

### Этап 4 — IcdCodesModule URL params ✅ DONE
- Импортировать `useSearchParams`
- Инициализировать `searchQuery` из `?q=`
- Инициализировать `selectedCategory` из `?cat=`
- Синхронизировать оба → URL через `useEffect`

---

## Журнал выполнения

### 04.04.2026 — Все этапы завершены
- `TabsContext.tsx`: добавлены `ModuleTabType`, `MODULE_TAB_CONFIGS`, `isModuleTabType()`, `getModuleTabs()`. `useEffect` авто-открывает/обновляет модульные вкладки при навигации. `setActiveTab` и определение активной вкладки обновлены для полного URL (path+search) и prefix-matching.
- `TabBar.tsx`: рендерит модульные вкладки (изумрудный цвет) слева, с иконками по типу, с разделителем и вкладками приёмов справа. TabBar виден при наличии любых вкладок.
- `DiseasesModule.tsx`: поиск `?q=` синхронизируется с URL params.
- `IcdCodesModule.tsx`: поиск `?q=` и категория `?cat=` синхронизируются с URL params.
