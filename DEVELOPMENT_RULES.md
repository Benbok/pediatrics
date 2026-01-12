# DEVELOPMENT RULES - PediAssist

**Правила архитектуры, разработки и поддержки медицинского ПО**

> Этот документ **обязателен к прочтению** для всех разработчиков проекта.
> Нарушение критических правил (🔴) может привести к потере медицинских данных или компрометации безопасности.

---

## 🎯 Фундаментальные принципы

### 1. Целостность бизнес-логики - высший приоритет
- Все операции с медицинскими данными и персональными данными требуют **максимальной надежности**
- Принцип **"Zero Trust Input"**: никогда не доверяем данным с фронтенда без строгой валидации
- **Defense in Depth**: двойная валидация (Frontend Service + Backend IPC)

### 2. Единый источник правды (SSOT - Single Source of Truth)
- **Backend (БД + Prisma Models)** - единственный источник истины для медицинских данных
- Фронтенд **только отображает** данные из API
- Фронтенд **не дублирует** сложные медицинские расчеты

### 3. Разделение ответственности (Separation of Concerns)

```
Component (View)     → Отображение UI, сбор пользовательских данных
       ↓
Service Layer        → Бизнес-логика, валидация, IPC вызовы
       ↓
IPC Handler          → HTTP-подобный роутинг, авторизация
       ↓
Database Layer       → Данные, базовая валидация на уровне модели
```

#### Роли слоев:

| Слой | Ответственность | Запрещено |
|------|----------------|-----------|
| **Component (.tsx)** | UI rendering, user events, форм сбор | Бизнес-логика, прямые IPC вызовы, валидация |
| **Service (.ts)** | Бизнес-логика, Zod валидация, IPC calls | UI logic, прямой доступ к DOM |
| **IPC Handler (.cjs)** | Routing, auth middleware, Zod validation | UI logic, сложные расчеты |
| **Model (Prisma)** | Data structure, базовая валидация | Сложная бизнес-логика |
| **Utils** | Переиспользуемые чистые функции | Side effects, state |
| **Constants** | Магические числа, конфигурация | Логика |

---

## 📋 Обязательные правила разработки

### 🔴 КРИТИЧЕСКИ ВАЖНО (нельзя нарушать)

#### Безопасность и целостность данных

```typescript
// ❌ ЗАПРЕЩЕНО: Связанные операции без транзакций
await prisma.child.create({ data: childData });
await prisma.vaccinationProfile.create({ data: profileData }); // Если упадет - orphan record

// ✅ ПРАВИЛЬНО
await prisma.$transaction(async (tx) => {
  const child = await tx.child.create({ data: childData });
  await tx.vaccinationProfile.create({ 
    data: { ...profileData, childId: child.id } 
  });
});
```

```javascript
// ❌ ЗАПРЕЩЕНО в production
try {
  // some code
} catch (error) {
  console.log(error); // Небезопасно
  traceback.print_exc(); // НИКОГДА
}

// ✅ ПРАВИЛЬНО
const { logger } = require('./logger.cjs');

try {
  // some code
} catch (error) {
  logger.error('[Module] Operation failed:', error);
  throw error; // Re-throw или обработать
}
```

```typescript
// ❌ ЗАПРЕЩЕНО: Доверять данным фронтенда без валидации
ipcMain.handle('db:create-child', async (_, child) => {
  return await prisma.child.create({ data: child }); // Опасно!
});

// ✅ ПРАВИЛЬНО
ipcMain.handle('db:create-child', ensureAuthenticated(async (_, child) => {
  const validatedChild = ChildProfileSchema.parse(child); // Zod validation
  return await prisma.child.create({ data: validatedChild });
}));
```

#### Архитектура

```typescript
// ❌ ЗАПРЕЩЕНО: Бизнес-логика в ViewSet/Component (> 20 строк)
const PatientCard: React.FC = () => {
  const handleSave = async () => {
    // 50+ lines of validation, calculations, IPC calls...
    // ЭТО НЕПРАВИЛЬНО!
  };
};

// ✅ ПРАВИЛЬНО: Делегирование сервису
const PatientCard: React.FC = () => {
  const handleSave = async () => {
    try {
      await patientService.createChild(formData);
      // Component только обрабатывает результат
    } catch (error) {
      setError(error.message);
    }
  };
};
```

