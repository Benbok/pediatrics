# Модуль Users (Управление пользователями)

## 📋 Общее описание

Модуль `users` отвечает за управление пользователями (врачами) в педиатрической системе. Модуль предоставляет административный интерфейс для регистрации новых врачей, активации/деактивации учетных записей, просмотра списка всех пользователей. Модуль интегрирован с системой аутентификации и обеспечивает контроль доступа на основе ролей (администратор/врач).

## 🏗️ Архитектура

Модуль следует архитектурным принципам согласно `AI_CODING_GUIDELINES.md`:

```
┌─────────────────────────────────────────────────────────┐
│  Component Layer (*.tsx)                                │
│  - UI только, NO business logic                          │
│  - Обработка пользовательского ввода                    │
│  - Отображение данных                                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  IPC Handler Layer (electron/auth.cjs)                  │
│  - ensureAuthenticated middleware                        │
│  - ensureAdmin middleware (для админских операций)       │
│  - Zod валидация (безопасность)                         │
│  - Простые DB операции через Prisma                      │
│  - Хеширование паролей (bcrypt)                          │
│  - Audit logging                                         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  Database Layer (Prisma)                                 │
│  - Хранение данных пользователей                        │
│  - Связи с другими сущностями (Child, Visit, etc.)       │
│  - Миграции                                              │
└─────────────────────────────────────────────────────────┘
```

### Принципы архитектуры

1. **Разделение ответственности**: Компонент отвечает только за UI, бизнес-логика в IPC handlers
2. **Валидация**: Zod валидация на backend (безопасность)
3. **Централизованное логирование**: Все ошибки через `logger` (исправлено согласно принципам)
4. **Аутентификация**: Все IPC handlers защищены `ensureAuthenticated`
5. **Контроль доступа**: Административные операции защищены `ensureAdmin`
6. **Audit Trail**: Все операции логируются через `logAudit`
7. **Безопасность паролей**: Хеширование через bcrypt (10 rounds)

### Особенности модуля

- **Административный доступ**: Только администраторы могут управлять пользователями
- **Прямые IPC вызовы**: Компонент использует `window.electronAPI` напрямую (нет отдельного сервисного слоя)
- **Интеграция с Auth**: Тесно интегрирован с системой аутентификации (`electron/auth.cjs`)
- **Защита от самоудаления**: Администратор не может деактивировать свою собственную учетную запись

## 📁 Структура файлов

```
src/modules/users/
├── README.md                          # Этот файл
└── UserManagementModule.tsx           # Главный компонент управления пользователями

electron/auth.cjs                       # IPC handlers для управления пользователями
├── auth:register-user                 # Регистрация нового пользователя
├── auth:get-all-users                 # Получение списка всех пользователей
├── auth:activate-user                 # Активация пользователя
├── auth:deactivate-user               # Деактивация пользователя
└── auth:change-password                # Смена пароля
```

## 🎯 Основной функционал

### 1. Управление пользователями

#### Регистрация нового врача
- **Доступ**: Только для администраторов
- **Поля формы**:
  - ФИО (обязательное, 2-100 символов)
  - Логин (обязательное, минимум 3 символа, уникальный)
  - Пароль (обязательное, минимум 6 символов)
  - Чекбокс "Сделать администратором"
- **Валидация**: 
  - Frontend: HTML5 валидация (required, minLength)
  - Backend: Zod валидация (`UserRegistrationSchema`)
- **Безопасность**: Пароль хешируется через bcrypt перед сохранением
- **Результат**: Создание нового пользователя с `isActive: true` по умолчанию

#### Просмотр списка пользователей
- **Доступ**: Только для администраторов
- **Отображаемая информация**:
  - ФИО пользователя
  - Логин
  - Роль (Администратор / Врач)
  - Статус (Активен / Деактивирован)
  - Дата создания
- **Сортировка**: По дате создания (ascending)
- **Статистика**: Отображение общего количества зарегистрированных врачей

#### Активация/деактивация пользователей
- **Доступ**: Только для администраторов
- **Функционал**:
  - Активация деактивированного пользователя
  - Деактивация активного пользователя
  - Защита от самоудаления (администратор не может деактивировать себя)
