const { app, ipcMain } = require('electron');
const path = require('path');
const { z } = require('zod');
const { ensureAuthenticated, getSession } = require('./auth.cjs');
const { encrypt, decrypt } = require('./crypto.cjs');
const { logger, logAudit } = require('./logger.cjs');
const { createBackup, shouldBackupToday } = require('./backup.cjs');
const { CacheService } = require('./services/cacheService.cjs');

// ============= VALIDATION SCHEMAS (Zod) =============
// Re-defined here because database.cjs is CommonJS and doesn't run via Vite/TypeScript

const ChildProfileSchema = z.object({
  id: z.number().optional(),
  name: z.string()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(50, 'Имя должно содержать максимум 50 символов')
    .regex(/^[а-яёА-ЯЁ\s-]+$/, 'Имя должно содержать только кириллицу, пробелы и дефисы'),
  surname: z.string()
    .min(2, 'Фамилия должна содержать минимум 2 символа')
    .max(50, 'Фамилия должна содержать максимум 50 символов')
    .regex(/^[а-яёА-ЯЁ\s-]+$/, 'Фамилия должна содержать только кириллицу, пробелы и дефисы'),
  patronymic: z.string()
    .max(50, 'Отчество должно содержать максимум 50 символов')
    .regex(/^[а-яёА-ЯЁ\s-]*$/, 'Отчество должно содержать только кириллицу, пробелы и дефисы')
    .optional()
    .nullable(),
  birthDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты (ГГГГ-ММ-ДД)')
    .refine((date) => {
      const d = new Date(date);
      return !isNaN(d.getTime()) && d <= new Date();
    }, 'Дата рождения не может быть в будущем'),
  gender: z.enum(['male', 'female']),
});

const VaccinationProfileSchema = z.object({
  id: z.number().optional(),
  childId: z.number(),
  hepBRiskFactors: z.array(z.string()).optional(),
  pneumoRiskFactors: z.array(z.string()).optional(),
  pertussisContraindications: z.array(z.string()).optional(),
  polioRiskFactors: z.array(z.string()).optional(),
  mmrContraindications: z.array(z.string()).optional(),
  meningRiskFactors: z.array(z.string()).optional(),
  varicellaRiskFactors: z.array(z.string()).optional(),
  hepaRiskFactors: z.array(z.string()).optional(),
  fluRiskFactors: z.array(z.string()).optional(),
  hpvRiskFactors: z.array(z.string()).optional(),
  tbeRiskFactors: z.array(z.string()).optional(),
  rotaRiskFactors: z.array(z.string()).optional(),
  birthWeight: z.number()
    .min(500, 'Вес при рождении должен быть не менее 500 г')
    .max(8000, 'Вес при рождении должен быть не более 8000 г')
    .nullable()
    .optional(),
  mantouxDate: z.string().nullable().optional(),
  mantouxResult: z.boolean().nullable().optional(),
  customVaccines: z.array(z.any()).optional(),
});

const UserVaccineRecordSchema = z.object({
  id: z.number().optional(),
  childId: z.number().optional(),
  vaccineId: z.string(),
  isCompleted: z.boolean(),
  completedDate: z.string().nullable().optional(),
  vaccineBrand: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  dose: z.string().max(50).optional().nullable(),
  series: z.string().max(50).optional().nullable(),
  expiryDate: z.string().nullable().optional(),
  manufacturer: z.string().max(100).optional().nullable(),
  ignoreValidation: z.boolean().optional(),
});

const VaccineBrandSchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
});

const VaccineCatalogEntrySchema = z.object({
  id: z.number().optional(),
  vaccineId: z.string().min(2).max(100),
  name: z.string().min(2).max(200),
  disease: z.string().min(2).max(200),
  ageMonthStart: z.number().min(0).max(240),
  description: z.string().max(500).optional().nullable(),
  requiredRiskFactor: z.string().max(100).optional().nullable(),
  excludedRiskFactor: z.string().max(100).optional().nullable(),
  isLive: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  lectureId: z.string().max(100).optional().nullable(),
  availableBrands: z.array(VaccineBrandSchema).optional(),
  isDeleted: z.boolean().optional(),
});

const VaccinePlanDoseSchema = z.object({
  ageMonthStart: z.number().min(0).max(240),
  minIntervalDays: z.number().int().min(0).max(3650).optional().nullable(),
});

const VaccinePlanTemplateSchema = z.object({
  id: z.number().optional(),
  planId: z.string().min(2).max(100),
  vaccineBaseId: z.string().min(2).max(100),
  name: z.string().min(2).max(200),
  disease: z.string().min(2).max(200),
  description: z.string().max(500).optional().nullable(),
  isLive: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  availableBrands: z.array(VaccineBrandSchema).optional(),
  lectureId: z.string().max(100).optional().nullable(),
  doses: z.array(VaccinePlanDoseSchema).min(1),
  isDeleted: z.boolean().optional(),
});

const getZodErrorMessage = (error) => {
  const issues = error?.issues || error?.errors || [];
  if (Array.isArray(issues) && issues.length > 0) {
    return issues.map((item) => item?.message).filter(Boolean).join(', ');
  }
  return error?.message || 'Ошибка валидации данных';
};