```typescript
// ❌ ЗАПРЕЩЕНО: Магические числа
const ageLimit = child.ageMonths < 18 ? 'infant' : 'toddler'; // Что такое 18?
const dosage = weight * 8.0; // Откуда 8.0?

// ✅ ПРАВИЛЬНО: Константы
// constants.ts
export const INFANT_AGE_THRESHOLD_MONTHS = 18;
export const DOSAGE_PER_KG = 8.0;

// usage
const ageLimit = child.ageMonths < INFANT_AGE_THRESHOLD_MONTHS ? 'infant' : 'toddler';
const dosage = weight * DOSAGE_PER_KG;
```

#### Качество кода

```typescript
// ❌ ЗАПРЕЩЕНО: Функции без type hints
function calculateAge(birthDate, today) { // Какие типы?
  return Math.floor((today - birthDate) / (365 * 24 * 60 * 60 * 1000));
}

// ✅ ПРАВИЛЬНО
function calculateAge(birthDate: Date, today: Date): number {
  return Math.floor((today.getTime() - birthDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
}
```

```typescript
// ❌ ЗАПРЕЩЕНО: Дублирование кода (> 5 строк одинаковой логики)
// patient.service.ts
export const patientService = {
  getFullName: (child: ChildProfile) => 
    [child.surname, child.name, child.patronymic].filter(Boolean).join(' ')
};
```

#### 🎨 Дизайн и Доступность (Aesthetics & Accessibility)

- ❌ **КРИТИЧЕСКИ ЗАПРЕЩЕНО**: Использование светлого текста на светлом фоне (например, белый текст на голубом кнопке без достаточной насыщенности).
- ❌ **ЗАПРЕЩЕНО**: "Слепые" кнопки без четких границ или контрастного фона в активных состояниях.
- ✅ **ОБЯЗАТЕЛЬНО**: Проверка контрастности по стандарту WCAG AA (минимум 4.5:1 для обычного текста).
- ✅ **ОБЯЗАТЕЛЬНО**: Использование семантических токенов (`--color-primary-600`) вместо hardcoded HEX-кодов в компонентах.
- ✅ **ОБЯЗАТЕЛЬНО**: Наличие визуального отклика (hover/active/focus) для всех интерактивных элементов.

---

### ⚠️ ВАЖНО (исправлять при первой возможности)

#### Типизация

```typescript
// ⚠️ Плохо
const data: any = await fetchData();

// ✅ Хорошо
const data: ChildProfile = await patientService.getChildById(id);
```

#### Структура файлов

```typescript
// ⚠️ Файл > 500 строк
// VaccinationModule.tsx (800 lines) ← Разделить!

// ✅ Правильная структура
// VaccinationModule.tsx (150 lines) - главный компонент
// VaccineCard.tsx (100 lines) - карточка вакцины
// RiskFactorsPanel.tsx (80 lines) - панель факторов риска
// vaccination.service.ts (100 lines) - бизнес-логика
```

**Лимиты:**
- **Файл**: < 500 строк (разделять при превышении)
- **Класс/Компонент**: < 300 строк
- **Метод/Функция**: < 50 строк
- **Model операции**: < 20 строк сложной логики

---

## 🏗️ Архитектурные правила

### Service Layer Pattern

#### Когда создавать новый сервис?

1. **Модуль имеет > 3 IPC вызовов** → Создать сервис
2. **Есть повторяющаяся бизнес-логика** → Вынести в сервис
3. **Сложная валидация данных** → Централизовать в сервисе

#### Структура сервиса

```typescript
// src/services/feature.service.ts

import { FeatureSchema } from '../validators/feature.validator';
import type { Feature, FeatureUpdateInput } from '../types';

/**
 * FeatureService
 * 
 * Centralized business logic for Feature management.
 * Handles validation, IPC communication, and data transformation.
 */
export const featureService = {
  /**
   * Get all features
   */
  async getAll(): Promise<Feature[]> {
    return await window.electronAPI.getFeatures();
  },

  /**
   * Create new feature with validation
   */
  async create(data: FeatureInput): Promise<Feature> {
    // 1. Validate with Zod
    const validated = FeatureSchema.parse(data);
    
    // 2. IPC call
    const result = await window.electronAPI.createFeature(validated);
    
    // 3. Return typed result
    return result;
  },

  /**
   * Helper: Calculate something complex
   */
  calculateMetric(feature: Feature): number {
    // Business logic here
    return feature.value * 2;
  }
};
```

### Backend IPC Handler Pattern

