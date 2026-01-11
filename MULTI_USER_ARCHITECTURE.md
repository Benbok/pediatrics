# Multi-User System Architecture

## Overview

PediAssist v2.0 поддерживает полноценную систему многопользовательского доступа, позволяющую нескольким врачам работать на одной рабочей станции с индивидуальными профилями и разделением доступа к пациентам.

## Key Decisions

### 1. Модель доступа к пациентам: Гибридная (Hybrid)

- ✅ Каждый врач видит **только своих** пациентов по умолчанию
- ✅ Врач может **поделиться** пациентом с коллегой (read-only или full edit)
- ✅ Admin видит **всех** пациентов клиники

**Access Control Query:**
```sql
WHERE createdByUserId = currentUser.id 
   OR childId IN (
       SELECT childId FROM patient_shares 
       WHERE sharedWith = currentUser.id
   )
```

### 2. Роли пользователей: Упрощенная система

- **Admin**: 
  - Может регистрировать новых врачей
  - Видит всех пациентов
  - Может деактивировать учетные записи
  
- **Doctor**: 
  - Все врачи равноправны
  - Видит только своих пациентов + shared
  - Может делиться пациентами с коллегами

### 3. Миграция данных: Чистый старт

- База данных сбрасывается при внедрении v2.0
- Первый admin создается автоматически из `.env.local`
- Все последующие пользователи регистрируются через UI

---

## Database Schema

### Users Table

```prisma
model User {
  id            Int       @id @default(autoincrement())
  username      String    @unique
  passwordHash  String    // bcrypt hash (10 rounds)
  fullName      String
  isAdmin       Boolean   @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  
  createdChildren       Child[]
  createdRecords        VaccinationRecord[]
  sharedPatientsAsOwner PatientShare[]
  sharedPatientsAccess  PatientShare[]
}
```

### Patient Sharing Table (NEW)

```prisma
model PatientShare {
  id          Int      @id @default(autoincrement())
  childId     Int
  sharedBy    Int      // Owner user ID
  sharedWith  Int      // Collaborator user ID
  canEdit     Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  child       Child    @relation(...)
  ownerUser   User     @relation("SharedByUser", ...)
  sharedUser  User     @relation("SharedWithUser", ...)
  
  @@unique([childId, sharedWith])
}
```

### Updated Child Table

```diff
model Child {
  id                  Int       @id
  name                String    // Encrypted
  surname             String    // Encrypted
  patronymic          String?   // Encrypted
  birthDate           String    // Encrypted
  birthWeight         Int
  gender              String
+ createdByUserId     Int       // NEW: Owner tracking
  createdAt           DateTime
  
+ createdBy           User
  vaccinationProfile  VaccinationProfile?
  vaccinationRecords  VaccinationRecord[]
+ shares              PatientShare[]
}
```

---

## Backend Implementation

### Authentication Service (`auth.cjs`)

**Key Features:**
- Database-backed user authentication
- Session management with full User object
- bcrypt password hashing
- User registration (admin only)
- User activation/deactivation
- Password change functionality

**IPC Handlers:**
```javascript
'auth:login'           // Login with username/password
'auth:logout'          // Clear session
'auth:check-session'   // Get current user
'auth:register-user'   // Admin: create new doctor
'auth:get-all-users'   // Admin: list all users
'auth:deactivate-user' // Admin: disable account
'auth:activate-user'   // Admin: enable account
'auth:change-password' // User: change own password
```

**Middleware:**
```javascript
ensureAuthenticated(handler) // Protect all IPC calls
ensureAdmin(handler)         // Admin-only operations
getSession()                 // Get current user context
```

### Access Control (`database.cjs`)

**Patient Filtering:**
```javascript
// db:get-children - Returns only accessible patients
const userId = getSession().user.id;
const isAdmin = getSession().user.isAdmin;

const whereClause = isAdmin ? {} : {
  OR: [
    { createdByUserId: userId },       // Own patients
    { shares: { some: { sharedWith: userId } } } // Shared patients
  ]
};
```

**Auto-assignment:**
```javascript
// db:create-child - Auto-assign creator
const newChild = await prisma.child.create({
  data: {
    ...childData,
    createdByUserId: getSession().user.id // Auto-assign
  }
});
```

**Patient Sharing:**
```javascript
// db:share-patient - Grant access to colleague
'db:share-patient'   // { childId, userId, canEdit }
'db:unshare-patient' // { childId, userId }
```

### Database Initialization (`init-db.cjs`)

**Auto-create First Admin:**
```javascript
async function initializeDatabase() {
  const userCount = await prisma.user.count();
  
  if (userCount === 0) {
    // Create first admin from .env.local
    await prisma.user.create({
      data: {
        username: process.env.ADMIN_LOGIN,
        passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10),
        fullName: 'Администратор',
        isAdmin: true
      }
    });
  }
}
```

### Shared Prisma Client (`prisma-client.cjs`)

**Single Instance Pattern:**
```javascript
// Avoid "PrismaClient needs non-empty options" error
const { prisma, dbPath, isDev } = require('./prisma-client.cjs');
```

---

## Frontend Implementation

### TypeScript Types (`types.ts`)

```typescript
export interface User {
  id: number;
  username: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  user: User | null;
}
```

### Auth Context (`AuthContext.tsx`)

**State Management:**
```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [currentUser, setCurrentUser] = useState<User | null>(null);

// On login success
setIsAuthenticated(true);
setCurrentUser(result.user);
```

**Exposed API:**
```typescript
interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
}
```

