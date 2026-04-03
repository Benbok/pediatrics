# PediAssist - AI-Powered Pediatric Assistant

Desktop-приложение для педиатров: ведение пациентов, приемов, вакцинации, питания и клинической поддержки принятия решений (CDSS) в едином рабочем месте.

## Ключевые возможности

- Электронная карта пациента и история приемов
- Модуль вакцинации с расчетом графиков по Приказу 1122н
- CDSS и AI-поиск по базе заболеваний с ранжированием рекомендаций
- Автосохранение и восстановление черновиков приема (включая результаты AI-анализа)
- Модуль препаратов: база, импорт, дозировки, история изменений
- Модуль питания: расчет потребностей 0-12 мес, прикорм, рационы 1-3 года, шаблоны и история
- Генерация печатных форм и сертификатов
- Многопользовательская работа (admin/doctor), аудит действий, резервные копии
- Лицензирование приложения с экраном активации

---

## Security и соответствие требованиям

PediAssist реализует медицинский подход к защите данных и контролю доступа:

- Field-level encryption критичных персональных данных (AES-256-GCM)
- Хеширование паролей через bcrypt
- Двойная валидация данных: frontend + backend (Zod)
- RBAC: роли admin/doctor, проверка прав на IPC уровне
- Audit trail через Winston (логирование security и CRUD-событий)
- Автоматические и ручные бэкапы БД

---

## Архитектура

Приложение построено как Electron + React с разделением слоев:

1. UI слой (React-модули, страницы, компоненты)
2. Service слой (бизнес-логика frontend, валидация, кеш)
3. IPC handlers в Electron Main (авторизация, валидация, orchestration)
4. Prisma + SQLite (персистентность)

Основные принципы:

- Разделение ответственности между UI и бизнес-логикой
- Defense in depth: повторная серверная валидация
- Явная авторизация и контекст текущего пользователя
- Централизованное логирование и наблюдаемость

---

## Текущая структура проекта

- electron: main process, IPC, auth, backup, license, модули доменов
- src: React-приложение, feature-модули, сервисы, контексты
- prisma: схема данных и миграции
- tests: unit/integration/live сценарии
- docs: архитектурные и продуктовые гайды

Feature-модули frontend:

- auth
- dashboard
- diseases
- icd-codes
- license
- medications
- nutrition
- patients
- printing
- settings
- users
- vaccination
- visits

---

## Быстрый старт

### 1) Установка зависимостей

npm install

### 2) Конфигурация окружения

Скопируйте .env.example в .env.local и заполните значения.

Минимально необходимое:

- VITE_GEMINI_API_KEY для AI-функций (или пул ключей GEMINI_API_KEYS)
- DB_ENCRYPTION_KEY (уникальный для каждой инсталляции)
- ADMIN_LOGIN
- ADMIN_PASSWORD

Опционально:

- GEMINI_MODEL (по умолчанию используется gemini-2.5-flash)
- GEMINI_BASE_URL (если используется прокси/совместимый шлюз)

### 3) Запуск

- npm run dev: frontend (Vite)
- npm run electron:dev: полный desktop-режим (Electron + Vite)

### 4) Тесты

- npm test
- npm run test:ui
- npm run test:vaccination
- npm run test:revaccination
- npm run test:vidal
- npm run test:cdss-cli

Примечание по CDSS CLI:
Скрипт проверяет тот же пайплайн, что и модуль Приемы: разбор жалоб, нормализация, поиск, ранжирование. Поддержан fallback-режим без AI-нормализации.

---

## Технологический стек (актуально)

Core:

- React 18
- TypeScript 5
- Vite 6
- Electron 39

Data и backend:

- Prisma 7
- SQLite / better-sqlite3
- Zod
- Winston
- bcryptjs

AI:

- Google GenAI SDK (@google/genai)
- Поддержка single key и key pool (GEMINI_API_KEYS)

UI:

- Tailwind CSS 4
- Radix UI (tabs)
- lucide-react

Testing:

- Vitest

---

## Основные команды

| Команда | Назначение |
|---|---|
| npm run dev | Запуск frontend dev-сервера |
| npm run electron:dev | Запуск Electron + frontend |
| npm run build | Production build frontend |
| npm run electron:build | Сборка desktop-дистрибутива |
| npm test | Unit тесты |
| npm run test:ui | UI для Vitest |
| npm run test:vaccination | Интеграционный сценарий по вакцинации |
| npm run test:revaccination | Ревакцинация (polio/hib) |
| npm run test:vidal | Проверка парсинга Vidal |
| npm run test:cdss-cli | CLI тест CDSS пайплайна |

---

## Многопользовательская работа

Поддерживается полноценная авторизация и администрирование пользователей:

- Создание врачей администратором
- Активация и деактивация учетных записей
- Разграничение прав admin/doctor
- Хранение пользовательского контекста в сессии

Patient sharing присутствует на уровне модели данных и backend-операций; UX-поток совместного доступа может развиваться отдельно.

---

## База данных (Prisma, кратко)

Ключевые сущности:

- User, Role, UserRole
- Child, VaccinationProfile, VaccinationRecord
- PatientShare
- Disease, ClinicalGuideline, GuidelineChunk, DiseaseNote
- Medication, MedicationChangeLog
- Visit, VisitTemplate
- InformedConsent
- Nutrition* сущности (нормы, продукты, шаблоны, планы)

Важно: модель User хранит отдельные поля ФИО (lastName/firstName/middleName), а роли нормализованы через связку UserRole.

---

## Кеширование и производительность

Используется многоуровневая стратегия кеширования:

- Backend cache service с namespace/TTL
- Инвалидация по событиям изменения данных
- Frontend data cache для справочников и списков
- Метрики пула API-ключей и диагностические статусы в Settings

---

## Лицензирование

Перед входом в систему выполняется проверка лицензии.
При отсутствии валидной лицензии открывается экран активации с импортом файла лицензии.

---

## Документация модулей

- Patients: ./src/modules/patients/README.md
- Users: ./src/modules/users/README.md
- Diseases: ./src/modules/diseases/README.md
- Medications: ./src/modules/medications/README.md
- Nutrition: ./src/modules/nutrition/README.md
- Printing: ./src/modules/printing/README.md
- ICD Codes: ./src/modules/icd-codes/README.md
- Visits: ./src/modules/visits/README.md

---

## Дополнительная документация

- ./CORE_CONCEPTS.md
- ./DEVELOPMENT_RULES.md
- ./AI_CODING_GUIDELINES.md
- ./TESTING_GUIDE.md
- ./docs/CDSS_GUIDE.md

---

## Production notes

- Используется hash routing для работы через file://
- Electron build включает Prisma engines и native зависимости
- Инициализация БД и seed выполняются при первом запуске

---

## Security best practices

1. Не коммитьте .env.local
2. Используйте уникальный DB_ENCRYPTION_KEY на каждую инсталляцию
3. Для production применяйте bcrypt hash в ADMIN_PASSWORD
4. Регулярно проверяйте audit логи
5. Делайте ручной backup перед критическими изменениями

---

PediAssist

License: Proprietary
Version: 2.0.0