```javascript
// electron/database.cjs

const { ensureAuthenticated } = require('./auth.cjs');
const { logger, logAudit } = require('./logger.cjs');

ipcMain.handle('db:create-feature', ensureAuthenticated(async (_, data) => {
  try {
    // 1. Validate
    const validated = FeatureSchema.parse(data);
    
    // 2. Business logic (if simple)
    const result = await prisma.feature.create({
      data: validated
    });
    
    // 3. Audit
    logAudit('FEATURE_CREATED', { featureId: result.id });
    
    // 4. Return
    return result;
  } catch (error) {
    logger.error('[Database] Failed to create feature:', error);
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
}));
```

### Валидация: двухслойная защита

#### Frontend (Service Layer)
```typescript
// src/services/patient.service.ts
import { ChildProfileSchema } from '../validators/child.validator';

export const patientService = {
  async createChild(data: ChildProfileInput) {
    // CLIENT-SIDE VALIDATION
    const validated = ChildProfileSchema.parse(data);
    return await window.electronAPI.createChild(validated);
  }
};
```

#### Backend (IPC Handler)
```javascript
// electron/database.cjs
ipcMain.handle('db:create-child', ensureAuthenticated(async (_, child) => {
  // SERVER-SIDE VALIDATION (повторная!)
  const validated = ChildProfileSchema.parse(child);
  return await prisma.child.create({ data: validated });
}));
```

**Почему дважды?**
1. **Frontend**: Быстрые user feedback, UX
2. **Backend**: Defense in depth, защита от direct API manipulation

---

## 📂 Где хранить код?

### Структура по типам файлов

```
src/
├── modules/            # Функциональные модули (feature-based)
│   └── patients/
│       ├── PatientsModule.tsx       # Главная страница
│       ├── PatientCard.tsx          # Компонент карточки
│       ├── PatientDetails.tsx       # Детальный просмотр
│       └── components/              # Локальные компоненты модуля
│
├── services/           # Бизнес-логика + IPC
│   ├── patient.service.ts
│   ├── vaccination.service.ts
│   └── geminiService.ts
│
├── validators/         # Zod schemas
│   ├── child.validator.ts
│   ├── vaccination.validator.ts
│   └── record.validator.ts
│
├── logic/              # Чистая медицинская логика (pure functions)
│   └── vax/
│       ├── index.ts              # Main calculation engine
│       ├── rules.ts              # Rule types
│       ├── bcg.ts, dtp.ts, ...  # Vaccine rules
│       └── *.test.ts             # Unit tests рядом с логикой
│
├── components/         # Переиспользуемые UI компоненты
│   ├── Button.tsx
│   ├── VaccineCard.tsx
│   └── layout/
│       └── AppShell.tsx
│
├── context/            # React Context (глобальное состояние)
│   ├── AuthContext.tsx
│   └── ChildContext.tsx
│
├── constants.ts        # Все константы (магические числа, конфиги)
└── types.ts            # TypeScript interfaces

electron/               # Backend
├── main.cjs           # Lifecycle
├── database.cjs       # IPC handlers
├── auth.cjs           # Authentication
├── crypto.cjs         # Encryption
├── logger.cjs         # Logging
└── backup.cjs         # Backup service

tests/                  # Integration tests (E2E scenarios)
├── vaccination-records.test.cjs
└── polio-hib-revaccination.test.cjs
```

### Правила размещения

| Тип кода | Где хранить | Пример |
|----------|-------------|--------|
| UI Компонент модуля | `src/modules/<module>/` | `PatientsModule.tsx` |
| Переиспользуемый UI | `src/components/` | `Button.tsx`, `Card.tsx` |
| Бизнес-логика + IPC | `src/services/` | `patient.service.ts` |
| Чистая медлогика | `src/logic/vax/` | `bcg.ts`, `calculateSchedule()` |
| Валидация схемы | `src/validators/` | `child.validator.ts` |
| Backend IPC | `electron/database.cjs` | `ipcMain.handle('db:...')` |
| Константы | `src/constants.ts` | `VACCINE_SCHEDULE` |
| Типы | `src/types.ts` | `ChildProfile` interface |

---

## 🧪 Тестирование: обязательные требования

### Что ОБЯЗАТЕЛЬНО тестировать?

#### 1. Core Medical Logic (Критично!)

