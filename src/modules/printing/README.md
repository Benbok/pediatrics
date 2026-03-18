# Модуль Printing (Печать)

## Назначение

Модуль `src/modules/printing` отвечает за:
- предпросмотр печатных документов в UI;
- печать документов через Electron;
- экспорт документов в PDF через Electron;
- регистрацию и типобезопасное использование шаблонов печати.

## Актуальная архитектура

```
UI (PrintPreview / PrintPreviewManager)
        ↓
PrintService (валидация + рендер в static HTML)
        ↓
Electron IPC
  - print-document  (нативный диалог печати)
  - export-pdf      (генерация и открытие PDF)
        ↓
Main process (hidden BrowserWindow / printToPDF)
```

Важно: модуль **не frontend-only**. Для печати/экспорта используется IPC в `electron/main.cjs`.

## Структура

```
src/modules/printing/
├── PrintService.ts
├── registry.ts
├── printEventBus.ts
├── types.ts
├── components/
│   ├── PrintPreview.tsx
│   ├── PrintPreviewManager.tsx
│   └── PrintPreview.css
├── templates/
│   ├── vaccination/
│   │   ├── register.ts
│   │   ├── VaccinationCertificate.tsx
│   │   └── ...
│   └── visit/
│       ├── register.ts
│       ├── VisitForm.tsx
│       └── ...
└── utils/
    ├── formatters.ts
    └── printStyles.ts
```

## Зарегистрированные шаблоны

- `vaccination-certificate` — сертификат профилактических прививок (Форма № 156/У-93).
- `visit-form` — форма приёма 025/у-04.

Шаблон содержит:
- `id`, `name`, `description`;
- `component` (React);
- `defaultOptions` (размер/ориентация/поля);
- `validateData` (type guard);
- `styles?: string | string[]` для инлайна критичных CSS.

## Потоки работы

### 1) Предпросмотр

`printService.preview(...)` публикует событие в `printEventBus`,
`PrintPreviewManager` открывает `PrintPreview` в модальном окне.

### 2) Печать (кнопка «Печать»)

`PrintPreview`:
1. рендерит выбранный шаблон в HTML через `renderToStaticMarkup`;
2. передаёт `html + styles + options` в `window.electronAPI.printDocument(...)`.

`main.cjs` (`print-document`):
1. создаёт скрытое окно `BrowserWindow(show: false)`;
2. загружает HTML;
3. вызывает `webContents.print({ silent: false })`.

#### Fallback при отсутствии принтера

Если `webContents.print` возвращает ошибку вида `No printers available...`,
включается автоматический fallback:
- генерируется PDF через `printToPDF`;
- файл сохраняется во временную директорию;
- PDF открывается через `shell.openPath`.

Это обеспечивает рабочий сценарий даже без настроенного принтера.

### 3) Экспорт в PDF (кнопка «Открыть PDF»)

`printService.exportToPDF(...)` рендерит HTML и вызывает `window.electronAPI.exportPDF(...)`.
В `main.cjs` выполняется `printToPDF`, файл сохраняется и открывается системным PDF viewer.

## Публичный API

`PrintService`:
- `print(templateId, data, metadata, options)`
- `preview(templateId, data, metadata, options)`
- `exportToPDF(templateId, data, metadata, options)`
- `closePrintWindow()`
- `getAvailableTemplates()`
- `isTemplateAvailable(templateId)`

`templateRegistry`:
- `register`, `get`, `getAll`, `getByCategory`, `has`, `unregister`, `clear`.

## Поведение и ограничения

- Валидация данных выполняется в `PrintService` через `template.validateData`.
- При невалидных данных методы возвращают `{ success: false, error }`.
- Для корректной печати статического HTML критичные CSS нужно передавать через `template.styles`.
- Печать и PDF-экспорт требуют Electron окружение (`window.electronAPI`).
- В non-Electron окружении `print()` использует legacy fallback `window.open + window.print`.

## Добавление нового шаблона

1. Создать папку в `templates/<name>/`.
2. Создать `types.ts` + type guard `isXxxData`.
3. Создать React шаблон `XxxTemplate.tsx`.
4. Создать `register.ts` и зарегистрировать шаблон в `templateRegistry`.
5. Добавить `styles` строкой/массивом строк, если стили важны для печати/PDF.
6. Импортировать `register.ts` при инициализации приложения.

Минимальный пример регистрации:

```ts
const template: PrintTemplate<MyData> = {
  id: 'my-template',
  name: 'My Template',
  description: '...',
  component: MyTemplate,
  defaultOptions: {
    orientation: 'portrait',
    pageSize: 'A4',
    margins: { top: 20, right: 15, bottom: 20, left: 15 },
  },
  styles: myTemplateStyles,
  validateData: isMyData,
};

templateRegistry.register(template);
```

## Связанные файлы

- `src/modules/printing/PrintService.ts`
- `src/modules/printing/components/PrintPreview.tsx`
- `src/modules/printing/registry.ts`
- `src/modules/printing/types.ts`
- `electron/preload.cjs`
- `electron/main.cjs`
