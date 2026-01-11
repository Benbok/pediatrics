# TESTING GUIDE - PediAssist

**Комплексная стратегия тестирования медицинского ПО**

---

## 🎯 Философия тестирования

В медицинском ПО тестирование - это не опция, а **обязательное требование**:

1. **Медицинская логика** должна быть протестирована на 80%+
2. **Критические пути** (создание пациента, запись вакцинации) - 100%
3. **Regression** тесты для каждого обнаруженного бага

---

## 🏗️ Пирамида тестирования

```
        /\
       /  \        E2E Tests (Integration)
      /____\            ~10%
     /      \       
    / Unit   \      Component Tests
   /  Tests   \          ~20%
  /____________\    
 /   Medical    \   Medical Logic Tests
/______________\        ~70%
```

### Распределение усилий:
- **70%**: Unit тесты медицинской логики (`src/logic/vax/`)
- **20%**: Component/Service тесты
- **10%**: E2E Integration тесты

---

## 🧪 Типы тестов

### 1. Unit Tests - Медицинская логика (КРИТИЧНО!)

**Что тестируем**: Чистые функции расчета графиков вакцинации

**Где**: `src/logic/vax/*.test.ts`

**Coverage**: **80%+**

#### Пример: Базовый тест статуса

```typescript
// src/logic/vax/vax.test.ts

import { describe, it, expect } from 'vitest';
import { calculateVaccineSchedule } from './index';
import { VaccineStatus } from '../../types';

describe('calculateVaccineSchedule', () => {
  const newborn: ChildProfile = {
    name: 'Иван',
    surname: 'Иванов',
    birthDate: new Date().toISOString().split('T')[0], // Сегодня
    birthWeight: 3500,
    gender: 'male',
  };

  const emptyProfile: VaccinationProfile = {
    childId: 1,
    hepBRiskFactors: [],
    customVaccines: [],
  };

  it('should mark BCG as DUE_NOW for newborn', () => {
    const schedule = calculateVaccineSchedule(
      newborn, 
      emptyProfile, 
      [], 
      VACCINE_SCHEDULE
    );
    
    const bcg = schedule.find(v => v.id === 'bcg-1');
    
    expect(bcg).toBeDefined();
    expect(bcg?.status).toBe(VaccineStatus.DUE_NOW);
  });
});
```

#### Пример: Тест факторов риска

```typescript
it('should apply Hepatitis B risk group schedule (4 doses)', () => {
  const riskProfile: VaccinationProfile = {
    ...emptyProfile,
    hepBRiskFactors: [HepBRiskFactor.MOTHER_HBSAG],
  };

  const schedule = calculateVaccineSchedule(
    newborn,
    riskProfile,
    [],
    VACCINE_SCHEDULE
  );

  const hepBVaccines = schedule.filter(v => v.id.startsWith('hepb'));
  
  // Стандартная схема: 3 дозы (0-1-6 мес)
  // Схема риска: 4 дозы (0-1-2-12 мес)
  expect(hepBVaccines).toHaveLength(4);
  expect(hepBVaccines.map(v => v.id)).toContain('hepb-risk-3');
});
```

#### Пример: Тест combined вакцины (Пентаксим)

```typescript
it('should mark Polio-1 and Hib-1 as completed when DTP-1 done with Pentaxim', () => {
  const threeMonthOld = {
    ...newborn,
    birthDate: '2023-10-01', // 3 месяца назад
  };

  const records: UserVaccineRecord[] = [{
    vaccineId: 'dtp-1',
    isCompleted: true,
    completedDate: '2024-01-05',
    vaccineBrand: 'Пентаксим',
  }];

  const schedule = calculateVaccineSchedule(
    threeMonthOld,
    emptyProfile,
    records,
    VACCINE_SCHEDULE
  );

  const polio1 = schedule.find(v => v.id === 'polio-1');
  const hib1 = schedule.find(v => v.id === 'hib-1');

  // Пентаксим = АКДС + Полио (ИПВ) + Hib
  expect(polio1?.status).toBe(VaccineStatus.COMPLETED);
  expect(polio1?.userRecord?.notes).toContain('В составе Пентаксим');
  
  expect(hib1?.status).toBe(VaccineStatus.COMPLETED);
});
```

#### Пример: Тест статусов просроченных