// Import shared Prisma client
const { prisma, dbPath, isDev } = require('./prisma-client.cjs');

logger.info(`[Database] Initializing with isDev=${isDev}`);
logger.info(`[Database] DB Path: ${dbPath}`);
logger.info(`[Database] __dirname: ${__dirname}`);

// Initialize Database (Schema synchronization)
async function initDatabase() {
  logger.info('[Database] ========== INIT START ==========');
  logger.info('[Database] isDev:', isDev);
  logger.info('[Database] dbPath:', dbPath);

    try {
        logger.info('[Database] Connecting to Prisma...');
        await prisma.$connect();
        
        // Устанавливаем busy_timeout для SQLite (в миллисекундах)
        // Это позволяет базе данных ждать до 5 секунд перед возвращением ошибки "database is locked"
        await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000`);
        
        logger.info('[Database] Connected at:', dbPath);
        logger.info('[Database] SQLite busy_timeout set to 5000ms');

    // In production, check if schema exists and is correct
    if (!isDev) {
      logger.info('[Database] Production mode - checking schema...');
      let schemaIsValid = false;

      try {
        // Check if table exists AND has the surname column (key column)
        const result = await prisma.$queryRawUnsafe(
          `SELECT name FROM pragma_table_info('children') WHERE name = 'surname'`
        );
        schemaIsValid = Array.isArray(result) && result.length > 0;
        logger.info('[Database] Schema check result:', schemaIsValid ? 'VALID' : 'INVALID or MISSING');
      } catch (error) {
        logger.warn('[Database] Schema check error:', error.message);
        schemaIsValid = false;
      }

      if (!schemaIsValid) {
        logger.warn('[Database] Dropping old tables and creating new schema...');

        // Drop existing tables (order matters due to foreign keys)
        try {
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS vaccination_records`);
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS vaccination_profiles`);
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS children`);
          logger.info('[Database] Old tables dropped');
        } catch (e) {
          logger.warn('[Database] Drop error (ignoring):', e.message);
        }

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS children (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            surname TEXT NOT NULL,
            patronymic TEXT,
            birth_date TEXT NOT NULL,
            birth_weight INTEGER NOT NULL DEFAULT 0,
            gender TEXT NOT NULL,
            created_by_user_id INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id)
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS vaccination_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL UNIQUE,
            hep_b_risk_factors TEXT,
            pneumo_risk_factors TEXT,
            pertussis_contraindications TEXT,
            polio_risk_factors TEXT,
            mmr_contraindications TEXT,
            mening_risk_factors TEXT,
            varicella_risk_factors TEXT,
            hepa_risk_factors TEXT,
            flu_risk_factors TEXT,
            hpv_risk_factors TEXT,
            tbe_risk_factors TEXT,
            rota_risk_factors TEXT,
            mantoux_date TEXT,
            mantoux_result INTEGER,
            custom_vaccines TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS vaccination_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            vaccine_id TEXT NOT NULL,
            is_completed INTEGER NOT NULL DEFAULT 0,
            completed_date TEXT,
            vaccine_brand TEXT,
            notes TEXT,
            dose TEXT,
            series TEXT,
            expiry_date TEXT,
            manufacturer TEXT,
            created_by_user_id INTEGER,
            FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id),
            UNIQUE(child_id, vaccine_id)
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS diseases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icd10_code TEXT NOT NULL UNIQUE,
            name_ru TEXT NOT NULL,
            name_en TEXT,
            description TEXT NOT NULL,
            symptoms TEXT NOT NULL DEFAULT '[]',
            symptoms_embedding TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS clinical_guidelines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            disease_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            pdf_path TEXT,
            content TEXT NOT NULL,
            chunks TEXT NOT NULL,
            source TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (disease_id) REFERENCES diseases(id) ON DELETE CASCADE
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS medications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_ru TEXT NOT NULL,
            name_en TEXT,
            active_substance TEXT NOT NULL,
            atc_code TEXT,
            manufacturer TEXT,
            forms TEXT NOT NULL,
            pediatric_dosing TEXT NOT NULL,
            adult_dosing TEXT,
            contraindications TEXT NOT NULL,
            caution_conditions TEXT,
            side_effects TEXT,
            interactions TEXT,
            pregnancy TEXT,
            lactation TEXT,
            indications TEXT NOT NULL,
            registration_number TEXT,
            vidal_url TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS disease_medications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            disease_id INTEGER NOT NULL,
            medication_id INTEGER NOT NULL,
            priority INTEGER NOT NULL DEFAULT 1,
            dosing TEXT,
            duration TEXT,
            FOREIGN KEY (disease_id) REFERENCES diseases(id) ON DELETE CASCADE,
            FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
            UNIQUE(disease_id, medication_id)
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            visit_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            complaints TEXT NOT NULL,
            complaints_json TEXT,
            physical_exam TEXT,
            primary_diagnosis_id INTEGER,
            complication_ids TEXT,
            comorbidity_ids TEXT,
            prescriptions TEXT NOT NULL DEFAULT '[]',
            recommendations TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES users(id),
            FOREIGN KEY (primary_diagnosis_id) REFERENCES diseases(id)
          );
        `);

        logger.info('[Database] Schema created successfully');
      }
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vaccine_catalog_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vaccine_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        disease TEXT NOT NULL,
        age_month_start REAL NOT NULL,
        description TEXT,
        required_risk_factor TEXT,
        excluded_risk_factor TEXT,
        is_live INTEGER NOT NULL DEFAULT 0,
        is_recommended INTEGER NOT NULL DEFAULT 0,
        available_brands TEXT,
        lecture_id TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vaccine_plan_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL UNIQUE,
        vaccine_base_id TEXT NOT NULL,
        name TEXT NOT NULL,
        disease TEXT NOT NULL,
        description TEXT,
        is_live INTEGER NOT NULL DEFAULT 0,
        is_recommended INTEGER NOT NULL DEFAULT 0,
        available_brands TEXT,
        lecture_id TEXT,
        doses TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    logger.info('[Database] ========== INIT COMPLETE ==========');
  } catch (error) {
    logger.error('[Database] ========== INIT FAILED ==========');
    logger.error('[Database] Error details:', error);
    logger.error('[Database] Error stack:', error.stack);
  }
}

const setupDatabaseHandlers = async () => {
  logger.info('[Database] ========== SETUP START ==========');

  // Automated backup on startup
  try {
    if (await shouldBackupToday()) {
      logger.info('[Database] Starting daily automated backup...');
      await createBackup(dbPath);
      logAudit('DATABASE_BACKUP_SUCCESS');
    }
  } catch (error) {
    logger.error('[Database] Automated backup failed:', error);
    logAudit('DATABASE_BACKUP_FAILED', { error: error.message });
  }

  logger.info('[Database] Calling initDatabase...');
  await initDatabase();
  logger.info('[Database] initDatabase completed');
  logger.info('[Database] Registering IPC handlers...');

  // ============= PATIENTS MODULE HANDLERS =============
  ipcMain.handle('db:get-children', ensureAuthenticated(async () => {
    const session = getSession();
    const userId = session.user.id;
    const isAdmin = Boolean(session.user.roles?.includes('admin'));

    // Ключ кеша зависит от пользователя
    const cacheKey = `user_${userId}_admin_${isAdmin}`;
    
    // Проверяем кеш
    const cached = CacheService.get('children', cacheKey);
    if (cached) {
      logger.debug('[DB] Cache hit for children list');
      return cached;
    }

    // Build WHERE clause based on user permissions
    const whereClause = isAdmin
      ? {} // Admin sees all children
      : {
        OR: [
          { createdByUserId: userId }, // Own children
          {
            shares: {
              some: { sharedWith: userId } // Shared with this user
            }
          }
        ]
      };

    const children = await prisma.child.findMany({
      where: whereClause,
      include: {
        shares: {
          where: { sharedWith: userId },
          select: {
            canEdit: true,
            ownerUser: {
              select: { lastName: true, firstName: true, middleName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt sensitive fields
    const decrypted = children.map(child => ({
      ...child,
      name: decrypt(child.name),
      surname: decrypt(child.surname),
      patronymic: decrypt(child.patronymic),
      birthDate: decrypt(child.birthDate),
      isShared: child.shares.length > 0, // Mark as shared
      sharedBy: child.shares[0]?.ownerUser ? [child.shares[0].ownerUser.lastName, child.shares[0].ownerUser.firstName, child.shares[0].ownerUser.middleName].filter(Boolean).join(' ') : null,
      canEdit: child.createdByUserId === userId || child.shares[0]?.canEdit || isAdmin
    }));

    // Сохраняем в кеш
    CacheService.set('children', cacheKey, decrypted);
    
    return decrypted;
  }));

  ipcMain.handle('db:get-child', ensureAuthenticated(async (_, id) => {
    const cacheKey = `child_${id}`;
    
    // Проверяем кеш
    const cached = CacheService.get('children', cacheKey);
    if (cached) {
      logger.debug(`[DB] Cache hit for child ${id}`);
      return cached;
    }

    const child = await prisma.child.findUnique({
      where: { id: Number(id) },
    });

    if (!child) return null;

    const decrypted = {
      ...child,
      name: decrypt(child.name),
      surname: decrypt(child.surname),
      patronymic: decrypt(child.patronymic),
      birthDate: decrypt(child.birthDate),
    };

    // Сохраняем в кеш
    CacheService.set('children', cacheKey, decrypted);
    
    return decrypted;
  }));

  ipcMain.handle('db:create-child', ensureAuthenticated(async (_, child) => {
    try {
      const session = getSession();
      const userId = session.user.id;
      const isAdmin = Boolean(session.user.roles?.includes('admin'));

      const validatedChild = ChildProfileSchema.parse(child);
      const { name, surname, patronymic, birthDate, gender } = validatedChild;

      const newChild = await prisma.child.create({
        data: {
          name: encrypt(name),
          surname: encrypt(surname),
          patronymic: encrypt(patronymic),
          birthDate: encrypt(String(birthDate)),
          gender,
          createdByUserId: userId, // Auto-assign current user
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

      logAudit('PATIENT_CREATED', {
        childId: newChild.id,
        name,
        surname,
        createdBy: userId
      });

      // Инвалидируем кеш пациентов для текущего пользователя и админов
      CacheService.invalidate('children', `user_${userId}_admin_false`);
      CacheService.invalidate('children', `user_${userId}_admin_true`);
      // Также инвалидируем все списки админов (если текущий пользователь админ)
      if (isAdmin) {
        // Нужно инвалидировать все кеши для админов - делаем через invalidate namespace для admin
        // Но проще всего - инвалидировать все кеши детей, так как админы видят всех
        CacheService.invalidate('children');
      }

      return newChild;
    } catch (error) {
      logger.error('[Database] Failed to create child:', error);
      if (error instanceof z.ZodError) {
        throw new Error(getZodErrorMessage(error));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:update-child', ensureAuthenticated(async (_, id, updates) => {
    try {
      const validatedUpdates = ChildProfileSchema.partial().parse(updates);
      const { name, surname, patronymic, birthDate, gender } = validatedUpdates;

      const dataToUpdate = {};
      if (name) dataToUpdate.name = encrypt(name);
      if (surname) dataToUpdate.surname = encrypt(surname);
      if (patronymic) dataToUpdate.patronymic = encrypt(patronymic);
      if (birthDate) dataToUpdate.birthDate = encrypt(String(birthDate));
      if (gender) dataToUpdate.gender = gender;

      await prisma.child.update({
        where: { id: Number(id) },
        data: dataToUpdate,
      });
      logAudit('PATIENT_UPDATED', { childId: id, updates: Object.keys(dataToUpdate) });
      
      // Инвалидируем кеш
      const session = getSession();
      CacheService.invalidate('children', `child_${id}`);
      CacheService.invalidate('children', `user_${session.user.id}_admin_false`);
      CacheService.invalidate('children', `user_${session.user.id}_admin_true`);
      if (Boolean(session.user.roles?.includes('admin'))) {
        CacheService.invalidate('children');
      }
      
      return true;
    } catch (error) {
      logger.error('[Database] Failed to update child:', error);
      if (error instanceof z.ZodError) {
        throw new Error(getZodErrorMessage(error));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:delete-child', ensureAuthenticated(async (_, id) => {
    const session = getSession();
    
    await prisma.child.delete({
      where: { id: Number(id) },
    });
    logAudit('PATIENT_DELETED', { childId: id });
    
    // Инвалидируем кеш
    CacheService.invalidate('children', `child_${id}`);
    CacheService.invalidate('children', `user_${session.user.id}_admin_false`);
    CacheService.invalidate('children', `user_${session.user.id}_admin_true`);
    CacheService.invalidate('profiles', `child_${id}`);
    CacheService.invalidate('records', `child_${id}`);
    if (Boolean(session.user.roles?.includes('admin'))) {
      CacheService.invalidate('children');
    }
    
    return true;
  }));

  // Share Patient Handler (for collaboration)
  ipcMain.handle('db:share-patient', ensureAuthenticated(async (_, data) => {
    try {
      const session = getSession();
      const currentUserId = session.user.id;

      const { childId, userId, canEdit } = data;

      // Verify current user owns this patient
      const child = await prisma.child.findUnique({
        where: { id: Number(childId) }
      });

      if (!child) {
        throw new Error('Пациент не найден');
      }

      if (child.createdByUserId !== currentUserId && !Boolean(session.user.roles?.includes('admin'))) {
        throw new Error('Вы можете делиться только своими пациентами');
      }

      // Cannot share with self
      if (userId === currentUserId) {
        throw new Error('Нельзя поделиться с самим собой');
      }

      // Create or update share
      const share = await prisma.patientShare.upsert({
        where: {
          childId_sharedWith: {
            childId: Number(childId),
            sharedWith: Number(userId)
          }
        },
        create: {
          childId: Number(childId),
          sharedBy: currentUserId,
          sharedWith: Number(userId),
          canEdit: Boolean(canEdit)
        },
        update: {
          canEdit: Boolean(canEdit)
        }
      });

      logAudit('PATIENT_SHARED', {
        childId,
        sharedBy: currentUserId,
        sharedWith: userId,
        canEdit
      });

      // Инвалидируем кеш списка пациентов для обоих пользователей (оба ключа на случай если целевой пользователь — админ)
      CacheService.invalidate('children', `user_${currentUserId}_admin_false`);
      CacheService.invalidate('children', `user_${currentUserId}_admin_true`);
      CacheService.invalidate('children', `user_${userId}_admin_false`);
      CacheService.invalidate('children', `user_${userId}_admin_true`);
      if (Boolean(session.user.roles?.includes('admin'))) {
        CacheService.invalidate('children');
      }

      return { success: true, share };

    } catch (error) {
      logger.error('[Database] Share patient error:', error);
      throw error;
    }
  }));

  // Unshare Patient Handler
  ipcMain.handle('db:unshare-patient', ensureAuthenticated(async (_, data) => {
    try {
      const session = getSession();
      const { childId, userId } = data;

      // Verify ownership
      const child = await prisma.child.findUnique({
        where: { id: Number(childId) }
      });

      if (child.createdByUserId !== session.user.id && !Boolean(session.user.roles?.includes('admin'))) {
        throw new Error('Недостаточно прав');
      }

      await prisma.patientShare.delete({
        where: {
          childId_sharedWith: {
            childId: Number(childId),
            sharedWith: Number(userId)
          }
        }
      });

      logAudit('PATIENT_UNSHARED', { childId, sharedWith: userId });

      // Инвалидируем кеш списка пациентов (оба ключа на случай если целевой пользователь — админ)
      CacheService.invalidate('children', `user_${session.user.id}_admin_false`);
      CacheService.invalidate('children', `user_${session.user.id}_admin_true`);
      CacheService.invalidate('children', `user_${userId}_admin_false`);
      CacheService.invalidate('children', `user_${userId}_admin_true`);
      if (Boolean(session.user.roles?.includes('admin'))) {
        CacheService.invalidate('children');
      }

      return { success: true };

    } catch (error) {
      logger.error('[Database] Unshare patient error:', error);
      throw error;
    }
  }));

  // ============= VACCINATION MODULE HANDLERS =============
  ipcMain.handle('db:get-vaccination-profile', ensureAuthenticated(async (_, childId) => {
    const cacheKey = `child_${childId}`;
    
    // Проверяем кеш
    const cached = CacheService.get('profiles', cacheKey);
    if (cached) {
      logger.debug(`[DB] Cache hit for vaccination profile ${childId}`);
      return cached;
    }

    let profile = await prisma.vaccinationProfile.findUnique({
      where: { childId: Number(childId) },
    });

    if (!profile) {
      profile = await prisma.vaccinationProfile.create({
        data: {
          childId: Number(childId),
          hepBRiskFactors: JSON.stringify([]),
          pneumoRiskFactors: JSON.stringify([]),
          pertussisContraindications: JSON.stringify([]),
          polioRiskFactors: JSON.stringify([]),
          mmrContraindications: JSON.stringify([]),
          meningRiskFactors: JSON.stringify([]),
          varicellaRiskFactors: JSON.stringify([]),
          hepaRiskFactors: JSON.stringify([]),
          fluRiskFactors: JSON.stringify([]),
          hpvRiskFactors: JSON.stringify([]),
          tbeRiskFactors: JSON.stringify([]),
          rotaRiskFactors: JSON.stringify([]),
          birthWeight: null,
          customVaccines: JSON.stringify([]),
        },
      });
    }

    const parsed = {
      id: profile.id,
      childId: profile.childId,
      hepBRiskFactors: JSON.parse(profile.hepBRiskFactors || '[]'),
      pneumoRiskFactors: JSON.parse(profile.pneumoRiskFactors || '[]'),
      pertussisContraindications: JSON.parse(profile.pertussisContraindications || '[]'),
      polioRiskFactors: JSON.parse(profile.polioRiskFactors || '[]'),
      mmrContraindications: JSON.parse(profile.mmrContraindications || '[]'),
      meningRiskFactors: JSON.parse(profile.meningRiskFactors || '[]'),
      varicellaRiskFactors: JSON.parse(profile.varicellaRiskFactors || '[]'),
      hepaRiskFactors: JSON.parse(profile.hepaRiskFactors || '[]'),
      fluRiskFactors: JSON.parse(profile.fluRiskFactors || '[]'),
      hpvRiskFactors: JSON.parse(profile.hpvRiskFactors || '[]'),
      tbeRiskFactors: JSON.parse(profile.tbeRiskFactors || '[]'),
      rotaRiskFactors: JSON.parse(profile.rotaRiskFactors || '[]'),
      birthWeight: profile.birthWeight,
      customVaccines: JSON.parse(profile.customVaccines || '[]'),
      mantouxDate: profile.mantouxDate,
      mantouxResult: profile.mantouxResult,
      createdAt: profile.createdAt,
    };

    // Сохраняем в кеш
    CacheService.set('profiles', cacheKey, parsed);
    
    return parsed;
  }));

  ipcMain.handle('db:update-vaccination-profile', ensureAuthenticated(async (_, profile) => {
    try {
      const validatedProfile = VaccinationProfileSchema.parse(profile);
      const {
        childId,
        hepBRiskFactors,
        pneumoRiskFactors,
        pertussisContraindications,
        polioRiskFactors,
        birthWeight,
        mantouxDate,
        mantouxResult
      } = validatedProfile;

      await prisma.vaccinationProfile.update({
        where: { childId: Number(childId) },
        data: {
          hepBRiskFactors: JSON.stringify(hepBRiskFactors || []),
          pneumoRiskFactors: JSON.stringify(pneumoRiskFactors || []),
          pertussisContraindications: JSON.stringify(pertussisContraindications || []),
          polioRiskFactors: JSON.stringify(polioRiskFactors || []),
          mmrContraindications: JSON.stringify(validatedProfile.mmrContraindications || []),
          meningRiskFactors: JSON.stringify(validatedProfile.meningRiskFactors || []),
          varicellaRiskFactors: JSON.stringify(validatedProfile.varicellaRiskFactors || []),
          hepaRiskFactors: JSON.stringify(validatedProfile.hepaRiskFactors || []),
          fluRiskFactors: JSON.stringify(validatedProfile.fluRiskFactors || []),
          hpvRiskFactors: JSON.stringify(validatedProfile.hpvRiskFactors || []),
          tbeRiskFactors: JSON.stringify(validatedProfile.tbeRiskFactors || []),
          rotaRiskFactors: JSON.stringify(validatedProfile.rotaRiskFactors || []),
          birthWeight,
          mantouxDate,
          mantouxResult,
          customVaccines: JSON.stringify(validatedProfile.customVaccines || []),
        },
      });
      logAudit('VACCINATION_PROFILE_UPDATED', { childId });

      const updated = await prisma.vaccinationProfile.findUnique({
        where: { childId: Number(childId) },
      });
      if (updated) {
        const parsedUpdated = {
          id: updated.id,
          childId: updated.childId,
          hepBRiskFactors: JSON.parse(updated.hepBRiskFactors || '[]'),
          pneumoRiskFactors: JSON.parse(updated.pneumoRiskFactors || '[]'),
          pertussisContraindications: JSON.parse(updated.pertussisContraindications || '[]'),
          polioRiskFactors: JSON.parse(updated.polioRiskFactors || '[]'),
          mmrContraindications: JSON.parse(updated.mmrContraindications || '[]'),
          meningRiskFactors: JSON.parse(updated.meningRiskFactors || '[]'),
          varicellaRiskFactors: JSON.parse(updated.varicellaRiskFactors || '[]'),
          hepaRiskFactors: JSON.parse(updated.hepaRiskFactors || '[]'),
          fluRiskFactors: JSON.parse(updated.fluRiskFactors || '[]'),
          hpvRiskFactors: JSON.parse(updated.hpvRiskFactors || '[]'),
          tbeRiskFactors: JSON.parse(updated.tbeRiskFactors || '[]'),
          rotaRiskFactors: JSON.parse(updated.rotaRiskFactors || '[]'),
          birthWeight: updated.birthWeight,
          customVaccines: JSON.parse(updated.customVaccines || '[]'),
          mantouxDate: updated.mantouxDate,
          mantouxResult: updated.mantouxResult,
          createdAt: updated.createdAt,
        };
        CacheService.set('profiles', `child_${childId}`, parsedUpdated);
      }

      return true;
    } catch (error) {
      logger.error('[Database] Failed to update vaccination profile:', error);
      if (error instanceof z.ZodError) {
        throw new Error(getZodErrorMessage(error));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:get-records', ensureAuthenticated(async (_, childId) => {
    const cacheKey = `child_${childId}`;
    
    // Проверяем кеш
    const cached = CacheService.get('records', cacheKey);
    if (cached) {
      logger.debug(`[DB] Cache hit for vaccination records ${childId}`);
      return cached;
    }

    const records = await prisma.vaccinationRecord.findMany({
      where: { childId: Number(childId) },
    });

    const decrypted = records.map(record => ({
      ...record,
      vaccineBrand: decrypt(record.vaccineBrand),
      notes: decrypt(record.notes),
    }));

    // Сохраняем в кеш
    CacheService.set('records', cacheKey, decrypted);
    
    return decrypted;
  }));

  // Импортируем утилиты для расчета возраста
  const { calculateAgeInMonths } = require('./utils/ageUtils.cjs');

  ipcMain.handle('db:save-record', ensureAuthenticated(async (_, record) => {
    try {
      const validatedRecord = UserVaccineRecordSchema.parse(record);
      const {
        childId,
        vaccineId,
        isCompleted,
        completedDate,
        vaccineBrand,
        notes,
        dose,
        series,
        expiryDate,
        manufacturer,
        ignoreValidation // New flag for import/bypass
      } = validatedRecord;

      logger.info(`[Database] Saving record for child ${childId}, vaccine ${vaccineId}:`, {
        isCompleted,
        dose,
        series,
        expiryDate,
        ignoreValidation
      });

      // Валидация для БЦЖ: проверка требования Манту
      if (vaccineId.startsWith('bcg') && isCompleted && completedDate && !ignoreValidation) {
        // Получаем данные ребенка
        const child = await prisma.child.findUnique({
          where: { id: Number(childId) },
        });

        if (!child) {
          throw new Error('Ребенок не найден');
        }

        const childBirthDate = decrypt(child.birthDate);

        // Вычисляем возраст на момент прививки БЦЖ
        const ageAtVaccination = calculateAgeInMonths(childBirthDate, completedDate);

        // Если ребенку >= 2 месяцев на момент прививки, требуется Манту
        if (ageAtVaccination >= 2) {
          // Получаем профиль вакцинации
          const profile = await prisma.vaccinationProfile.findUnique({
            where: { childId: Number(childId) },
          });

          if (!profile) {
            throw new Error('Профиль вакцинации не найден');
          }

          // Проверяем наличие пробы Манту
          if (!profile.mantouxDate) {
            throw new Error('Внимание: Требуется проба Манту перед вакцинацией БЦЖ (ребенку > 2 мес на момент прививки).');
          }

          // Проверяем результат Манту (если положительная - запрещено)
          if (profile.mantouxResult === true) {
            throw new Error('Вакцинация запрещена: Проба Манту положительная. Необходима консультация фтизиатра.');
          }
        }
      }

      await prisma.vaccinationRecord.upsert({
        where: {
          childId_vaccineId: {
            childId: Number(childId),
            vaccineId: vaccineId,
          },
        },
        update: {
          isCompleted,
          completedDate,
          vaccineBrand: encrypt(vaccineBrand),
          notes: encrypt(notes),
          dose,
          series,
          expiryDate,
          manufacturer
        },
        create: {
          childId: Number(childId),
          vaccineId,
          isCompleted,
          completedDate,
          vaccineBrand: encrypt(vaccineBrand),
          notes: encrypt(notes),
          dose,
          series,
          expiryDate,
          manufacturer
        },
      });
      logAudit('VACCINATION_RECORD_SAVED', { childId, vaccineId, isCompleted });

      const freshRecords = await prisma.vaccinationRecord.findMany({
        where: { childId: Number(childId) },
      });
      const decryptedFresh = freshRecords.map(r => ({
        ...r,
        vaccineBrand: decrypt(r.vaccineBrand),
        notes: decrypt(r.notes),
      }));
      CacheService.set('records', `child_${childId}`, decryptedFresh);

      return true;
    } catch (error) {
      logger.error('[Database] Failed to save vaccination record:', error);
      if (error instanceof z.ZodError) {
        throw new Error(getZodErrorMessage(error));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:delete-record', ensureAuthenticated(async (_, childId, vaccineId) => {
    try {
      await prisma.vaccinationRecord.delete({
        where: {
          childId_vaccineId: {
            childId: Number(childId),
            vaccineId: vaccineId,
          },
        },
      });
      logAudit('VACCINATION_RECORD_DELETED', { childId, vaccineId });

      const freshRecords = await prisma.vaccinationRecord.findMany({
        where: { childId: Number(childId) },
      });
      const decryptedFresh = freshRecords.map(r => ({
        ...r,
        vaccineBrand: decrypt(r.vaccineBrand),
        notes: decrypt(r.notes),
      }));
      CacheService.set('records', `child_${childId}`, decryptedFresh);

      return true;
    } catch (error) {
      logger.error('[Database] Failed to delete vaccination record:', error);
      throw error;
    }
  }));

  ipcMain.handle('db:get-vaccine-catalog', ensureAuthenticated(async () => {
    const cacheKey = 'global';
    const cached = CacheService.get('vaccineCatalog', cacheKey);
    if (cached) {
      logger.debug('[DB] Cache hit for vaccine catalog');
      return cached;
    }

    const entries = await prisma.vaccineCatalogEntry.findMany({
      orderBy: [
        { isDeleted: 'asc' },
        { ageMonthStart: 'asc' },
        { name: 'asc' },
      ],
    });

    const plans = await prisma.vaccinePlanTemplate.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });

    const parsedEntries = entries.map((entry) => ({
      ...entry,
      availableBrands: JSON.parse(entry.availableBrands || '[]'),
    }));

    const expandedPlanEntries = plans.flatMap((plan) => {
      const doses = JSON.parse(plan.doses || '[]');
      const availableBrands = JSON.parse(plan.availableBrands || '[]');

      return doses
        .map((dose, index) => ({
          vaccineId: `${plan.vaccineBaseId}-${index + 1}`,
          name: `${plan.name} (доза ${index + 1})`,
          disease: plan.disease,
          ageMonthStart: Number(dose.ageMonthStart ?? 0),
          minIntervalDays: dose.minIntervalDays ?? null,
          description: plan.description,
          isLive: plan.isLive,
          isRecommended: plan.isRecommended,
          lectureId: plan.lectureId,
          availableBrands,
          isDeleted: false,
          planId: plan.planId,
          doseNumber: index + 1,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        }))
        .filter((item) => Number.isFinite(item.ageMonthStart) && item.ageMonthStart >= 0);
    });

    const dedupedMap = new Map();
    [...parsedEntries, ...expandedPlanEntries].forEach((entry) => {
      if (!entry?.vaccineId) return;
      dedupedMap.set(entry.vaccineId, entry);
    });

    const merged = Array.from(dedupedMap.values()).sort((a, b) => {
      if ((a.ageMonthStart || 0) !== (b.ageMonthStart || 0)) {
        return (a.ageMonthStart || 0) - (b.ageMonthStart || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });

    CacheService.set('vaccineCatalog', cacheKey, merged);
    return merged;
  }));

  ipcMain.handle('db:upsert-vaccine-catalog-entry', ensureAuthenticated(async (_, payload) => {
    try {
      const validated = VaccineCatalogEntrySchema.parse(payload);

      const saved = await prisma.vaccineCatalogEntry.upsert({
        where: { vaccineId: validated.vaccineId },
        update: {
          name: validated.name,
          disease: validated.disease,
          ageMonthStart: validated.ageMonthStart,
          description: validated.description || null,
          requiredRiskFactor: validated.requiredRiskFactor || null,
          excludedRiskFactor: validated.excludedRiskFactor || null,
          isLive: Boolean(validated.isLive),
          isRecommended: Boolean(validated.isRecommended),
          lectureId: validated.lectureId || null,
          availableBrands: JSON.stringify(validated.availableBrands || []),
          isDeleted: Boolean(validated.isDeleted),
        },
        create: {
          vaccineId: validated.vaccineId,
          name: validated.name,
          disease: validated.disease,
          ageMonthStart: validated.ageMonthStart,
          description: validated.description || null,
          requiredRiskFactor: validated.requiredRiskFactor || null,
          excludedRiskFactor: validated.excludedRiskFactor || null,
          isLive: Boolean(validated.isLive),
          isRecommended: Boolean(validated.isRecommended),
          lectureId: validated.lectureId || null,
          availableBrands: JSON.stringify(validated.availableBrands || []),
          isDeleted: Boolean(validated.isDeleted),
        },
      });

      CacheService.invalidate('vaccineCatalog', 'global');
      logAudit('VACCINE_CATALOG_UPSERT', { vaccineId: validated.vaccineId });

      return {
        ...saved,
        availableBrands: JSON.parse(saved.availableBrands || '[]'),
      };
    } catch (error) {
      logger.error('[Database] Failed to upsert vaccine catalog entry:', error);
      if (error instanceof z.ZodError) {
        throw new Error(getZodErrorMessage(error));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:set-vaccine-catalog-entry-deleted', ensureAuthenticated(async (_, vaccineId, isDeleted) => {
    try {
      const updated = await prisma.vaccineCatalogEntry.upsert({
        where: { vaccineId: String(vaccineId) },
        update: {
          isDeleted: Boolean(isDeleted),
        },
        create: {
          vaccineId: String(vaccineId),
          name: String(vaccineId),
          disease: 'Не указано',
          ageMonthStart: 0,
          isDeleted: Boolean(isDeleted),
        },
      });

      CacheService.invalidate('vaccineCatalog', 'global');
      logAudit('VACCINE_CATALOG_SET_DELETED', { vaccineId, isDeleted: Boolean(isDeleted) });

      return {
        ...updated,
        availableBrands: JSON.parse(updated.availableBrands || '[]'),
      };
    } catch (error) {
      logger.error('[Database] Failed to mark vaccine catalog entry deleted:', error);
      throw error;
    }
  }));

  ipcMain.handle('db:get-vaccine-plans', ensureAuthenticated(async () => {
    const plans = await prisma.vaccinePlanTemplate.findMany({
      orderBy: [{ isDeleted: 'asc' }, { createdAt: 'asc' }],
    });

    return plans.map((plan) => ({
      ...plan,
      doses: JSON.parse(plan.doses || '[]'),
      availableBrands: JSON.parse(plan.availableBrands || '[]'),
    }));
  }));

  ipcMain.handle('db:upsert-vaccine-plan', ensureAuthenticated(async (_, payload) => {
    try {
      const validated = VaccinePlanTemplateSchema.parse(payload);

      const saved = await prisma.vaccinePlanTemplate.upsert({
        where: { planId: validated.planId },
        update: {
          vaccineBaseId: validated.vaccineBaseId,
          name: validated.name,
          disease: validated.disease,
          description: validated.description || null,
          isLive: Boolean(validated.isLive),
          isRecommended: Boolean(validated.isRecommended),
          availableBrands: JSON.stringify(validated.availableBrands || []),
          lectureId: validated.lectureId || null,
          doses: JSON.stringify(validated.doses || []),
          isDeleted: Boolean(validated.isDeleted),
        },
        create: {
          planId: validated.planId,
          vaccineBaseId: validated.vaccineBaseId,
          name: validated.name,
          disease: validated.disease,
          description: validated.description || null,
          isLive: Boolean(validated.isLive),
          isRecommended: Boolean(validated.isRecommended),
          availableBrands: JSON.stringify(validated.availableBrands || []),
          lectureId: validated.lectureId || null,
          doses: JSON.stringify(validated.doses || []),
          isDeleted: Boolean(validated.isDeleted),
        },
      });

      CacheService.invalidate('vaccineCatalog', 'global');
      logAudit('VACCINE_PLAN_UPSERT', { planId: validated.planId, vaccineBaseId: validated.vaccineBaseId });

      return {
        ...saved,
        doses: JSON.parse(saved.doses || '[]'),
        availableBrands: JSON.parse(saved.availableBrands || '[]'),
      };
    } catch (error) {
      logger.error('[Database] Failed to upsert vaccine plan:', error);
      if (error instanceof z.ZodError) {
        throw new Error(getZodErrorMessage(error));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:set-vaccine-plan-deleted', ensureAuthenticated(async (_, planId, isDeleted) => {
    try {
      const updated = await prisma.vaccinePlanTemplate.update({
        where: { planId: String(planId) },
        data: { isDeleted: Boolean(isDeleted) },
      });

      CacheService.invalidate('vaccineCatalog', 'global');
      logAudit('VACCINE_PLAN_SET_DELETED', { planId, isDeleted: Boolean(isDeleted) });

      return {
        ...updated,
        doses: JSON.parse(updated.doses || '[]'),
        availableBrands: JSON.parse(updated.availableBrands || '[]'),
      };
    } catch (error) {
      logger.error('[Database] Failed to set vaccine plan deleted:', error);
      throw error;
    }
  }));

  /**
   * Manual backup trigger
   */
  ipcMain.handle('db:create-backup', ensureAuthenticated(async () => {
    return await createBackup(dbPath);
  }));
}

module.exports = { setupDatabaseHandlers };