- **Эффект**: Деактивированные пользователи не могут войти в систему
- **Audit**: Все операции логируются с указанием исполнителя

### 2. Структура данных пользователя

#### Модель User (Prisma)
```prisma
model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String
  fullName     String
  isAdmin      Boolean  @default(false)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  
  // Relations
  createdChildren       Child[]
  createdRecords        VaccinationRecord[]
  sharedPatientsAsOwner PatientShare[]
  sharedPatientsAccess  PatientShare[]
  visits                Visit[]
  notes                 DiseaseNote[]
  medicationChanges     MedicationChangeLog[]
  pdfNotes              PdfNote[]
  informedConsents      InformedConsent[]
  visitTemplates        VisitTemplate[]
  medicationTemplates   MedicationTemplate[]
  examTextTemplates     ExamTextTemplate[]
}
```

#### TypeScript интерфейс
```typescript
export interface User {
  id: number;
  username: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt?: string;
}
```

**Примечание**: Пароль (`passwordHash`) никогда не возвращается на frontend для безопасности.

### 3. Валидация

Модуль использует **валидацию на backend** через Zod:

#### UserRegistrationSchema
```typescript
{
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  fullName: z.string().min(2).max(100),
  isAdmin: z.boolean().default(false)
}
```

**Правила валидации**:
- `username`: Минимум 3 символа, максимум 50, должен быть уникальным
- `password`: Минимум 6 символов
- `fullName`: Минимум 2 символа, максимум 100
- `isAdmin`: Boolean, по умолчанию `false`

**Frontend валидация**: HTML5 атрибуты (`required`, `minLength`) для быстрой обратной связи.

### 4. Безопасность

#### Хеширование паролей
- **Алгоритм**: bcrypt
- **Rounds**: 10 (баланс между безопасностью и производительностью)
- **Хранение**: Только хеш сохраняется в базе данных, пароль никогда не хранится в открытом виде

#### Контроль доступа
- **ensureAuthenticated**: Все IPC handlers требуют аутентификации
- **ensureAdmin**: Административные операции (регистрация, активация/деактивация) доступны только администраторам
- **Защита от самоудаления**: Администратор не может деактивировать свою учетную запись

#### Audit Logging
Все операции логируются через `logAudit`:
- `USER_REGISTERED`: Регистрация нового пользователя
- `USER_ACTIVATED`: Активация пользователя
- `USER_DEACTIVATED`: Деактивация пользователя
- `PASSWORD_CHANGED`: Смена пароля

Каждая запись содержит:
- Тип операции
- ID пользователя
- ID исполнителя (кто выполнил операцию)
- Timestamp (автоматически)

### 5. Интеграция с системой аутентификации

Модуль тесно интегрирован с системой аутентификации:

#### Сессия пользователя
- Текущий пользователь хранится в `currentSession` (in-memory для desktop app)
- Сессия содержит полный объект `User` после успешного входа
- Сессия используется для проверки прав доступа

#### Middleware
- `ensureAuthenticated`: Проверяет наличие активной сессии
- `ensureAdmin`: Проверяет, что текущий пользователь является администратором
- `getSession()`: Получает текущую сессию для использования в handlers

## 🔧 Компоненты

### `UserManagementModule.tsx`

Главный компонент управления пользователями:

#### Функционал
- **Отображение списка**: Таблица всех пользователей с информацией
- **Регистрация**: Модальное окно для регистрации нового врача
- **Активация/деактивация**: Переключение статуса пользователя
- **Статистика**: Отображение общего количества врачей

#### Состояние компонента
```typescript
const [users, setUsers] = useState<User[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
```

#### Основные методы
- `loadUsers()`: Загрузка списка всех пользователей
- `handleRegisterUser()`: Обработка регистрации нового пользователя
- `handleToggleActive()`: Переключение статуса активности пользователя

**Особенности**:
- Использует `window.electronAPI` напрямую (нет сервисного слоя)
- Логирование ошибок через `logger` (исправлено)
- Оптимистичное обновление UI после операций
- Валидация формы через HTML5 атрибуты

## 🔌 IPC Handlers

### `auth:register-user`

Регистрация нового пользователя (только для администраторов):

