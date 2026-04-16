# TASK-068 — Офлайн-режим: убрать зависимости от CDN

> **Модуль:** `infra / build`  
> **Дата начала:** 16.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Приложение при запуске выполняло внешние сетевые запросы, что приводило к ошибкам при отсутствии интернета:
- `GET https://cdn.tailwindcss.com/?plugins=typography` → `ERR_NAME_NOT_RESOLVED`
- `GET https://fonts.googleapis.com` (Inter) → сетевой запрос
- `Uncaught ReferenceError: tailwind is not defined`

### Контекст
Проект использует Tailwind v4 через Vite/PostCSS (`src/index.css` с `@import "tailwindcss"`), но `index.html` содержал CDN-скрипт Play CDN (`cdn.tailwindcss.com`) — это дублирование, несовместимое с production Vite-сборкой и требующее интернет.

### Ожидаемый результат
Приложение стартует полностью офлайн. Нет внешних HTTP-запросов при загрузке UI.

---

## 🗂️ Затрагиваемые файлы

```
index.html              ← удалён CDN-скрипт tailwind + Google Fonts link
src/index.css           ← добавлен @plugin "@tailwindcss/typography" + @fontsource/inter imports
package.json            ← добавлены @tailwindcss/typography, @fontsource/inter
```

---

## ✅ Checklist

- [x] Удалён `<script src="https://cdn.tailwindcss.com?plugins=typography">` из `index.html`
- [x] Удалён inline `tailwind.config` из `index.html`
- [x] Удалён `<link href="https://fonts.googleapis.com/...">` из `index.html`
- [x] Установлен `@tailwindcss/typography` (devDependency)
- [x] Подключён `@plugin "@tailwindcss/typography"` в `src/index.css`
- [x] Установлен `@fontsource/inter` (dependency)
- [x] Подключены `@import "@fontsource/inter/N00.css"` для весов 300–700 в `src/index.css`

---

## 📐 Этапы реализации

### Этап 1: Удалить CDN Tailwind
**Статус:** ✅ DONE  
**Файлы:** `index.html`, `src/index.css`

- [x] Убрать CDN-скрипт и inline config из `index.html`
- [x] Подключить `@plugin "@tailwindcss/typography"` через PostCSS

### Этап 2: Убрать Google Fonts
**Статус:** ✅ DONE  
**Файлы:** `index.html`, `src/index.css`

- [x] Установить `@fontsource/inter`
- [x] Импортировать шрифт локально из `node_modules`

---

## 📝 Лог

| Время | Событие |
|-------|---------|
| 16.04.2026 | Задача создана и закрыта (hotfix) |

---

## 🏁 Результат

Все внешние зависимости заменены локальными пакетами. Приложение работает в полностью офлайн-режиме.
