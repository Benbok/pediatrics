# TASK-021 — Audit покрытие бета-лактамов по ATC в vidal-db и dev.db

> **Модуль:** `medications/data`
> **Дата начала:** 04.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Сделать единый audit-скрипт по бета-лактамным антибиотикам, чтобы сравнивать:

- покрытие источника `vidal-db` по `DocumentID`
- покрытие импортированных записей в `dev.db`
- распределение по ATC-подгруппам
- распределение `route_of_admin`

### Охват групп

- `J01C*` — пенициллины
- `J01DB*`, `J01DC*`, `J01DD*`, `J01DE*`, `J01DI*` — цефалоспорины
- `J01DF*` — монобактамы
- `J01DH*` — карбапенемы

Предварительно в `vidal-db` найдено `119` уникальных `DocumentID` по этим группам.

---

## ✅ Что нужно сделать

1. Создать `scripts/audit_beta_lactam_coverage.py`
2. Вывести summary по источнику и по импортированной БД
3. Показать количества по группам и route_of_admin
4. Запустить скрипт и сохранить результат в задаче

---

## 📊 Результат

### Vidal source coverage

- `penicillins`: `32`
- `cephalosporins`: `69`
- `monobactams`: `1`
- `carbapenems`: `17`
- `total`: `119`

### Imported dev.db coverage

- `penicillins`: `26`
- `cephalosporins`: `58`
- `monobactams`: `1`
- `carbapenems`: `15`
- `total`: `100`

### Delta (source - imported)

- `penicillins`: `6`
- `cephalosporins`: `11`
- `monobactams`: `0`
- `carbapenems`: `2`

### Route distribution in dev.db

- `im`: `6`
- `inhalation`: `1`
- `iv_infusion`: `78`
- `oral`: `15`

### Вывод

Основная причина расхождения между `DocumentID` из `vidal-db` и количеством записей в `dev.db` — схлопывание разных документов в одну запись препарата при одинаковом `name_ru + atc_code`.

