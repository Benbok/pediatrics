# TASK-040 — Chunk size optimization: 700 → 1400, overlap 100 → 250

> **Модуль:** `diseases/guidelines` + `knowledge/rag`  
> **Дата начала:** 07.04.2026  
> **Статус:** 📋 PLANNED  
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Увеличить размер чанков при разбиении клинических рекомендаций для лучшего сохранения контекста таблиц дозировок и больших секций.

- `CHUNK_SIZE`: 700 → 1400 символов
- `CHUNK_OVERLAP`: 100 → 250 символов

### Контекст

Текущий размер 700 символов обрезает медицинские таблицы дозировок (которые занимают несколько сотен слов). Предложенный в анализе optimal range — 1200–1500. Выбираем 1400 как компромисс между контекстностью и точностью FTS.

### Ожидаемый результат

- Таблицы дозировок попадают в один чанк целиком
- Смежные предложения протокола не разрываются на границе
- FTS качество не деградирует (overlap 250 обеспечивает связность)

---

## 🗂️ Затрагиваемые файлы

```
electron/
  config/cdssConfig.cjs                 ← CHUNK_SIZE, CHUNK_OVERLAP константы

scripts/
  create_clinical_chunks.py             ← default parameters argv fallback
```

---

## ✅ Checklist

- [ ] `cdssConfig.cjs` обновлён
- [ ] `create_clinical_chunks.py` дефолты обновлены
- [ ] `logger.*` везде, `console.*` не добавлен
- [ ] Нет migration (только config-change)

---

## 📐 План реализации

### Этап 1: Config update
**Статус:** ⬜ TODO  
**Файлы:** `electron/config/cdssConfig.cjs`

- [ ] `CHUNK_SIZE: 700` → `CHUNK_SIZE: 1400`
- [ ] `CHUNK_OVERLAP: 100` → `CHUNK_OVERLAP: 250`

### Этап 2: Script defaults update
**Статус:** ⬜ TODO  
**Файлы:** `scripts/create_clinical_chunks.py`

- [ ] Дефолтный `chunk_size` в `sys.argv` fallback: 700 → 1400
- [ ] Дефолтный `chunk_overlap`: 100 → 250

---

## 📝 Лог выполнения

- `07.04.2026` — задача создана