```typescript
it('should mark vaccine as OVERDUE if > 1 month past due', () => {
  const fourYearOld = {
    ...newborn,
    birthDate: '2020-01-01',
  };

  const schedule = calculateVaccineSchedule(
    fourYearOld,
    emptyProfile,
    [],
    VACCINE_SCHEDULE
  );

  const bcg = schedule.find(v => v.id === 'bcg-1');
  
  // BCG должен был быть сделан в роддоме (0 мес)
  // Ребенку 4 года → сильно просрочен
  expect(bcg?.status).toBe(VaccineStatus.OVERDUE);
});
```

---

### 2. Service Layer Tests

**Что тестируем**: Валидация, бизнес-логика, IPC communication

**Где**: `src/services/*.test.ts`

**Coverage**: Critical paths tested

#### Пример: Валидация в сервисе

```typescript
// src/services/patient.service.test.ts

import { describe, it, expect } from 'vitest';
import { patientService } from './patient.service';

describe('patientService', () => {
  describe('createChild', () => {
    it('should reject invalid name (too short)', async () => {
      const invalidData = {
        name: 'A', // Минимум 2 символа
        surname: 'Иванов',
        birthDate: '2023-01-01',
        birthWeight: 3500,
        gender: 'male',
      };

      await expect(
        patientService.createChild(invalidData)
      ).rejects.toThrow('Имя должно содержать минимум 2 символа');
    });

    it('should reject non-Cyrillic characters in name', async () => {
      const invalidData = {
        name: 'John123',
        surname: 'Иванов',
        birthDate: '2023-01-01',
        birthWeight: 3500,
        gender: 'male',
      };

      await expect(
        patientService.createChild(invalidData)
      ).rejects.toThrow('только кириллицу');
    });

    it('should reject future birth date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const invalidData = {
        name: 'Иван',
        surname: 'Иванов',
        birthDate: tomorrow.toISOString().split('T')[0],
        birthWeight: 3500,
        gender: 'male',
      };

      await expect(
        patientService.createChild(invalidData)
      ).rejects.toThrow('не может быть в будущем');
    });
  });

  describe('getFullName', () => {
    it('should format full name correctly', () => {
      const child = {
        name: 'Иван',
        surname: 'Иванов',
        patronymic: 'Петрович',
      };

      expect(patientService.getFullName(child)).toBe('Иванов Иван Петрович');
    });

    it('should handle missing patronymic', () => {
      const child = {
        name: 'Иван',
        surname: 'Иванов',
        patronymic: null,
      };

      expect(patientService.getFullName(child)).toBe('Иванов Иван');
    });
  });
});
```

---

### 3. Integration Tests (E2E)

**Что тестируем**: Полные медицинские сценарии с БД

**Где**: `tests/*.test.cjs`

**Coverage**: Critical user flows

#### Пример: End-to-End сценарий вакцинации

```javascript
// tests/vaccination-full-flow.test.cjs

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Full Vaccination Flow', () => {
  let childId;

  beforeAll(async () => {
    // Очистка тестовой БД
    await prisma.vaccinationRecord.deleteMany({});
    await prisma.vaccinationProfile.deleteMany({});
    await prisma.child.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create patient and vaccination profile', async () => {
    const child = await prisma.child.create({
      data: {
        name: 'Иван',
        surname: 'Тестов',
        birthDate: '2023-12-01',
        birthWeight: 3500,
        gender: 'male',
        vaccinationProfile: {
          create: {
            hepBRiskFactors: JSON.stringify([]),
            pneumoRiskFactors: JSON.stringify([]),
            pertussisContraindications: JSON.stringify([]),
          },
        },
      },
      include: {
        vaccinationProfile: true,
      },
    });

    childId = child.id;

    expect(child.id).toBeDefined();
    expect(child.vaccinationProfile).toBeDefined();
  });

  it('should save vaccination record (BCG)', async () => {
    const record = await prisma.vaccinationRecord.create({
      data: {
        childId: childId,
        vaccineId: 'bcg-1',
        isCompleted: true,
        completedDate: '2023-12-03',
        vaccineBrand: 'БЦЖ-М',
        notes: 'Вакцинация в роддоме',
      },
    });

    expect(record.id).toBeDefined();
    expect(record.isCompleted).toBe(true);
  });

  it('should retrieve all records for child', async () => {
    const records = await prisma.vaccinationRecord.findMany({
      where: { childId: childId },
    });

    expect(records).toHaveLength(1);
    expect(records[0].vaccineId).toBe('bcg-1');
  });

  it('should delete child cascade (orphan protection)', async () => {
    await prisma.child.delete({ where: { id: childId } });

    // Проверяем, что связанные записи удалены
    const orphanedRecords = await prisma.vaccinationRecord.findMany({
      where: { childId: childId },
    });

    const orphanedProfile = await prisma.vaccinationProfile.findUnique({
      where: { childId: childId },
    });

    expect(orphanedRecords).toHaveLength(0);
    expect(orphanedProfile).toBeNull();
  });
});
```

