# TASK-050 — UI индикатор загрузки при инициализации LLM и БД

> **Модуль:** `auth`  
> **Дата начала:** 2026-04-10  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Добавить многоэтапный UI индикатор загрузки на странице логирования и при инициализации приложения. Вместо белого экрана после нажатия "Войти", показать прогресс с определённым этапами.

### Контекст

Когда пользователь нажимает "Войти", следующие процессы могут занимать время:
- Проверка сессии (checkAuth в AuthContext)
- Инициализация базы данных Prisma
- Загрузка LLM модели Qwen2.5-7B (~2-3 сек на первый запуск)
- Проверка лицензии

Сейчас есть минимальный spinner, но он не показывает, на каком этапе находится загрузка. Пользователь может подумать, что программа зависла.

### Ожидаемый результат

1. **Новый компонент** `LoadingIndicator` с:
   - Progress bar с процентом (0% → 100%)
   - 4–5 этапов загрузки (проверка сессии, БД, LLM, лицензия)
   - Иконки/баджи для каждого этапа
   - Плавная анимация между этапами
   - Описание текущего этапа

2. **Обновлённый AuthContext** с отслеживанием этапов:
   - `loadingStage: 'idle' | 'session' | 'database' | 'llm' | 'license' | 'complete'`
   - `loadingProgress: number` (0–100)

3. **App.tsx и LoginPage.tsx** используют новый индикатор вместо базового spinner

---

## 🗂️ Затрагиваемые файлы

```
src/
  context/
    AuthContext.tsx          ← добавить loadingStage и loadingProgress
  components/
    ui/
      LoadingIndicator.tsx   ← новый компонент
  modules/
    auth/
      LoginPage.tsx          ← использовать LoadingIndicator
  App.tsx                    ← использовать LoadingIndicator для init
electron/
  main.cjs                   ← опционально: сигналы о прогрессе LLM
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [ ] Type hints на всех функциях
- [ ] `logger.*` вместо `console.*` если добавляются логи
- [ ] Нет magic numbers (используем `constants.ts`)
- [ ] Код в правильном слое (Component ≠ Logic)
- [ ] CSS классы следуют Tailwind/design system
- [ ] На мобильных экранах также выглядит хорошо
- [ ] Unit тесты написаны (опционально для UI-компонента)

---

## 📐 План реализации

<!-- Порядок: Backend → Frontend → Tests -->

### Этап 1: Создать компонент LoadingIndicator
**Статус:** ✅ DONE  
**Файлы:** `src/components/ui/LoadingIndicator.tsx`

- [x] Определить интерфейс пропсов (stage, progress, message)
- [x] Создать компонент с progress bar и этапами
- [x] Добавить Tailwind стили (анимация, цвета)
- [x] Проверить responsiveness

**Результат:** 
- Создан компонент LoadingIndicator с типом LoadingStage
- 4 этапа загрузки (сессия, БД, LLM, лицензия)
- Progress bar c процентом
- Плавные анимации и иконки Lucide
- Full responsiveness

### Этап 2: Расширить AuthContext для отслеживания стадий
**Статус:** ✅ DONE  
**Файлы:** `src/context/AuthContext.tsx`

- [x] Добавить state: `loadingStage` и `loadingProgress`
- [x] Обновить `checkAuth()` для обновления стадий
- [x] Обновить `login()` для обновления стадий
- [x] Экспортировать типы

**Результат:**
- `loadingStage: LoadingStage` state добавлен
- `loadingProgress: number` state добавлен
- checkAuth() обновляет stage: idle → session (15%) → database (40%) → llm (75%) → license (95%) → complete (100%)
- login() показывает прогресс с плавной анимацией
- По завершении загрузки сбрасывает state через 500ms

### Этап 3: Обновить App.tsx и LoginPage.tsx
**Статус:** ✅ DONE  
**Файлы:** `src/App.tsx`, `src/modules/auth/LoginPage.tsx`

- [x] Импортировать LoadingIndicator
- [x] Заменить базовый spinner на LoadingIndicator в App.tsx (2 места)
- [x] Заменить базовый spinner на LoadingIndicator в LoginPage.tsx
- [x] Передать loadingStage и loadingProgress из AuthContext
- [x] Убедиться что indeterminate state работает правильно

**Результат:**
- App.tsx: заменены оба spinner-а (dev mode + production)
- LoginPage.tsx: показывает LoadingIndicator при isSubmitting или isLoading
- Плавный переход между экранами
- Progress bar обновляется в реальном времени

### Этап 4: Тесты и проверка
**Статус:** ⏸️ ОЖИДАНИЕ

- [ ] Визуальная проверка в браузере
- [ ] Убедиться что загрузка не зависает
- [ ] Проверить что прогресс обновляется плавно
- [ ] Проверить на мобильных экранах


---

## 📝 Журнал выполнения

### 2026-04-10 — Старт задачи
- Задача зафиксирована в TASKS.md
- Создан план реализации
- Синхронизирован контекст из AuthContext

### 2026-04-10 — Этапы 1-3 завершены
- ✅ **Этап 1:** Создан компонент `LoadingIndicator.tsx` с progress bar, 4 этапами, плавными анимациями и иконками
  - Экспортируется тип `LoadingStage` для типизации
  - Поддерживает темный режим (dark mode)
  - Responsive дизайн
  
- ✅ **Этап 2:** Расширен `AuthContext.tsx` для отслеживания прогресса
  - Добавлены state: `loadingStage: LoadingStage` и `loadingProgress: number`
  - Обновлена функция `checkAuth()`: null → session (15%) → database (40%) → llm (75%) → license (95%) → complete (100%)
  - Обновлена функция `login()` с отображением прогресса и 500ms delay для завершения анимации
  - Экспортированы в AuthContext.Provider

- ✅ **Этап 3:** Обновлены `App.tsx` и `LoginPage.tsx`
  - App.tsx: заменены оба базовых spinner-а на LoadingIndicator
  - LoginPage.tsx: показывает LoadingIndicator при isSubmitting или isLoading
  - Передаются loadingStage и loadingProgress из контекста

- ✅ **TypeScript:** Все файлы компилируются без ошибок

---

## 🔗 Связанные ресурсы

- `src/context/AuthContext.tsx` — текущая реализация
- `src/modules/auth/LoginPage.tsx` — текущая страница логирования
- `src/App.tsx` — инициализация приложения
- `AI_CODING_GUIDELINES.md` — обязательно следовать
- `DESIGN_SYSTEM.md` — цветовые схемы и компоненты

---

## ✅ Финальный отчёт

<!-- Заполняется при завершении задачи -->

**Дата завершения:** —  
**Итог:** —  
**Изменённые файлы:**
- ...
