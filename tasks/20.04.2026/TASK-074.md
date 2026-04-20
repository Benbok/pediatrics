# TASK-074 — Field-level Encryption: Visits, Vaccinations, Nutrition

> **Модуль:** `security / crypto`  
> **Дата начала:** 20.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Расширить field-level шифрование (AES-256-GCM) на все текстовые поля, содержащие персональные медицинские данные пациентов в модулях Приёмы, Прививки и Питание.

**Числовые поля** (вес, рост, давление, пульс) — не шифруются (нет изменений схемы).  
**Существующие данные** — не мигрируются. Decrypt backward-совместим.

### Ожидаемый результат
- При открытии `dev.db` напрямую все клинические тексты нечитаемы
- Старые незашифрованные записи продолжают работать

---

## 🗂️ Затрагиваемые файлы

```
electron/
  crypto.cjs                          ← isEncrypted() helper, smart decrypt
  database.cjs                        ← VaccinationRecord + VaccinationProfile
  modules/
    visits/service.cjs                ← Visit text fields (encrypt/decrypt helpers)
    nutrition/service.cjs             ← ChildFeedingPlan.comments
```

---

## 📐 Поля для шифрования

### VaccinationRecord (уже есть: vaccineBrand, notes)
`completedDate`, `dose`, `series`, `expiryDate`, `manufacturer`

### VaccinationProfile  
Все risk factor JSON-строки: `hepBRiskFactors`, `pneumoRiskFactors`, `pertussisContraindications`, `polioRiskFactors`, `mmrContraindications`, `meningRiskFactors`, `varicellaRiskFactors`, `hepaRiskFactors`, `fluRiskFactors`, `hpvRiskFactors`, `tbeRiskFactors`, `rotaRiskFactors`, `customVaccines`, `mantouxDate`

### Visit  
`complaints`, `complaintsJson`, `physicalExam`, `diseaseOnset`, `diseaseCourse`, `treatmentBeforeVisit`, `heredityData`, `birthData`, `feedingData`, `infectiousDiseasesData`, `allergyStatusData`, `generalCondition`, `consciousness`, `skinMucosa`, `lymphNodes`, `musculoskeletal`, `respiratory`, `cardiovascular`, `abdomen`, `urogenital`, `nervousSystem`, `primaryDiagnosis`, `complications`, `comorbidities`, `prescriptions`, `recommendations`, `notes`, `additionalExaminationPlan`, `laboratoryTests`, `instrumentalTests`, `consultationRequests`, `physiotherapy`, `hospitalizationIndication`, `consciousnessLevel`

### ChildFeedingPlan
`comments`

---

## ✅ Checklist

- [x] `isEncrypted()` — надёжная проверка формата (salt=32h:iv=24h:tag=32h:data)
- [x] `decrypt()` использует `isEncrypted()` вместо простого `.includes(':')`
- [x] VaccinationRecord: encrypt on write, decrypt on read
- [x] VaccinationProfile: encrypt JSON strings on write, decrypt before JSON.parse
- [x] Visit: `_encryptVisitFields` / `_decryptVisitFields` helpers
- [x] Visits `upsert`: encrypt перед записью в DB
- [x] Visits `_parseVisitFields`: decrypt перед JSON.parse
- [x] Nutrition `saveFeedingPlan`: encrypt comments
- [x] Nutrition `getFeedingPlans`: decrypt comments

---

## 📝 Журнал выполнения

### 20.04.2026 — Создание и реализация
- Задача TASK-074 создана
- Все этапы реализованы в одной сессии