---

## ⚙️ Настройка тестовой среды

### Vitest Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/logic/**', 'src/services/**'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        lines: 80,      // 80% покрытие строк
        functions: 80,  // 80% покрытие функций
        branches: 70,   // 70% покрытие ветвлений
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:integration": "node tests/vaccination-records.test.cjs"
  }
}
```

---

## 🎯 Обязательные тесты для каждой фичи

### При добавлении новой вакцины в график:

1. ✅ **Unit тест**: Проверка расчета due date
2. ✅ **Unit тест**: Проверка статуса (PLANNED → DUE_NOW → COMPLETED)
3. ✅ **Unit тест**: Проверка факторов риска (если есть)
4. ✅ **Integration тест**: Создание записи в БД

### При добавлении нового фактора риска:

1. ✅ **Unit тест**: Проверка фильтрации вакцин
2. ✅ **Unit тест**: Проверка изменения графика (дозы, сроки)
3. ✅ **Service тест**: Валидация enum значений

### При изменении медицинской логики:

1. ✅ **Regression тест**: Все существующие тесты должны пройти
2. ✅ **New test**: Для нового edge case

---

## 📊 Coverage Goals

| Модуль | Минимальный Coverage | Цель |
|--------|---------------------|------|
| `src/logic/vax/` | **80%** | 90%+ |
| `src/services/` | 60% | 80% |
| `src/validators/` | 70% | 90% |
| `electron/database.cjs` | 40% | 60% |

### Проверка coverage:

```bash
npm run test:coverage
```

Результат в `coverage/index.html`

---

## 🚀 CI/CD Integration

### Pre-commit Hook

```bash
# .husky/pre-commit

#!/bin/sh
npm test -- --run  # Запустить все тесты

# Если тесты упали - коммит запрещен
```

### GitHub Actions (пример)

```yaml
# .github/workflows/test.yml

name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --run
      - run: npm run test:coverage
```

---

## 🐛 TDD Workflow (Test-Driven Development)

### Рекомендуемый порядок для критической логики:

1. **Написать failing test** (RED)
```typescript
it('should handle Rotavirus contraindication', () => {
  const profile = { rotaContraindications: ['SEVERE_ALLERGY'] };
  const schedule = calculateVaccineSchedule(child, profile, [], VACCINE_SCHEDULE);
  
  const rota = schedule.find(v => v.id === 'rota-1');
  expect(rota?.status).toBe(VaccineStatus.CONTRAINDICATED);
});
```

2. **Implement minimal code** (GREEN)
```typescript
// logic/vax/rotavirus.ts
export const rotaRules: VaxRule = (vaccine, context) => {
  if (!vaccine.id.startsWith('rota')) return undefined;
  
  if (context.profile.rotaContraindications?.length > 0) {
    return { status: VaccineStatus.CONTRAINDICATED };
  }
};
```

3. **Refactor** (CLEAN)
```typescript
// Optimize, add comments, improve readability
```

---

## 📝 Best Practices

### ✅ DO:
- **Test behavior, not implementation**
- **Use descriptive test names**: `it('should mark BCG as OVERDUE if child is 3 years old')`
- **Arrange-Act-Assert pattern**:
  ```typescript
  it('should...', () => {
    // Arrange
    const data = setupTestData();
    
    // Act
    const result = functionUnderTest(data);
    
    // Assert
    expect(result).toBe(expected);
  });
  ```
- **Mock external dependencies** (кроме БД в integration тестах)
- **Test edge cases**: null, undefined, empty arrays, extreme values

### ❌ DON'T:
- **Test implementation details** (private methods, internal state)
- **Rely on test execution order** (каждый тест должен быть независим)
- **Use real production data** в тестах
- **Skip failing tests** (`it.skip`) надолго

---

## 🔍 Debugging Tests

### Запуск одного теста:

```bash
npm test -- vax.test.ts
```

### Debug mode в VS Code:

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal"
}
```

### Включить verbose logging:

```typescript
it('should...', () => {
  console.log('Input:', input); // Temporary debug
  const result = calculate(input);
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

---

## 📚 Дополнительные ресурсы

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Martin Fowler - Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

PediAssist Testing Team | Last updated: 2026-01-11