```typescript
// src/logic/vax/vax.test.ts

describe('calculateVaccineSchedule', () => {
  it('should handle Hepatitis B risk group correctly', () => {
    const riskProfile = { hepBRiskFactors: ['MOTHER_HBSAG'] };
    const schedule = calculateVaccineSchedule(child, riskProfile, [], VACCINE_SCHEDULE);
    
    // Должно быть 4 дозы вместо 3
    expect(schedule.filter(v => v.id.startsWith('hepb'))).toHaveLength(4);
  });
});
```

**Coverage requirement**: **80%+** для `src/logic/vax/`

#### 2. Service Layer (Важно)

```typescript
// src/services/patient.service.test.ts

describe('patientService', () => {
  it('should validate child data before IPC call', async () => {
    const invalidData = { name: 'A' }; // Слишком короткое имя
    
    await expect(
      patientService.createChild(invalidData)
    ).rejects.toThrow('Имя должно содержать минимум 2 символа');
  });
});
```

#### 3. Integration Tests (E2E)

```javascript
// tests/vaccination-records.test.cjs

// Проверка полного сценария:
// 1. Создание пациента
// 2. Добавление записи о вакцинации
// 3. Расчет графика
// 4. Проверка статуса
```

### Когда запускать тесты?

| Этап | Команда | Обязательность |
|------|---------|----------------|
| **Перед коммитом** | `npm test` | 🔴 ОБЯЗАТЕЛЬНО для изменений в `logic/` |
| **После рефакторинга** | `npm test` | 🔴 ОБЯЗАТЕЛЬНО |
| **Новая фича** | Написать тесты → `npm test` | ⚠️ Желательно |
| **CI/CD** | `npm test` в pipeline | ⚠️ Рекомендуется |

### Где хранить тесты?

```
src/logic/vax/
├── index.ts
├── bcg.ts
├── bcg.test.ts          # ✅ Unit тесты рядом с кодом
└── vax.test.ts

tests/
├── vaccination-records.test.cjs      # ✅ Integration тесты отдельно
└── polio-hib-revaccination.test.cjs
```

---

## ✅ Checklist перед коммитом

### Автоматические проверки

```bash
# 1. Django/Backend check (если применимо)
python manage.py check

# 2. Проверка миграций
python manage.py makemigrations --dry-run

# 3. Тесты
npm test
```

### Ручная проверка (30 секунд)

- [ ] Нет `console.log()` / `traceback.print_exc()` в production коде
- [ ] Нет магических чисел (выносить в `constants.ts`)
- [ ] Есть `@transaction.atomic` / `prisma.$transaction` для связанных операций
- [ ] Бизнес-логика НЕ в Component, а в Service
- [ ] Все функции имеют **type hints** (TypeScript)
- [ ] Нет дублирования кода (> 5 строк)
- [ ] Файлы не превышают лимиты (500 строк)
- [ ] Добавлен audit log (`logAudit`) для критических операций

---

## 📏 Стандарты и лимиты

### Размеры кода

| Элемент | Лимит | Действие при превышении |
|---------|-------|-------------------------|
| Файл | 500 строк | Разделить на модули |
| Компонент/Класс | 300 строк | Вынести подкомпоненты |
| Функция/Метод | 50 строк | Разбить на под-функции |
| Сложная Model операция | 20 строк | Вынести в Service |

### Типизация

```typescript
// ✅ ОБЯЗАТЕЛЬНО
function processData(input: string): Promise<Result> { }

// ✅ Для денежных/точных данных
type Money = number; // В БД: Decimal/Float
const price: Money = 150.50;

// ✅ Help text для моделей
const ChildSchema = z.object({
  birthWeight: z.number()
    .min(500, 'Вес при рождении должен быть не менее 500 г')
});
```

### Обработка ошибок

```typescript
// ✅ Централизованный exception handler
try {
  await riskyOperation();
} catch (error) {
  logger.error('[Module] Operation failed:', error);
  
  // Стандартизированный формат для фронтенда
  if (error instanceof z.ZodError) {
    throw new Error(error.errors.map(e => e.message).join(', '));
  }
  
  throw error; // Re-throw для обработки выше
}
```

---

## 🔄 Workflow новой фичи (полный цикл)

### При добавлении нового поля/функционала:

#### 1. Backend: Model → Migration → Schema
```bash
# 1. Изменить Prisma schema
# prisma/schema.prisma
model Child {
  // ... existing fields
  newField String?
}

# 2. Создать миграцию
npx prisma migrate dev --name add_new_field

# 3. Обновить TypeScript types
npx prisma generate
```

