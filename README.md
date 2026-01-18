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

### 🔑 Multi-User Authentication & Role-Based Access Control

**NEW in v2.0:** Полноценная система многопользовательского доступа для клиник
- **Database-backed users**: Каждый врач имеет личную учетную запись (хранится в таблице `users`)
- **Role-based permissions**: Admin (управление пользователями) и Doctor (ведение пациентов)
- **Patient isolation**: Врачи видят только своих пациентов + расшаренных коллегами
- **Patient sharing**: Механизм передачи доступа к пациенту коллеге (read-only или с правом редактирования)
- **Session management**: Текущая сессия хранит полный User объект (ID, ФИО, роль)
- **Password security**: bcrypt hashing (10 rounds) для паролей
- **Auto-init**: Первый admin создается автоматически из `.env.local` при первом запуске

### 📝 Audit Trail
- **Winston** логирование всех критических операций
- Отдельный `audit.log` для security events (login, logout, user registration, patient CRUD, sharing)
- **User tracking**: Каждая операция записывает userId инициатора
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
│   ├── auth.cjs               # Multi-user authentication (login, register, manage users)
│   ├── init-db.cjs            # Database initialization (auto-create first admin)
│   ├── prisma-client.cjs      # Shared Prisma Client instance
│   ├── crypto.cjs             # AES-256-GCM encryption/decryption
│   ├── logger.cjs             # Winston logging & audit trail
│   ├── backup.cjs             # Automated backup service
│   ├── services/
│   │   ├── cacheService.cjs   # ⚡ Centralized caching service (TTL, namespaces)
│   │   ├── embeddingService.cjs # AI embeddings with LRU cache
│   │   └── cdssService.cjs    # Clinical Decision Support
│   ├── modules/
│   │   ├── medications/
│   │   │   ├── service.cjs    # Medication business logic
│   │   │   ├── handlers.cjs    # IPC handlers
│   │   │   ├── vidalParser.cjs # AI parser for Vidal.ru pages
│   │   │   ├── validator.cjs  # Data validation for safety
│   │   │   └── dilutionCalculator.cjs # Infusion calculator
│   │   └── ...
│   └── preload.cjs            # Secure IPC bridge

├── src/
│   ├── modules/               # Feature modules (pages + components)
│   │   ├── vaccination/       # Vaccination tracking & ATS engine
│   │   ├── patients/          # Patient management
│   │   ├── users/             # **NEW** User management (admin panel)
│   │   ├── medications/       # Medication database & dosage calculator
│   │   │   ├── MedicationFormPage.tsx
│   │   │   ├── MedicationsModule.tsx
│   │   │   ├── components/
│   │   │   │   ├── ImportPreviewModal.tsx
│   │   │   │   ├── DilutionCalculator.tsx
│   │   │   │   ├── PharmGroupFilter.tsx
│   │   │   │   └── ChangeHistoryPanel.tsx
│   │   │   └── services/
│   │   │       └── medicationService.ts
│   │   ├── dashboard/         # Analytics & overview
│   │   ├── settings/          # App settings & backups
│   │   ├── auth/              # Login page
│   │   └── printing/          # Print templates & preview
│   │
│   ├── services/              # Business logic layer
│   │   ├── patient.service.ts
│   │   ├── vaccination.service.ts
│   │   └── geminiService.ts   # AI integration (Gemini Pro 1.5)
│   │
│   ├── validators/            # Zod schemas
│   ├── context/              # React contexts (Auth, Child, DataCache)
│   ├── components/           # Shared UI components
│   └── types.ts              # TypeScript interfaces (User, AuthSession, Medication, etc.)

├── prisma/
│   ├── schema.prisma          # Database schema (User, Child, VaccinationProfile, PatientShare)
│   └── migrations/            # Prisma migration history
│   │   ├── settings/          # App configuration & security
│   │   └── auth/              # Login page
│   │
│   ├── services/              # Service Layer (Business Logic)
│   │   ├── patient.service.ts
│   │   ├── vaccination.service.ts
│   │   ├── geminiService.ts
│   │   └── logger.ts          # Centralized logging (IPC-based)
│   │
│   ├── validators/            # Zod Schemas (Client-side)
│   │   ├── child.validator.ts
│   │   ├── visit.validator.ts
│   │   ├── medication.validator.ts
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
│   ├── polio-hib-revaccination.test.cjs
│   └── vidal-parser-test.cjs  # Test Vidal parser
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
GEMINI_MODEL=gemini-1.5-pro  # или gemini-2.5-flash, gemini-3-flash

# Или используйте пул ключей для ротации (до 20 ключей через запятую)
GEMINI_API_KEYS=key1,key2,key3,...

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
npm run test:vidal    # Test Vidal parser (dry run)
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
| `npx prisma studio` | Visual database browser |
| `npx prisma migrate dev` | Create new migration |

---

## 👥 User Management Workflow

### Создание нового врача (Admin only)

1. Войдите под admin учетной записью
2. Перейдите в раздел **"Пользователи"** (доступен только админам)
3. Нажмите **"Добавить врача"**
4. Заполните форму:
   - **ФИО**: Полное имя врача
   - **Логин**: Уникальный username для входа
   - **Пароль**: Минимум 6 символов
   - **Сделать администратором**: Опционально