### User Management Module (`UserManagementModule.tsx`)

**Features:**
- Users table with status/role indicators
- User registration modal
- Activate/Deactivate buttons
- Admin-only access (route protected via AppShell)

**API Usage:**
```typescript
// Load all users
const users = await window.electronAPI.getAllUsers();

// Register new doctor
await window.electronAPI.registerUser({
  username, password, fullName, isAdmin
});

// Toggle active status
await window.electronAPI.deactivateUser(userId);
await window.electronAPI.activateUser(userId);
```

### App Shell Updates (`AppShell.tsx`)

**Current User Display:**
```tsx
{isSidebarOpen && currentUser && (
  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <div className="font-semibold">{currentUser.fullName}</div>
    <div className="text-xs">
      {currentUser.isAdmin ? '👑 Администратор' : '👨‍⚕️ Врач'}
    </div>
  </div>
)}
```

**Conditional Navigation:**
```tsx
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Главная' },
  { to: '/patients', icon: Baby, label: 'Пациенты' },
  ...(currentUser?.isAdmin ? [
    { to: '/users', icon: Users, label: 'Пользователи' }
  ] : []),
];
```

---

## Security Considerations

### Password Security
- ✅ bcrypt hashing (10 rounds) for all passwords
- ✅ Support for both plain text (dev) and hashed passwords
- ✅ Minimum password length enforced (6 chars)

### Session Management
- ✅ In-memory session (suitable for desktop app)
- ✅ Full User object stored in session
- ✅ Session cleared on logout

### Access Control
- ✅ All IPC handlers protected by `ensureAuthenticated`
- ✅ Admin-only operations protected by `ensureAdmin`
- ✅ Patient filtering by ownership + sharing
- ✅ Users cannot deactivate themselves

### Audit Trail
- ✅ All user operations logged:
  - `LOGIN_SUCCESS` / `LOGIN_FAILED`
  - `LOGOUT`
  - `USER_REGISTERED`
  - `USER_DEACTIVATED` / `USER_ACTIVATED`
  - `PASSWORD_CHANGED`
  - `PATIENT_SHARED` / `PATIENT_UNSHARED`
- ✅ Every log entry includes `userId` of initiator

---

## Migration Path

### From v1.x to v2.0

1. **Backup existing data** (if needed)
2. **Run database reset**:
   ```bash
   npx prisma migrate reset --force
   ```
3. **Apply new schema**:
   ```bash
   npx prisma migrate dev --name add_multi_user_support
   ```
4. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```
5. **Start app** - first admin created automatically
6. **Register doctors** via Admin Panel

---

## Testing Checklist

### Authentication
- [ ] Login with correct credentials
- [ ] Login with incorrect credentials
- [ ] Logout clears session
- [ ] Session persists during app usage
- [ ] Deactivated user cannot login

### User Management (Admin)
- [ ] Register new doctor
- [ ] Register new admin
- [ ] View all users in table
- [ ] Deactivate user account
- [ ] Activate user account
- [ ] Cannot deactivate self

### Access Control (Doctor)
- [ ] See only own patients
- [ ] Cannot see other doctors' patients
- [ ] Patients auto-assigned on creation
- [ ] "Пользователи" menu item hidden for non-admins

### Access Control (Admin)
- [ ] See all patients in clinic
- [ ] Access User Management module
- [ ] Can manage all user accounts

### Patient Sharing (TODO)
- [ ] Share patient with colleague
- [ ] Revoke patient sharing
- [ ] Shared patient visible to colleague
- [ ] Read-only vs Edit permissions work

---

## Future Enhancements

### Short-term
- [ ] Patient Sharing UI (share button in patient card)
- [ ] User profile settings page
- [ ] Password change from UI
- [ ] Display creator name in patient list

### Long-term
- [ ] Desktop Viewer role (read-only access)
- [ ] Activity dashboard per user
- [ ] Advanced audit log viewer
- [ ] Batch user import (CSV)
- [ ] Session timeout settings

---

## Troubleshooting

### "PrismaClient needs non-empty options"
**Fix:** Use shared `prisma-client.cjs` instance in all modules

### "Cannot read properties of undefined (reading 'count')"
**Fix:** Run `npx prisma generate` after schema changes

### First admin not created
**Fix:** Check `.env.local` has `ADMIN_LOGIN` and `ADMIN_PASSWORD`

### Users can't login after migration
**Fix:** Run `npx prisma migrate reset` and restart

---

## API Reference

### electronAPI Methods (User Management)

```typescript
// Authentication
window.electronAPI.login(credentials: { username, password })
  -> { success: boolean, user?: User, error?: string }

window.electronAPI.logout()
  -> { success: boolean }

window.electronAPI.checkSession()
  -> AuthSession

// User Management (Admin only)
window.electronAPI.registerUser(data: UserData)
  -> { success: boolean, user?: User, error?: string }

window.electronAPI.getAllUsers()
  -> User[]

window.electronAPI.deactivateUser(userId: number)
  -> { success: boolean, error?: string }

window.electronAPI.activateUser(userId: number)
  -> { success: boolean, error?: string }

window.electronAPI.changePassword(data: PasswordChange)
  -> { success: boolean, error?: string }

// Patient Sharing
window.electronAPI.sharePatient(data: ShareData)
  -> { success: boolean, error?: string }

window.electronAPI.unsharePatient(data: UnshareData)
  -> { success: boolean, error?: string }
```

---

**Last Updated:** 2026-01-11  
**Version:** 2.0.0 (Multi-User System)