#### 2. Валидация: Zod Schema
```typescript
// src/validators/child.validator.ts
export const ChildProfileSchema = z.object({
  // ... existing
  newField: z.string().optional(),
});
```

#### 3. Backend: IPC Handler
```javascript
// electron/database.cjs
ipcMain.handle('db:update-child', ensureAuthenticated(async (_, id, updates) => {
  const validated = ChildProfileSchema.partial().parse(updates);
  // ... implementation
}));
```

#### 4. Frontend: Service
```typescript
// src/services/patient.service.ts
export const patientService = {
  async updateChild(id: number, updates: Partial<ChildProfile>) {
    const validated = ChildProfileSchema.partial().parse(updates);
    return await window.electronAPI.updateChild(id, validated);
  }
};
```

#### 5. Frontend: Component
```typescript
// src/modules/patients/PatientDetails.tsx
const handleUpdate = async () => {
  await patientService.updateChild(child.id, { newField: value });
};
```

#### 6. Tests
```typescript
// src/services/patient.service.test.ts
it('should update child with new field', async () => {
  const result = await patientService.updateChild(1, { newField: 'test' });
  expect(result.newField).toBe('test');
});
```

**Порядок обязательный**: Backend → Validation → IPC → Service → UI → Tests

---

## 🎯 Золотые правила

### 1. Код пишется для людей, а не для компьютеров
```typescript
// ❌ Плохо
const x = d.getTime() - b.getTime();
const y = x / (1000 * 60 * 60 * 24 * 30.44);

// ✅ Хорошо
const diffMs = today.getTime() - birthDate.getTime();
const ageInMonths = Math.floor(diffMs / MS_PER_MONTH);
```

### 2. Один раз написал, сто раз прочитали
- Делайте код **понятным**, а не "умным"
- **Комментируйте сложную медицинскую логику**

```typescript
// ✅ Хороший комментарий
// Приказ 1122н: для недоношенных (<2000г) используем БЦЖ-М вместо БЦЖ
const bcgType = child.birthWeight < 2000 ? 'bcg-m' : 'bcg';
```

### 3. Fail Fast
- Ошибки должны **выбрасываться явно**, а не замалчиваться
- Используйте `throw` вместо `return null` для неожиданных ситуаций

```typescript
// ✅ Правильно
if (!child) {
  throw new Error('Child not found');
}
```

### 4. DRY (Don't Repeat Yourself)
- **5+ строк повторяющейся логики** → Вынести в утилиту/сервис

### 5. KISS (Keep It Simple)
- Простое решение **лучше сложного**
- Если функция занимает > 50 строк → Упростить или разбить

---

## 📚 Приоритеты исправления

### 🔴 Критично (немедленно)
1. Нарушения безопасности (`console.log`, `print_exc()`, отсутствие валидации)
2. Риск потери данных (отсутствие транзакций)
3. Бизнес-логика в неправильных слоях (Component вместо Service)

### ⚠️ Важно (ближайшее время)
1. Магические числа, отсутствие типизации
2. Дублирование кода, нарушение DRY
3. Превышение лимитов размеров файлов/функций

### 💡 Желательно
1. Отсутствие документации
2. Неоптимальная структура файлов
3. Мелкие стилистические issues

---

## 🆘 Частые ошибки и решения

### Проблема: "Type error: Cannot find name 'window'"
```typescript
// ❌ Плохо
const data = window.electronAPI.getData();

// ✅ Решение: Обновить src/types.ts
declare global {
  interface Window {
    electronAPI: {
      getData: () => Promise<Data>;
    };
  }
}
```

### Проблема: "Zod validation fails but no error message"
```typescript
// ❌ Плохо
try {
  Schema.parse(data);
} catch (e) {
  throw new Error('Validation failed');
}

// ✅ Хорошо
try {
  Schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new Error(error.errors.map(e => e.message).join(', '));
  }
  throw error;
}
```

### Проблема: "IPC handler не вызывается"
1. Проверить, что backend запущен: `ensureAuthenticated` middleware?
2. Проверить channel name: `'db:get-children'` vs `'db:getChildren'`
3. Проверить preload: экспортирован ли метод?

---

## 📞 Контакты и поддержка

При возникновении архитектурных вопросов:
1. Перечитать этот документ
2. Изучить примеры в `src/services/`
3. Проверить existing tests для похожих сценариев

**Помните**: Quality > Speed. Лучше потратить +30 минут на правильную архитектуру, чем +3 дня на рефакторинг.

---

PediAssist Development Team | Last updated: 2026-01-11