5. Новый врач может войти сразу после создания

### Управление доступом

**Активация/Деактивация:**
- Admin может временно деактивировать учетную запись врача
- Деактивированный пользователь не может войти в систему
- Пациенты деактивированного врача остаются доступны другим врачам через sharing

**Patient Sharing** (Coming Soon):
- Владелец пациента может поделиться доступом с коллегой
- Два режима: Read-Only или Full Edit
- Shared пациенты отображаются в списке с пометкой

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
- **Multi-user access control**: врач видит только своих пациентов
- Учет аллергий пациента для фильтрации назначений

### 👥 User Management (NEW v2.0)
- **Admin Panel**: управление пользователями клиники
- Регистрация новых врачей (только для администраторов)
- Активация/деактивация учетных записей
- Разделение доступа: каждый врач видит только своих пациентов
- **Patient Sharing**: механизм передачи доступа к пациенту коллеге
- Отображение текущего пользователя и роли в интерфейсе

### 🤖 AI Diagnostic Assistant
- ✅ Интеграция с Google Gemini Pro 1.5
- ✅ Консультации по вакцинации
- ✅ Ответы на вопросы родителей
- ✅ **Анализ жалоб и симптомов** - парсинг жалоб в структурированные симптомы
- ✅ **Дифференциальная диагностика** - ранжирование диагнозов с confidence scores
- ✅ **AI-парсинг Видаль** - автоматическое извлечение данных о препаратах
- ✅ **Структурные планы диагностики/лечения** из базы знаний заболеваний
- ✅ **GuidelinePlan API** - нормализованный план с fallback на текст рекомендаций

### ⚡ Система кеширования (Performance Optimization)
- ✅ Трехслойная архитектура кеширования (Backend → IPC → Frontend)
- ✅ Namespace-based кеширование с индивидуальными TTL для каждого типа данных
- ✅ Автоматическая инвалидация кеша при изменениях данных
- ✅ Глобальное кеширование справочников (diseases, medications, users) на frontend
- ✅ Оптимистичные обновления UI для мгновенной обратной связи
- ✅ Мониторинг производительности в Settings (hit rate, размер кеша)
- ✅ Снижение нагрузки на БД до 70%
- ✅ Ускорение загрузки данных в 20-50 раз (с 200ms до 5-10ms)

### 💊 Medication Management
- ✅ **Автоподбор препаратов по диагнозу** (по кодам МКБ-10)
- ✅ **Расчет детских дозировок** (по весу, возрасту, площади тела)
- ✅ **Импорт из Видаль** - автоматический парсинг данных о препаратах через AI
- ✅ **Расширенное дозирование** - поддержка инфузионных форм (в/в, в/м, п/к)
- ✅ **Валидация данных** - проверка безопасности AI-парсинга
- ✅ **Структурные JSON-шаблоны** - формы выпуска и дозировки связаны через `formId` для точных конвертаций
- ✅ **Конвертация mg↔ml** - расчет дозы по концентрации формы выпуска
- ✅ **Избранное и теги** - организация часто используемых препаратов
- ✅ **Поиск по группам** - фильтрация по клинико-фармакологическим группам
- ✅ **История изменений** - полный audit trail всех модификаций
- ✅ **Калькулятор разведения** - расчет параметров инфузий
- 📋 Roadmap: Проверка лекарственных взаимодействий

### 📄 Document Generation
- Медицинские сертификаты (форма 63)
- Выписки из медицинской карты
- Направления на обследование
- Perfect PDF rendering
- Встроенный PDF viewer с превью страниц, оглавлением, поиском и заметками

---

## 🗄️ Database Schema

### Core Tables (Prisma + SQLite)

#### `users` - Multi-User System
```prisma
model User {
  id            Int       @id @default(autoincrement())
  username      String    @unique
  passwordHash  String    // bcrypt hash
  fullName      String
  isAdmin       Boolean   @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  
  // Relations
  createdChildren       Child[]
  createdRecords        VaccinationRecord[]
  sharedPatientsAsOwner PatientShare[]
  sharedPatientsAccess  PatientShare[]
}
```

#### `children` - Patient Profiles
```prisma
model Child {
  id                  Int       @id
  name                String    // Encrypted
  surname             String    // Encrypted
  patronymic          String?   // Encrypted
  birthDate           String    // Encrypted
  birthWeight         Int
  gender              String
  createdByUserId     Int       // NEW: Owner tracking
  createdAt           DateTime
  
  createdBy           User      // NEW: Multi-user relationship
  shares              PatientShare[]  // NEW: Sharing mechanism
}
```

#### `patient_shares` - Collaboration System (NEW v2.0)
```prisma
model PatientShare {
  id          Int      @id
  childId     Int
  sharedBy    Int      // Owner user ID
  sharedWith  Int      // Collaborator user ID
  canEdit     Boolean  // Read-only vs Edit access
  createdAt   DateTime
}
```

**Access Control Logic:**
- Врач видит: `WHERE createdByUserId = currentUser.id OR childId IN (SELECT childId FROM patient_shares WHERE sharedWith = currentUser.id)`
- Admin видит: `WHERE 1=1` (все пациенты)

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