```typescript
// Frontend
const result = await window.electronAPI.registerUser({
    username: 'ivanov',
    password: 'password123',
    fullName: 'Иванов Иван Иванович',
    isAdmin: false
});

// Backend (electron/auth.cjs)
ipcMain.handle('auth:register-user', 
    ensureAuthenticated(
        ensureAdmin(async (_, userData) => {
            // Валидация через Zod
            const { username, password, fullName, isAdmin } = 
                UserRegistrationSchema.parse(userData);
            
            // Проверка уникальности логина
            // Хеширование пароля
            // Создание пользователя
            // Audit logging
        })
    )
);
```

### `auth:get-all-users`

Получение списка всех пользователей (только для администраторов):

```typescript
// Frontend
const users = await window.electronAPI.getAllUsers();

// Backend
ipcMain.handle('auth:get-all-users', 
    ensureAuthenticated(
        ensureAdmin(async () => {
            return await prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    isAdmin: true,
                    isActive: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'asc' }
            });
        })
    )
);
```

**Примечание**: Пароль (`passwordHash`) никогда не возвращается.

### `auth:activate-user`

Активация пользователя (только для администраторов):

```typescript
// Frontend
const result = await window.electronAPI.activateUser(userId);

// Backend
ipcMain.handle('auth:activate-user', 
    ensureAuthenticated(
        ensureAdmin(async (_, userId) => {
            await prisma.user.update({
                where: { id: userId },
                data: { isActive: true }
            });
            // Audit logging
        })
    )
);
```

### `auth:deactivate-user`

Деактивация пользователя (только для администраторов):

```typescript
// Frontend
const result = await window.electronAPI.deactivateUser(userId);

// Backend
ipcMain.handle('auth:deactivate-user', 
    ensureAuthenticated(
        ensureAdmin(async (_, userId) => {
            // Защита от самоудаления
            if (userId === currentSession.user.id) {
                return { success: false, error: 'Нельзя деактивировать свою учетную запись' };
            }
            
            await prisma.user.update({
                where: { id: userId },
                data: { isActive: false }
            });
            // Audit logging
        })
    )
);
```

### `auth:change-password`

Смена пароля (пользователь может сменить свой пароль, администратор - любой):

```typescript
// Frontend
const result = await window.electronAPI.changePassword({
    userId: 1,
    oldPassword: 'oldpass',
    newPassword: 'newpass'
});

// Backend
ipcMain.handle('auth:change-password', 
    ensureAuthenticated(async (_, data) => {
        // Проверка прав (свой пароль или администратор)
        // Проверка старого пароля
        // Хеширование нового пароля
        // Обновление в БД
        // Audit logging
    })
);
```

## 🗄️ База данных

### Модель User (Prisma)

Основные поля:
- `id`: Уникальный идентификатор
- `username`: Уникальный логин пользователя
- `passwordHash`: Хеш пароля (bcrypt)
- `fullName`: Полное имя пользователя
- `isAdmin`: Флаг администратора
- `isActive`: Флаг активности (деактивированные не могут войти)
- `createdAt`: Дата создания

### Связи

User связан со многими сущностями:
- **Child**: Пациенты, созданные пользователем (`createdByUserId`)
- **VaccinationRecord**: Записи о вакцинации
- **PatientShare**: Совместный доступ к пациентам
- **Visit**: Приемы пациентов
- **DiseaseNote**: Заметки к заболеваниям
- **MedicationChangeLog**: История изменений препаратов
- **Templates**: Шаблоны (приемов, препаратов, текстов осмотра)
- **InformedConsent**: Информированные согласия

### Миграции

При изменении структуры User:
1. Обновите `prisma/schema.prisma`
2. Создайте миграцию: `npx prisma migrate dev --name description`
3. Обновите TypeScript типы в `src/types.ts`
4. Обновите Zod схемы в `electron/auth.cjs` (если нужно)

## 🔐 Безопасность

1. **Аутентификация**: Все IPC handlers защищены `ensureAuthenticated`
2. **Контроль доступа**: Административные операции защищены `ensureAdmin`
3. **Валидация**: Zod валидация на backend (защита от обхода frontend валидации)
4. **Логирование**: Все ошибки логируются через централизованный `logger` (исправлено)
5. **Audit Trail**: Полная история изменений через `logAudit`
6. **Хеширование паролей**: bcrypt с 10 rounds
7. **Защита от самоудаления**: Администратор не может деактивировать себя
8. **Скрытие паролей**: Пароли никогда не возвращаются на frontend

