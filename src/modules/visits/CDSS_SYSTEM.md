# 🏥 CDSS System (Clinical Decision Support System)

## 📋 Оглавление
1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [Data Flow](#data-flow)
4. [Компоненты системы](#компоненты-системы)
5. [Процесс анализа жалоб](#процесс-анализа-жалоб)
6. [Загрузка препаратов](#загрузка-препаратов)
7. [Загрузка диагностических исследований](#загрузка-диагностических-исследований)
8. [API Reference](#api-reference)
9. [Типы данных](#типы-данных)
10. [Текущие ограничения](#текущие-ограничения)
11. [Примеры использования](#примеры-использования)

---

## 🎯 Обзор системы

**CDSS (Clinical Decision Support System)** — это интеллектуальная система поддержки принятия клинических решений, которая помогает врачу:

- 🔍 **Анализирует** жалобы пациента, анамнез и данные осмотра
- 💡 **Предлагает** дифференциальный диагноз с ранжированием по вероятности
- 💊 **Автоматически подбирает** лекарственные препараты для выбранных диагнозов
- 🧪 **Рекомендует** диагностические исследования на основе диагноза

### Ключевые особенности

```
┌─────────────────────────────────────────────────────────┐
│ ✨ Искусственный интеллект (Gemini API)               │
│ 📊 Семантический поиск (embeddings + BM25)            │
│ 🎯 Контекстное ранжирование диагнозов                 │
│ 🔗 Интеграция с базой знаний (Disease database)       │
│ 🔁 Rate limiting анализа (1 запрос + cooldown)        │
│ 📱 Расчет дозировок по весу/возрасту пациента         │
│ ⚠️  Учет аллергий и противопоказаний                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Архитектура

### Многослойная структура

```
┌──────────────────────────────────────────────────────────────────┐
│  Component Layer (React Hooks + State Management)                 │
│  VisitFormPage.tsx                                                 │
│  ├─ useVisitAnalysis()         ←─ Rate limiting анализа          │
│  ├─ runAnalysis()              ←─ Инициирует анализ              │
│  ├─ loadMedicationsForAllDiagnoses()  ←─ Загружает препараты    │
│  └─ loadDiagnosticsForAllDiagnoses()  ←─ Загружает исследования │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓ IPC Call
               │
┌──────────────────────────────────────────────────────────────────┐
│  Service Layer (visitService.ts)                                   │
│  ├─ analyzeVisit(visitId)                                         │
│  ├─ getMedicationsForDiagnosis(diseaseId, childId)               │
│  ├─ getMedicationsByIcdCode(icdCode, childId)                    │
│  └─ getDiagnosticsByIcdCode(icdCode)                             │
│                                                                    │
│  Validation Layer:                                                │
│  └─ Zod schemas (safeParse)                                       │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓ IPC Handler
               │
┌──────────────────────────────────────────────────────────────────┐
│  Electron IPC Handlers (handlers.cjs)                              │
│  ├─ visits:analyze                                                 │
│  ├─ visits:get-medications-for-diagnosis                          │
│  ├─ visits:get-medications-by-icd-code                           │
│  └─ visits:get-diagnostics-by-icd-code                           │
│                                                                    │
│  Middleware:                                                      │
│  └─ ensureAuthenticated() - Проверка прав доступа               │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓ Service Layer
               │
┌──────────────────────────────────────────────────────────────────┐
│  Business Logic (electron/modules/visits/service.cjs)              │
│  ├─ analyzeVisit()                                                 │
│  │   ├─ Собирает клинические данные                              │
│  │   ├─ Парсит жалобы через Gemini API                          │
│  │   ├─ Семантический поиск (CDSSSearchService)                  │
│  │   ├─ Ранжирование результатов (CDSSRankingService)            │
│  │   └─ Возвращает DiagnosisSuggestion[]                         │
│  │                                                                │
│  ├─ getMedicationsForDiagnosis()                                  │
│  │   ├─ Получает ICD-10 коды заболевания                         │
│  │   ├─ Ищет связанные препараты (DiseaseMedication)            │
│  │   ├─ Расчет дозировок (MedicationDoseService)                 │
│  │   └─ Возвращает MedicationRecommendation[]                    │
│  │                                                                │
│  └─ getDiagnosticsByIcdCode()                                     │
│      ├─ Ищет заболевания по МКБ коду                            │
│      ├─ Собирает diagnosticPlan каждого                         │
│      └─ Возвращает DiagnosticRecommendation[]                    │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ↓ Prisma ORM
               │
┌──────────────────────────────────────────────────────────────────┐
│  Database Layer (SQLite + Prisma)                                  │
│  ├─ Disease model                                                  │
│  ├─ DiseaseMedication (Many-to-Many)                              │
│  ├─ DiagnosticPlan                                                │
│  ├─ Child (для контекста пациента)                               │
│  ├─ PatientAllergy (для учета аллергий)                          │
│  └─ ChunkIndex (для семантического поиска)                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### Процесс анализа визита (Full Flow)

```
┌─────────────────┐
│ Doctor заполняет│
│ VisitForm       │  Жалобы: "Кашель, температура 38°C"
│                 │  Осмотр: "Хрипы в легких"
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Нажимает "🔬 Анализировать"    │  runAnalysis() triggered
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────┐
│ Сохранить Visit как Draft (если не сохранен)│
└────────┬─────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ visitService.analyzeVisit(visitId)                          │
│ IPC → analyzeVisit handler                                   │
└────────┬──────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend: Collect Clinical Data                              │
│                                                              │
│ ✓ visit.complaints                                          │
│ ✓ visit.diseaseOnset                                        │
│ ✓ visit.diseaseCourse                                       │
│ ✓ visit.treatmentBeforeVisit                                │
│ ✓ Анамнез жизни 025/у (структурированный)                 │
│ ✓ visit.physicalExam                                        │
│ ✓ Показатели жизнедеятельности (T°, P, BP, RR, SpO2)      │
│ ✓ Осмотр по системам (дыхирование, ССС, ЖКТ, нервная)     │
└────────┬──────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Gemini API: parseComplaints()                               │
│                                                              │
│ Input: Объединенный клинический текст + возраст + вес      │
│ Output: {                                                    │
│   symptoms: ["кашель", "лихорадка", "хрипы в легких"],     │
│   severity: "средняя",                                       │
│   acuity: "острое",                                          │
│   ...                                                        │
│ }                                                            │
└────────┬──────────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────────┐
│ CDSSSearchService: Semantic Search + BM25                   │
│                                                               │
│ Input: clinical_query + parsed_symptoms                      │
│ Process:                                                     │
│   1. Генерируем embedding для каждого симптома              │
│   2. Делаем semantic search в ChunkIndex                     │
│   3. BM25 ranking внутри найденных chunks                    │
│   4. Собираем топ-20 заболеваний-кандидатов                │
│                                                               │
│ Output: [                                                    │
│   { disease: Disease, score: 0.85, evidence: [...] },      │
│   { disease: Disease, score: 0.72, evidence: [...] },      │
│   ...                                                        │
│ ]                                                            │
└────────┬──────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ CDSSRankingService: AI Ranking                                 │
│                                                                 │
│ Input: symptoms + candidates (top 20) + patient_context       │
│ Patient Context: {                                             │
│   ageMonths: 36,           ← Возраст в месяцах               │
│   weight: 15.5,            ← Вес в кг                        │
│   height: 100,             ← Рост в см                        │
│   temperature: 38.5,       ← Температура                     │
│   vitalSigns: "P-110, АД 105/70"                            │
│ }                                                              │
│                                                                 │
│ Gemini API Prompt:                                            │
│   "Ранжируй эти 20 диагнозов для 3-летнего ребенка          │
│   с кашлем, лихорадкой, хрипами в легких, Т°38.5°C"        │
│                                                                 │
│ Output: [{                                                     │
│   diseaseId: 123,          ← ID заболевания                  │
│   confidence: 0.89,        ← Вероятность (0-1)              │
│   reasoning: "Острая пневмония...",  ← Обоснование         │
│   matchedSymptoms: ["кашель", "хрипы", "лихорадка"]         │
│ }, ...]                                                       │
└────────┬───────────────────────────────────────────────────────┘
         │
    Top 3-5 suggestions
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Возвращаем DiagnosisSuggestion[]                               │
│ с полными данными Disease + confidence + reasoning            │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Frontend setState(suggestions)                                 │
│ Отображаем список диагнозов с доверием %                      │
│                                                                 │
│ ┌─────────────────────────────────────────────────┐            │
│ │ 💡 AI Suggestions (3 found)      ← Показываем  │            │
│ ├─────────────────────────────────────────────────┤            │
│ │ 1. Пневмония (89%)      [SELECT]  [DETAILS]  │            │
│ │    Matched: кашель, хрипы, лихорадка          │            │
│ │    Reasoning: Острая пневмония с типичной...  │            │
│ │                                                 │            │
│ │ 2. Бронхит (67%)        [SELECT]  [DETAILS]  │            │
│ │ 3. ОРВИ (45%)           [SELECT]  [DETAILS]  │            │
│ └─────────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────┘
         │
Doctor нажимает "SELECT" для "Пневмонии"
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ selectDiagnosis(disease)                                        │
│ └─ Sets primaryDiagnosis                                        │
│ └─ Triggers loadMedicationsForAllDiagnoses()                  │
│ └─ Triggers loadDiagnosticsForAllDiagnoses()                  │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓
    [Смотри процесс загрузки препаратов ниже]
```

---

## 🎯 Компоненты системы

### 1️⃣ Frontend Components

| Компонент | Путь | Функция |
|-----------|------|---------|
| `VisitFormPage.tsx` | `visits/` | Главная форма, инициирует анализ |
| `DiagnosisSelector.tsx` | `visits/components/` | Выбор одного диагноза |
| `MultipleDiagnosisSelector.tsx` | `visits/components/` | Выбор осложнений/сопутствующих |
| `DiseaseSidePanel.tsx` | `visits/components/` | Просмотр информации о заболевании |
| `MedicationBrowser.tsx` | `visits/components/` | Браузер препаратов |
| `DiagnosticBrowser.tsx` | `visits/components/` | Браузер исследований |

### 2️⃣ Service Layer

| Сервис | Путь | API |
|--------|------|-----|
| `visitService` | `visits/services/visitService.ts` | `analyzeVisit()`, `getMedicationsForDiagnosis()`, etc |
| `medicationDoseCalcService` | `visits/services/medicationDoseCalcService.ts` | `calculateDose()`, `calculateBSA()` |
| `visitValidator` | `src/validators/` | Zod schemas для валидации |

### 3️⃣ Backend Services (Electron)

| Сервис | Путь | Функция |
|--------|------|---------|
| `VisitService` | `electron/modules/visits/service.cjs` | analyzeVisit, getMedicationsForDiagnosis |
| `CDSSSearchService` | `electron/services/cdssSearchService.cjs` | Семантический поиск + BM25 ranking |
| `CDSSRankingService` | `electron/services/cdssRankingService.cjs` | AI ранжирование через Gemini |
| `CDSSService` | `electron/services/cdssService.cjs` | Gemini API вызовы (parseComplaints, rankDiagnoses) |
| `AnamnesisFormatter` | `electron/modules/visits/anamnesis-formatter.cjs` | Форматирование анамнеза 025/у |

---

## 🔍 Процесс анализа жалоб

### Этап 1: Сбор клинических данных

```typescript
// На backend (service.cjs)
const clinicalData = [];

// 1. АНАМНЕЗ ЗАБОЛЕВАНИЯ
if (visit.complaints) 
  clinicalData.push(`Жалобы: ${visit.complaints}`);
if (visit.diseaseOnset) 
  clinicalData.push(`Начало: ${visit.diseaseOnset}`);
if (visit.diseaseCourse) 
  clinicalData.push(`Течение: ${visit.diseaseCourse}`);
if (visit.treatmentBeforeVisit) 
  clinicalData.push(`Лечение до: ${visit.treatmentBeforeVisit}`);

// 2. АНАМНЕЗ ЖИЗНИ 025/у
const anamnesisLife = AnamnesisFormatter.formatFullAnamnesis(visit);
clinicalData.push(`Анамнез жизни:\n${anamnesisLife.join('\n')}`);

// 3. ОБЪЕКТИВНЫЙ ОСМОТР
if (visit.physicalExam) 
  clinicalData.push(`Осмотр: ${visit.physicalExam}`);

// 4. ВИТАЛЬНЫЕ ПОКАЗАТЕЛИ
const vitalSigns = [];
if (visit.temperature) vitalSigns.push(`Температура: ${visit.temperature}°C`);
if (visit.pulse) vitalSigns.push(`Пульс: ${visit.pulse} уд/мин`);
if (visit.bloodPressureSystolic && visit.bloodPressureDiastolic) 
  vitalSigns.push(`АД: ${visit.bloodPressureSystolic}/${visit.bloodPressureDiastolic}`);
if (visit.respiratoryRate) vitalSigns.push(`ЧДД: ${visit.respiratoryRate}`);
if (visit.oxygenSaturation) vitalSigns.push(`SpO2: ${visit.oxygenSaturation}%`);

// 5. ОСМОТР ПО СИСТЕМАМ
const systemsExam = [];
if (visit.generalCondition) systemsExam.push(`Общее: ${visit.generalCondition}`);
if (visit.respiratory) systemsExam.push(`Дыхание: ${visit.respiratory}`);
if (visit.cardiovascular) systemsExam.push(`ССС: ${visit.cardiovascular}`);
// ... и т.д.

const combinedClinicalText = clinicalData.join('\n\n');
```

### Этап 2: AI Parsing (Gemini)

```javascript
// На backend через Gemini API
const parsed = await parseComplaints(
  combinedClinicalText,  // Полный клинический текст
  ageMonths,             // Возраст пациента
  visit.currentWeight    // Вес для контекста
);

// Результат:
{
  symptoms: ["кашель", "лихорадка", "хрипы в легких"],
  severity: "средняя",
  acuity: "острое",
  systemsAffected: ["respiratory"],
  clinicalContext: "Вероятно инфекционное воспаление дыхательных путей"
}
```

### Этап 3: Семантический поиск (CDSSSearchService)

```javascript
// Три метода поиска в порядке приоритета:

// 1. STRUCTURED PRE-FILTER
// Быстрый фильтр по guideline полям (complaints, physicalExam, clinicalPicture)
const prefiltenedGuidelines = structuredPreFilter(clinicalQuery, guidelines);

// 2. FULL-TEXT SEARCH (BM25)
// Ищем в symptomChunks по текстовому совпадению
const ftsResults = await searchSymptomChunksByBm25(parsedSymptoms);

// 3. SEMANTIC SEARCH (Embeddings)
// Генерируем embedding для каждого симптома
// Ищем в ChunkIndex похожие chunks (cosine similarity > threshold)
const semanticResults = await semanticSearchSymptomChunks(symptoms);

// Объединяем все результаты и дедуплицируем:
const candidates = [...prefiltered, ...ftsResults, ...semanticResults]
  .filter(unique by disease.id)
  .slice(0, 20);  // Топ-20 кандидатов
```

**Конфигурация поиска:**
```javascript
// electron/config/cdssConfig.cjs
PREFILTER_TOKEN_MIN_LEN: 3,
PREFILTER_SCORE_THRESHOLD: 0.1,
MERGE_SYMPTOM_WEIGHT: 0.4,
MERGE_CHUNK_WEIGHT: 0.6,
MAX_CANDIDATES_BEFORE_RANK: 15,
MAX_CANDIDATES_FOR_AI_RANK: 8,
MAX_FALLBACK_CONFIDENCE: 0.4,
MIN_FALLBACK_MATCHES: 2,
MAX_FALLBACK_SUGGESTIONS: 3,
```

### Этап 4: AI Ranking (Gemini)

```javascript
// Двухфазный ранкинг:
// Фаза 1 (CDSSSearchService): BM25 + embeddings → top-15 кандидатов
// Фаза 2 (CDSSRankingService): Gemini ранжирует только top-8

const ranked = await rankDiagnosesWithContext(
  symptoms: ["кашель", "лихорадка", "хрипы"],
  candidates: [
    { disease: { id: 123, nameRu: "Пневмония", ... }, score: 0.85 },
    { disease: { id: 456, nameRu: "Бронхит", ... }, score: 0.72 },
    // ... top 8
  ],
  patientContext: {
    ageMonths: 36,
    weight: 15.5,
    height: 100,
    temperature: 38.5,
    vitalSigns: "P-110, BP 105/70",
    clinicalQuery: "..."
  }
);

// Каждый результат также содержит:
// phase1Score и rankingFactors
// (phase1NormalizedScore, phase1SymptomScore, phase1ChunkScore, aiConfidence)

// Gemini Prompt (иммитация):
/*
Ты педиатр. Ранжируй эти заболевания для 3-летнего ребенка:
- Вес 15.5кг, Рост 100см
- Жалобы: кашель, лихорадка (38.5°C), хрипы в легких
- Пульс 110 (норма 80-120 для этого возраста)
- АД 105/70 (норма 100/60-110/70)
- Симптомы: кашель, лихорадка, хрипы, одышка

Кандидаты:
1. Пневмония (острая)
2. Бронхит острый
3. ОРВИ с поражением нижних дыхательных путей
...

Верни JSON с ranking и reasoning для каждого
*/

// Gemini Output:
[
  {
    diseaseId: 123,
    confidence: 0.89,
    reasoning: "Острая пневмония - типичная триада (кашель, лихорадка, хрипы). 
              Тахипноэ соответствует возрасту. Вес и рост в норме.",
    matchedSymptoms: ["кашель", "лихорадка", "хрипы", "одышка"]
  },
  {
    diseaseId: 456,
    confidence: 0.67,
    reasoning: "Бронхит возможен, но хрипы в легких указывают на более нижние отделы",
    matchedSymptoms: ["кашель", "лихорадка"]
  },
  // ... остальные
]
```

### Этап 5: Fallback Analysis

Если Gemini API недоступен или ошибка:

```javascript
async _fallbackAnalysis(complaints) {
  const complaintsLower = complaints.toLowerCase();
  const diseases = await prisma.disease.findMany();

  const suggestions = diseases
    .map(d => {
      const symptoms = JSON.parse(d.symptoms || '[]');
      const matches = symptoms.filter(s => 
        complaintsLower.includes(s.toLowerCase())
      );

      // Минимум 2 совпадения для безопасности
      if (matches.length < MIN_FALLBACK_MATCHES) {
        return null;
      }

      return {
        disease: d,
        confidence: Math.min(
          MAX_FALLBACK_CONFIDENCE,
          matches.length / (Math.max(symptoms.length, 1) * 2)
        ),
        reasoning: `[⚠️ УПРОЩЁННЫЙ АНАЛИЗ] Совпало ${matches.length} симптомов`,
        matchedSymptoms: matches,
        isUsingFallback: true
      };
    })
    .filter(s => s !== null && s.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_FALLBACK_SUGGESTIONS);  // Max 3

  return suggestions;
}
```

---

## 💊 Загрузка препаратов

### Flow: Выбор диагноза → Загрузка препаратов

```typescript
// Frontend (VisitFormPage.tsx)
const selectDiagnosis = async (disease: Disease) => {
  // 1. Устанавливаем диагноз
  handlePrimaryDiagnosisSelect({ 
    code: disease.icd10Code, 
    diseaseId: disease.id,
    label: disease.nameRu 
  });

  // 2. Загружаем препараты для этого диагноза
  await loadMedicationsForAllDiagnoses(
    { diseaseId: disease.id, code: disease.icd10Code, ... },  // primary
    complicationsArr,  // осложнения
    comorbiditiesArr   // сопутствующие
  );

  // 3. Загружаем диагностику для этого диагноза
  await loadDiagnosticsForAllDiagnoses(
    { code: disease.icd10Code, ... },  // primary
    complicationsArr,  // осложнения
    comorbiditiesArr   // сопутствующие
  );
};

// Внутренняя функция loadMedicationsForAllDiagnoses():
const loadMedicationsForAllDiagnoses = async (
  primary: DiagnosisEntry | null,
  complicationsArr: DiagnosisEntry[],
  comorbiditiesArr: DiagnosisEntry[]
) => {
  // 1. Собираем все диагнозы
  const allDiagnoses = [
    ...(primary ? [primary] : []),
    ...complicationsArr,
    ...comorbiditiesArr
  ];

  // 2. Для каждого диагноза загружаем препараты
  const allRecommendations = await Promise.all(
    allDiagnoses.map(async (diagnosis) => {
      if (diagnosis.diseaseId) {
        // Через ID заболевания (выбрано из базы знаний)
        return await visitService.getMedicationsForDiagnosis(
          diagnosis.diseaseId,
          Number(childId)
        );
      } else if (diagnosis.code) {
        // Через МКБ код (выбрано из справочника ICD)
        return await visitService.getMedicationsByIcdCode(
          diagnosis.code,
          Number(childId)
        );
      }
      return [];
    })
  );

  // 3. Объединяем результаты
  const medicationMap = new Map<number, MedicationRecommendation>();
  
  allRecommendations.flat().forEach(rec => {
    const existing = medicationMap.get(rec.medication.id!);
    // Сохраняем рекомендацию с меньшим приоритетом
    if (!existing || (rec.priority && existing.priority && 
        rec.priority < existing.priority)) {
      medicationMap.set(rec.medication.id!, rec);
    }
  });

  // 4. Фильтруем только по canUse (источник истины — backend)
  const filtered = Array.from(medicationMap.values())
    .filter(rec => rec.canUse);

  // 5. Сортируем по приоритету
  filtered.sort((a, b) => (a.priority || 999) - (b.priority || 999));

  setState(filtered);
};
```

### Backend: getMedicationsForDiagnosis()

```javascript
// electron/modules/visits/service.cjs
async getMedicationsForDiagnosis(diseaseId, childId) {
  // 1. Получаем заболевание с ICD кодами
  const disease = await DiseaseService.getById(diseaseId);
  if (!disease) throw new Error('Заболевание не найдено');

  // 2. Данные ребенка (для дозировок)
  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child) throw new Error('Ребенок не найден');

  // 3. Аллергии пациента
  const allergies = await prisma.patientAllergy.findMany({
    where: { childId }
  });

  // 4. Возраст ребенка
  const birthDate = decrypt(child.birthDate);
  const ageMonths = calculateAgeInMonths(birthDate, new Date());

  // 5. Получаем ICD коды заболевания
  const icdCodes = JSON.parse(disease.icd10Codes || '[]');

  // 6. Ищем препараты через DiseaseMedication
  const medications = await prisma.diseaseMedication.findMany({
    where: {
      disease: {
        icd10Codes: { contains: icdCodes[0] }  // По первому коду
      }
    },
    include: {
      medication: true,
      dosageRules: true
    }
  });

  // 7. Для каждого препарата рассчитываем дозировку
  const recommendations = await Promise.all(
    medications.map(async (item) => {
      const medication = item.medication;

      // Проверяем противопоказания (возраст, вес)
      const ageRestriction = await checkMedicationAgeRestriction(
        medication.id,
        ageMonths
      );

      // Проверяем аллергии
      const allergy = allergies.find(a => 
        a.medicationId === medication.id
      );

      // Рассчитываем дозировку
      let doseResult = null;
      if (!allergy && !ageRestriction?.isContraindicated) {
        doseResult = await MedicationService.calculateDose(
          medication.id,
          {
            weight: child.currentWeight || null,
            ageMonths,
            height: child.currentHeight || null
          }
        );
      }

      return {
        medication,
        recommendedDose: doseResult,
        canUse: !allergy && !ageRestriction?.isContraindicated,
        warnings: [
          ...(allergy ? [`⚠️ Аллергия`] : []),
          ...(ageRestriction?.warning ? [ageRestriction.warning] : [])
        ],
        priority: item.priority || 100,
        specificDosing: item.specificDosing || null,
        duration: item.defaultDuration || null
      };
    })
  );

  return recommendations.filter(r => r.medication);
}
```

### Структура MedicationRecommendation

```typescript
interface MedicationRecommendation {
  medication: Medication;              // Объект препарата
  
  recommendedDose: DoseCalculationResult | null;  // {
                                                    // doseValue: 500,
                                                    // unit: "mg",
                                                    // frequency: "each 8 hours",
                                                    // maxDaily: "1500 mg",
                                                    // rule: {name, formula, ...}
                                                    // }
  
  canUse: boolean;                     // true если нет противопоказаний
  
  warnings: string[];                  // ["⚠️ Аллергия", "⚠️ Возраст < 2 лет"]
  
  priority?: number;                   // Приоритет (меньше = выше в списке)
  
  specificDosing?: string | null;      // Кастомная дозировка для диагноза
  
  duration?: string | null;            // Длительность лечения
}
```

---

## 🧪 Загрузка диагностических исследований

### Flow: Выбор диагноза → Загрузка исследований

```typescript
// Frontend (VisitFormPage.tsx)
const loadDiagnosticsForAllDiagnoses = async (
  primary: DiagnosisEntry | null,
  complicationsArr: DiagnosisEntry[],
  comorbiditiesArr: DiagnosisEntry[]
) => {
  // 1. Собираем все МКБ коды
  const allDiagnoses = [
    ...(primary ? [primary] : []),
    ...complicationsArr,
    ...comorbiditiesArr
  ];
  
  // 2. Извлекаем уникальные коды МКБ
  const icdCodes = [...new Set(
    allDiagnoses.map(d => d.code).filter(Boolean)
  )] as string[];
  
  // 3. Для каждого кода загружаем исследования
  const allRecommendations = await Promise.all(
    icdCodes.map(code => 
      visitService.getDiagnosticsByIcdCode(code)
    )
  );
  
  // 4. Дедуплицируем по названию исследования
  const diagnosticsMap = new Map<string, DiagnosticRecommendation>();
  allRecommendations.flat().forEach(rec => {
    const testKey = rec.item.test.toLowerCase().trim();
    if (!diagnosticsMap.has(testKey)) {
      diagnosticsMap.set(testKey, rec);
    }
  });
  
  setState(Array.from(diagnosticsMap.values()));
};
```

### Backend: getDiagnosticsByIcdCode()

```javascript
// electron/modules/visits/service.cjs
async getDiagnosticsByIcdCode(icdCode) {
  if (!icdCode || icdCode.trim() === '') {
    throw new Error('Код МКБ обязателен');
  }

  // 1. Ищем все заболевания с этим кодом
  const diseases = await prisma.disease.findMany({
    where: {
      icd10Codes: { contains: icdCode }
    }
  });

  if (!diseases.length) {
    return [];
  }

  // 2. Для каждого заболевания собираем diagnosticPlan
  const recommendations = [];
  
  for (const disease of diseases) {
    const diagnosticPlan = JSON.parse(
      disease.diagnosticPlan || '[]'
    );

    for (const item of diagnosticPlan) {
      recommendations.push({
        disease,
        item,  // { test, type: 'lab'|'instrumental', priority, ... }
        icdCode
      });
    }
  }

  return recommendations;
}

// Структура item:
{
  test: "Анализ крови клинический",
  type: "lab",           // или "instrumental"
  priority: 1,           // Порядок выполнения
  indication: "...",     // Показание
  timing: "при поступлении"  // Когда сделать
}
```

### Структура DiagnosticRecommendation

```typescript
interface DiagnosticRecommendation {
  disease: Disease;              // Заболевание
  
  item: DiagnosticPlanItem;      // {
                                  // test: "Рентген грудной клетки",
                                  // type: 'instrumental',
                                  // priority: 1,
                                  // indication: "для подтверждения пневмонии",
                                  // timing: "при поступлении",
                                  // ...
                                  // }
  
  icdCode: string;               // "J18.9" - МКБ код
}

interface DiagnosticPlanItem {
  test: string;                  // Название исследования
  type: 'lab' | 'instrumental';  // Тип
  priority?: number;             // Приоритет (сортировка)
  indication?: string;           // Показание
  timing?: string;               // Когда делать
  comment?: string;              // Комментарий
}
```

---

## 📡 API Reference

### Frontend API (visitService.ts)

#### analyzeVisit(visitId: number)
```typescript
/**
 * Анализирует жалобы пациента и предлагает диагнозы (CDSS)
 * 
 * @param visitId - ID визита (должен быть сохранен на backend)
 * @returns Promise<DiagnosisSuggestion[]>
 * 
 * @throws Error если visitId невалиден
 * 
 * @example
 * const suggestions = await visitService.analyzeVisit(123);
 * // Возвращает: [
 * //   {
 * //     disease: Disease,
 * //     confidence: 0.89,
 * //     reasoning: "Острая пневмония...",
 * //     matchedSymptoms: ["кашель", "лихорадка"]
 * //   },
 * //   ...
 * // ]
 */
async analyzeVisit(visitId: number): Promise<DiagnosisSuggestion[]>
```

#### getMedicationsForDiagnosis(diseaseId, childId)
```typescript
/**
 * Получает препараты для диагноза с расчетом дозировок
 * 
 * @param diseaseId - ID заболевания из Disease.id
 * @param childId - ID ребенка
 * @returns Promise<MedicationRecommendation[]>
 * 
 * Дозировки рассчитываются автоматически на основе:
 * - Возрас ребенка (из birthDate)
 * - Вес пациента (из currentWeight)
 * - Роста (из currentHeight, если есть)
 * 
 * @throws Error если diseaseId или childId невалиден
 * 
 * @example
 * const meds = await visitService.getMedicationsForDiagnosis(123, 456);
 */
async getMedicationsForDiagnosis(
  diseaseId: number, 
  childId: number
): Promise<MedicationRecommendation[]>
```

#### getMedicationsByIcdCode(icdCode, childId)
```typescript
/**
 * Получает препараты по МКБ-10 коду без diseaseId
 * Используется когда диагноз выбран через справочник МКБ
 * 
 * @param icdCode - МКБ-10 код (e.g., "J18.9")
 * @param childId - ID ребенка
 * @returns Promise<MedicationRecommendation[]>
 */
async getMedicationsByIcdCode(
  icdCode: string, 
  childId: number
): Promise<MedicationRecommendation[]>
```

#### getDiagnosticsByIcdCode(icdCode)
```typescript
/**
 * Получает рекомендуемые диагностические исследования по МКБ коду
 * 
 * @param icdCode - МКБ-10 код (e.g., "J18.9")
 * @returns Promise<DiagnosticRecommendation[]>
 */
async getDiagnosticsByIcdCode(
  icdCode: string
): Promise<DiagnosticRecommendation[]>
```

#### validatePatientForDosing()
```typescript
/**
 * Валидирует есть ли необходимые данные пациента для расчета дозировок
 * 
 * Обязательные поля:
 * - Дата рождения (для возраста)
 * - Вес (для дозировки)
 * - Дата приема (для расчета возраста на момент приема)
 * 
 * @returns PatientValidationResult = {
 *   isValid: boolean,
 *   params?: { weight, ageMonths, height },
 *   errors: string[]
 * }
 */
validatePatientForDosing(
  child: ChildProfile | null,
  currentWeight: number | null | undefined,
  visitDate: string | Date | null | undefined,
  currentHeight?: number | null
): PatientValidationResult
```

---

## 📊 Типы данных

### DiagnosisSuggestion
```typescript
interface DiagnosisSuggestion {
  disease: Disease;              // Объект заболевания
  confidence: number;            // Вероятность 0.0-1.0
  reasoning: string;             // Обоснование (почему этот диагноз?)
  matchedSymptoms: string[];     // Найденные симптомы в жалобах
  isUsingFallback?: boolean;     // true, если использован fallback
  phase1Score?: number;          // Score из фазы 1 (поиск)
  rankingFactors?: {
    phase1NormalizedScore: number;
    phase1SymptomScore: number;
    phase1ChunkScore: number;
    aiConfidence: number;
    aiContribution?: number;
    error?: string;
  };
}
```

### MedicationRecommendation
```typescript
interface MedicationRecommendation {
  medication: Medication;                    // Препарат
  recommendedDose: DoseCalculationResult | null;  // Рассчитанная дозировка
  canUse: boolean;                           // false если есть противопоказания
  warnings: string[];                        // Предупреждения (аллергия, возраст)
  priority?: number;                         // Приоритет назначения
  specificDosing?: string | null;            // Кастомная дозировка для диагноза
  duration?: string | null;                  // Рекомендуемая длительность
}
```

### DoseCalculationResult
```typescript
interface DoseCalculationResult {
  doseValue: number;                    // Размер дозы (число)
  unit: string;                         // Единица (mg, mL, etc)
  frequency: string;                    // Частота ("each 8 hours", "3 times daily")
  maxDaily: string;                     // Максимальная суточная доза
  route?: string;                       // Путь введения (oral, IV, IM)
  rule?: DosageRule;                    // Дозировочное правило
}
```

### DiagnosisEntry (внутренний формат)
```typescript
interface DiagnosisEntry {
  code: string;                         // МКБ-10 код (e.g., "J18.9")
  diseaseId?: number;                   // ID из Disease (опционально)
  label: string;                        // Название заболевания
}
```

### Disease (из базы знаний)
```typescript
interface Disease {
  id: number;
  icd10Code: string;                    // Главный МКБ код
  icd10Codes: string[];                 // Все связанные коды
  nameRu: string;                       // Название на русском
  descriptionRu?: string;               // Описание
  symptoms: string[];                   // Симптомы для поиска
  diagnosticPlan: DiagnosticPlanItem[]; // План обследования
  // ... другие поля
}
```

---

## ⚠️ Текущие ограничения

### Что НЕ анализируется

| Поле | Статус | Почему | Решение |
|------|--------|--------|---------|
| `pulse` | ❌ | Используется только для контекста | Добавить анализ тахикардии/брадикардии |
| `temperature` | ⚠️ | Учитывается как контекст, но не парсится | Расширить правила обработки |
| `bloodPressure` | ⚠️ | Учитывается как контекст | Добавить анализ по возрастным нормам |
| `laboratoryTests` | ❌ | Не влияет на CDSS | Добавить поддержку лаб результатов |
| `instrumentalTests` | ❌ | Не влияет на CDSS | Добавить поддержку доп исследований |
| `allergies` | ❌ | Используется только для фильтра препаратов | Добавить в рекомендации диагнозов |
| `heredity` | ✅ | Парсится из анамнеза 025/у | - |

### Производительность

- **Анализ**: 3-5 секунд (зависит от объема текста и Gemini)
- **Загрузка препаратов**: 0.5-1 сек (зависит от количества диагнозов)
- **Загрузка исследований**: 0.5-1 сек

### Зависимости

- **Gemini API** - Обязателен для AI парсинга. Если недоступен, используется fallback (текстовый поиск)
- **ChunkIndex** - Обязателен для семантического поиска. Должна быть индексирована база знаний
- **Disease database** - Обязателена база заболеваний с symptoms и diagnosticPlan

---

## 💡 Примеры использования

### Пример 1: Полный workflow анализа

```typescript
// 1. Врач заполняет форму и нажимает "Анализ"
const handleRunAnalysis = async () => {
  try {
    setIsAnalyzing(true);
    
    // 2. Сохраняем черновик визита
    const visit = await visitService.upsertVisit({
      childId: 123,
      complaints: "Кашель, температура 38°C, хрипы в легких",
      physicalExam: "Дыхание везикулярное, при ауд - крепитация",
      diseaseHistory: "Болеет второй день, пошел в ясли",
      status: 'draft'
    });

    // 3. Запускаем AI анализ
    const suggestions = await visitService.analyzeVisit(visit.id!);
    
    // 4. Показываем результаты
    setSuggestions(suggestions);
    
    // 5. Врач выбирает диагноз
    const selectedDisease = suggestions[0].disease;
    
    // 6. Загружаем препараты для диагноза
    const medications = await visitService.getMedicationsForDiagnosis(
      selectedDisease.id,
      123  // childId
    );
    
    // 7. Загружаем исследования
    const diagnostics = await visitService.getDiagnosticsByIcdCode(
      selectedDisease.icd10Code
    );
    
    console.log({
      disease: selectedDisease,
      medications,    // Массив с дозировками
      diagnostics     // Массив исследований
    });

  } catch (err) {
    console.error('Ошибка:', err);
  } finally {
    setIsAnalyzing(false);
  }
};
```

### Пример 2: Обработка дозировок

```typescript
// После выбора препарата - показываем рассчитанную дозировку
const medicationRec = medications[0];

console.log(`
  Препарат: ${medicationRec.medication.nameRu}
  
  Рекомендуемая дозировка:
  - Размер дозы: ${medicationRec.recommendedDose?.doseValue} ${medicationRec.recommendedDose?.unit}
  - Частота: ${medicationRec.recommendedDose?.frequency}
  - Макс. суточная: ${medicationRec.recommendedDose?.maxDaily}
  - Путь: ${medicationRec.recommendedDose?.route || 'per os'}
  
  Предупреждения: ${medicationRec.warnings.join(', ') || 'нет'}
  
  Продолжительность: ${medicationRec.duration || 'не указана'}
`);
```

### Пример 3: Обработка нескольких диагнозов

```typescript
// Если добавили осложнения и сопутствующие диагнозы
const diagnoses = {
  primary: { diseaseId: 123, code: "J18.9", label: "Пневмония" },
  complications: [
    { diseaseId: 456, code: "I10", label: "Гипертензия" }
  ],
  comorbidities: [
    { diseaseId: 789, code: "E10", label: "Диабет 1 типа" }
  ]
};

// Загружаем препараты для ВСЕХ диагнозов
const allMedications = await loadMedicationsForAllDiagnoses(
  diagnoses.primary,
  diagnoses.complications,
  diagnoses.comorbidities
);

// Система автоматически:
// 1. Объединит рекомендации для всех трех диагнозов
// 2. Дедуплицирует (если один препарат рекомендуется для двух диагнозов)
// 3. Сохранит препарат с меньшим приоритетом
// 4. Отфильтрует аллергены
// 5. Отсортирует по приоритету
```

### Пример 4: Обработка ошибок

```typescript
// Если AI недоступен - используется fallback
try {
  const suggestions = await visitService.analyzeVisit(visitId);
} catch (err) {
  if (err.message.includes('AI')) {
    // Используется fallback - простой текстовый поиск
    console.log('AI недоступен, использован fallback поиск');
  }
}

// Если нет данных для дозировки
const doseValidation = visitService.validatePatientForDosing(
  child,
  null,  // Нет веса
  new Date()
);

if (!doseValidation.isValid) {
  console.error('Ошибки валидации:', doseValidation.errors);
  // ["Укажите вес пациента в разделе 'Антропометрия'..."]
}
```

---

## 🔄 Интеграция с другими системами

### Связь с Disease Module

- CDSS ищет diseases по symptoms
- Система рекомендует диагнозы из Disease базы
- Каждый disease имеет связанные medications и diagnosticPlan

### Связь с Medication Module

- Препараты связаны с disease через DiseaseMedication
- Автоматический расчет дозировок по возрасту/весу
- Учет аллергий из PatientAllergy

### Связь с Child Module

- Child birthDate используется для расчета возраста
- PatientAllergy связана с Child
- currentWeight из последней Anthropometry

---

## 📝 Notes

- **Логирование**: Все операции логируются в `electron/logs/`
- **Аудит**: Все действия врача логируются (какие диагнозы выбраны, препараты назначены)
- **Offline mode**: Если Gemini недоступен - работает fallback с безопасными ограничениями (confidence ≤ 40%, min 2 совпадения)
- **Rate limiting**: Анализ ограничен до 1 параллельного запроса с cooldown 2 секунды (`useVisitAnalysis`)

---

**Документация CDSS System актуальна на**: March 18, 2026
**Последнее обновление**: Версия 2.1 (Safety fixes + Two-phase ranking + Rate limiting)
