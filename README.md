# PediAssist - AI-Powered Pediatric Assistant

**Medical-Grade** Desktop приложение - интеллектуальный ассистент педиатра для комплексного ведения детских амбулаторных приемов.

**Возможности системы:**
- 📅 Интеллектуальный расчет графиков вакцинации (Приказ 1122н РФ)
- 🏥 Электронная медицинская карта и история осмотров
- 🤖 AI-помощник для диагностики на основе жалоб
- 💊 Автоподбор препаратов и расчет детских дозировок
- 📄 Генерация медицинских сертификатов и выписок
- 🛡️ Enterprise-level security (152-ФЗ compliance)

---

## 🛡️ Security & Compliance (152-ФЗ)

PediAssist реализует медицинские стандарты защиты персональных данных:

### 🔐 Field-Level Encryption
- **AES-256-GCM** шифрование всех ПДн (ФИО, даты рождения, медицинские заметки)
- **PBKDF2** key derivation (100,000 iterations) для защиты от атак перебора
- Данные нечитаемы даже при прямом доступе к файлу БД

### 🔑 Authentication & Session Management
- Централизованная система авторизации врача
- Все IPC-вызовы защищены middleware `ensureAuthenticated`
- Поддержка **bcrypt** хешей для паролей

### 📝 Audit Trail
- **Winston** логирование всех критических операций
- Отдельный `audit.log` для security events (login, CRUD, export, backup)
- Timestamp + user context для каждой операции

### 💾 Automated Disaster Recovery
- Ежедневные автоматические бэкапы при старте приложения
- Ручной backup trigger в настройках
- Rotation policy: хранение 10 последних версий БД

---

## 🏗️ Архитектурные принципы

### Clean Architecture - Service Layer Pattern

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Components (View)  │  Pages  │  Modules         │  │
│  └─────────────┬────────────────────────────────────┘  │
│                ▼                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Service Layer (Business Logic + Validation)     │  │
│  │  • patient.service.ts                            │  │
│  │  • vaccination.service.ts                        │  │
│  │  • Zod Validation @ Client                       │  │
│  └─────────────┬────────────────────────────────────┘  │
└────────────────┼─────────────────────────────────────────┘
                 │ IPC (Electron)
┌────────────────▼─────────────────────────────────────────┐
│                  Backend (Electron Main)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  IPC Handlers (database.cjs)                     │  │
│  │  • Authentication Middleware                     │  │
│  │  • Zod Validation @ Backend                      │  │
│  │  • Field Encryption/Decryption                   │  │
│  └─────────────┬────────────────────────────────────┘  │
│                ▼                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Database (Prisma + SQLite)                      │  │
│  │  • Encrypted PII Storage                         │  │
│  │  • Auto-schema initialization                    │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Двойная валидация (Defense in Depth)
1. **Frontend Service Layer**: Zod валидация перед IPC вызовом
2. **Backend IPC Handlers**: Повторная Zod валидация перед БД операцией

---

## 📁 Структура проекта

```
pediatrics/
├── electron/                   # Backend (Main Process)
│   ├── main.cjs               # Lifecycle, Window management
│   ├── database.cjs           # IPC handlers, Zod validation, encryption
│   ├── auth.cjs               # Authentication service
│   ├── crypto.cjs             # AES-256-GCM encryption/decryption
│   ├── logger.cjs             # Winston logging & audit trail
│   ├── backup.cjs             # Automated backup service
│   └── preload.cjs            # Secure IPC bridge
│
├── src/
│   ├── modules/               # Feature modules (pages + components)
│   │   ├── vaccination/       # Vaccination tracking & ATS engine
│   │   ├── patients/          # Patient management
│   │   ├── dashboard/         # Analytics & overview
│   │   ├── settings/          # App configuration & security
│   │   └── auth/              # Login page
│   │
│   ├── services/              # Service Layer (Business Logic)
│   │   ├── patient.service.ts
│   │   ├── vaccination.service.ts
│   │   └── geminiService.ts
│   │
│   ├── validators/            # Zod Schemas (Client-side)
│   │   ├── child.validator.ts
│   │   ├── vaccination.validator.ts
│   │   └── record.validator.ts
│   │
│   ├── context/               # React Context (Auth, Child)
│   │   ├── AuthContext.tsx
│   │   └── ChildContext.tsx
│   │
│   ├── logic/vax/             # Medical Logic (Pure Functions)
│   │   ├── index.ts           # Main calculation engine
│   │   ├── rules.ts           # Rule types & context
│   │   ├── bcg.ts, dtp.ts,... # Vaccine-specific rules
│   │   └── vax.test.ts        # Unit Tests
│   │
│   ├── components/            # Reusable UI components
│   ├── constants.ts           # Vaccine schedule (RF Order 1122n)
│   └── types.ts               # TypeScript interfaces
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── dev.db                 # Development database
│
├── tests/                     # Integration tests
│   ├── vaccination-records.test.cjs
│   └── polio-hib-revaccination.test.cjs
│
└── vitest.config.ts           # Unit test configuration
```

---

## 🚀 Быстрый старт

### 1. Установка
```bash
npm install
```

### 2. Конфигурация безопасности
Создайте `.env.local` на основе `.env.example`:

```env
# Google Gemini API (для AI ассистента)
VITE_GEMINI_API_KEY=your_api_key_here

# КРИТИЧНО: Генерируйте уникальный ключ для каждой инсталляции
DB_ENCRYPTION_KEY=your_random_32+_char_string

# Авторизация врача (рекомендуется использовать bcrypt hash)
ADMIN_LOGIN=admin
ADMIN_PASSWORD=$2a$10$YourBcryptHashHere
# или plain text для первого запуска: ADMIN_PASSWORD=your_secure_password
```

**Генерация bcrypt hash (Node.js)**:
```bash
node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"
```

### 3. Запуск
```bash
npm run dev           # Development mode
npm run electron:dev  # Electron + Vite dev server
```

### 4. Тестирование
```bash
npm test              # Run all unit tests
npm run test:ui       # Interactive test UI
npm run test:vaccination  # Integration tests
```

---

## 🛠️ Технологический стек

### Core
- **React 18** + **TypeScript** + **Vite**
- **Electron** (Main/Renderer isolation)
- **Tailwind CSS** + Vanilla CSS (для печати)

### Data & Security
- **Prisma** + **better-sqlite3** (ORM + Database)
- **Zod** (Schema validation)
- **Winston** (Logging & Audit)
- **bcryptjs** (Password hashing)
- **crypto (Node.js)** (AES-256-GCM encryption)

### Testing
- **Vitest** (Unit testing)
- **Manual E2E** (Integration tests in `/tests`)

### AI
- **Google Gemini Pro 1.5** (Medical consultation assistant)

---

## 📋 Основные команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run electron:dev` | Full Electron app with hot-reload |
| `npm run build` | Build production bundle |
| `npm run electron:build` | Package app for distribution |
| `npm test` | Run unit tests |
| `npm run test:ui` | Interactive test dashboard |

---

## 🎯 Функциональные модули

### 📅 Vaccination Module (ATS Engine)
- Автоматический расчет графиков вакцинации по Приказу 1122н
- Учет факторов риска и противопоказаний
- Поддержка combined вакцин (Пентаксим, Инфанрикс Гекса)
- Догоняющая иммунизация (catch-up schedules)

### 🏥 Patient Management
- Электронная медицинская карта
- Антропометрические данные
- История осмотров и диагнозов
- Field-level encryption для ПДн

### 🤖 AI Diagnostic Assistant (Roadmap)
- Анализ жалоб и симптомов
- Дифференциальная диагностика
- Рекомендации по обследованию
- Интеграция с базой знаний

### 💊 Medication Management (Roadmap)
- Автоподбор препаратов по диагнозу
- Расчет детских дозировок (по весу/возрасту)
- Проверка лекарственных взаимодействий
- Формуляр препаратов РФ

### 📄 Document Generation
- Медицинские сертификаты (форма 63)
- Выписки из медицинской карты
- Направления на обследование
- Perfect PDF rendering

---

## 🔬 Quality Assurance

### Обязательные тесты
1. **Unit тесты** (`src/logic/vax/*.test.ts`): Vaccination calculation engine
2. **Integration тесты** (`tests/*.test.cjs`): E2E medical scenarios

### Coverage Requirements
- **Core Medical Logic**: 80%+ coverage
- **Service Layer**: Critical paths tested
- **IPC Handlers**: Authentication & validation tested

---

## 📦 Production Build

При упаковке приложения через `electron-builder` реализованы:

1. **Prisma в Electron**: Динамическая установка путей к бинарным движкам
2. **Относительные пути**: `base: './'` для работы через `file://`
3. **Hash Routing**: `createHashRouter` для совместимости с файловой системой
4. **Авто-инициализация БД**: Создание схемы при первом запуске
5. **PDF Perfect Rendering**: Идентичность экранного и печатного отображения

---

## 🔐 Security Best Practices

1. **Никогда не коммитьте** `.env.local` в Git
2. **Генерируйте уникальный** `DB_ENCRYPTION_KEY` для каждой инсталляции
3. **Используйте bcrypt hashes** для ADMIN_PASSWORD в production
4. **Регулярно проверяйте** `audit.log` на подозрительную активность
5. **Делайте ручные бэкапы** перед критическими операциями

---

## 📚 Документация

- [CORE_CONCEPTS.md](./CORE_CONCEPTS.md) - Техническая реализация фич
- [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) - Правила архитектуры и code style
- [AI_CODING_GUIDELINES.md](./AI_CODING_GUIDELINES.md) - Краткая выжимка для AI агентов
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Стратегия и примеры тестов

---

## 🤝 Участие в разработке

См. [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) для ознакомления с:
- Архитектурными принципами
- Service Layer pattern
- Двойной валидацией
- Обязательными тестами
- Code review checklist

---

## 🎖️ Roadmap

### Phase 1 - Completed ✅
- ✅ Security infrastructure (AES-256, bcrypt, audit trail)
- ✅ Service Layer architecture
- ✅ Vaccination calculation engine (ATS)
- ✅ Automated backups
- ✅ Unit test framework

### Phase 2 - In Progress 🚧
- 🔄 Patient visit history & examinations
- 🔄 AI diagnostic assistant integration
- 🔄 Medication database & dosage calculator
- 🔄 Enhanced document templates

### Phase 3 - Planned 📋
- 📋 Multi-user support (clinic mode)
- 📋 Cloud sync (optional)
- 📋 Mobile companion app
- 📋 Analytics dashboard for clinic statistics

---

**PediAssist** - AI-powered pediatric assistant for modern medical practice.

License: Proprietary | Version: 2.0.0 (Medical-Grade Security)