## 📊 Интеграции

### Система аутентификации
- Тесная интеграция с `electron/auth.cjs`
- Использование сессии для проверки прав доступа
- Middleware для контроля доступа

### Модуль пациентов (Patients)
- Каждый пациент связан с создавшим его пользователем (`createdByUserId`)
- Фильтрация пациентов по пользователю (каждый врач видит только своих пациентов)
- Совместный доступ через `PatientShare`

### Модуль приемов (Visits)
- Каждый прием связан с пользователем (врачом)
- История приемов привязана к пользователю

### Модуль заболеваний (Diseases)
- Заметки к заболеваниям привязаны к пользователю
- Личные и общие заметки (через `isShared`)

### Модуль препаратов (Medications)
- История изменений препаратов привязана к пользователю
- Audit trail всех модификаций

## 🎨 UI/UX особенности

- **Адаптивный дизайн**: Работает на разных размерах экрана
- **Темная тема**: Поддержка dark mode
- **Валидация в реальном времени**: HTML5 валидация для быстрой обратной связи
- **Модальное окно**: Удобная форма регистрации в модальном окне
- **Визуальные индикаторы**: Цветовые индикаторы статуса (активен/деактивирован)
- **Роли**: Визуальное отображение роли (Администратор / Врач)
- **Статистика**: Отображение общего количества врачей
- **Оптимистичное обновление**: Мгновенная обратная связь при операциях

## 📝 Примечания для разработчиков

1. **Всегда используйте logger**: Не используйте `console.log`, используйте `logger` (исправлено)
2. **Проверяйте права доступа**: Всегда используйте `ensureAdmin` для административных операций
3. **Валидируйте данные**: Используйте Zod схемы на backend
4. **Логируйте операции**: Используйте `logAudit` для важных операций
5. **Не возвращайте пароли**: Пароли никогда не должны возвращаться на frontend
6. **Защита от самоудаления**: Проверяйте, что администратор не деактивирует себя
7. **Хеширование паролей**: Всегда хешируйте пароли через bcrypt перед сохранением
8. **Уникальность логина**: Проверяйте уникальность логина перед созданием пользователя

## 🔄 Миграции

При изменении структуры User:
1. Обновите `prisma/schema.prisma`
2. Создайте миграцию: `npx prisma migrate dev --name description`
3. Обновите TypeScript типы в `src/types.ts`
4. Обновите Zod схемы в `electron/auth.cjs` (если нужно)
5. Обновите компоненты, использующие User
6. Обеспечьте обратную совместимость при изменении структуры

## 🔗 Связанные модули

- **Auth Module** (`electron/auth.cjs`) - Система аутентификации и управления пользователями
- **Patients Module** (`src/modules/patients/`) - Связь пациентов с пользователями
- **Visits Module** (`src/modules/visits/`) - Приемы привязаны к пользователям
- **Diseases Module** (`src/modules/diseases/`) - Заметки привязаны к пользователям
- **Medications Module** (`src/modules/medications/`) - История изменений привязана к пользователям

## 📚 Дополнительные ресурсы

- `AI_CODING_GUIDELINES.md` - Общие принципы разработки
- `DEVELOPMENT_RULES.md` - Правила разработки
- `MULTI_USER_ARCHITECTURE.md` - Архитектура многопользовательской системы
- `electron/auth.cjs` - Реализация IPC handlers
- `prisma/schema.prisma` - Модель User в базе данных

## ⚠️ Известные ограничения

1. **Нет сервисного слоя**: Компонент использует `window.electronAPI` напрямую (можно улучшить, создав `userService.ts`)
2. **Frontend валидация**: Только HTML5 валидация, нет Zod валидации на frontend (можно добавить для лучшего UX)
3. **In-memory сессия**: Сессия хранится в памяти, теряется при перезапуске приложения (нормально для desktop app)
4. **Нет восстановления пароля**: Нет функционала восстановления забытого пароля (можно добавить в будущем)
