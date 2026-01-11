const { app, ipcMain } = require('electron');
const path = require('path');
const { z } = require('zod');
const { ensureAuthenticated } = require('./auth.cjs');
const { encrypt, decrypt } = require('./crypto.cjs');
const { logger, logAudit } = require('./logger.cjs');
const { createBackup, shouldBackupToday } = require('./backup.cjs');

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
  birthWeight: z.number()
    .min(500, 'Вес при рождении должен быть не менее 500 г')
    .max(8000, 'Вес при рождении должен быть не более 8000 г'),
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

// Configure Prisma paths BEFORE importing Prisma Client
const isDev = !app.isPackaged;
if (!isDev) {
  // In production, Prisma files are in resources/app/node_modules
  const appPath = app.getAppPath();
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(appPath, 'node_modules', '.prisma', 'client', 'libquery_engine-windows.dll.node');
  process.env.PRISMA_SCHEMA_ENGINE_BINARY = path.join(appPath, 'node_modules', '.prisma', 'client', 'schema-engine-windows.exe');
  console.log('[Database] Prisma paths set for production:');
  console.log('  Engine:', process.env.PRISMA_QUERY_ENGINE_LIBRARY);
  console.log('  App path:', appPath);
}

const { PrismaClient } = require('@prisma/client');

const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const BetterSqlite3 = require('better-sqlite3');

// Use the local Prisma DB in dev mode to stay in sync with CLI tools (Prisma Studio/Migrate)
// Use the standard userData path in production
const dbPath = isDev
  ? path.join(__dirname, '../prisma/dev.db')
  : path.join(app.getPath('userData'), 'pediatrics.db');

logger.info(`[Database] Initializing with isDev=${isDev}`);
logger.info(`[Database] DB Path: ${dbPath}`);
logger.info(`[Database] __dirname: ${__dirname}`);

const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`
});
const prisma = new PrismaClient({
  adapter,
  log: isDev ? ['query', 'info', 'warn', 'error'] : ['error']
});

// Initialize Database (Schema synchronization)
async function initDatabase() {
  logger.info('[Database] ========== INIT START ==========');
  logger.info('[Database] isDev:', isDev);
  logger.info('[Database] dbPath:', dbPath);

  try {
    logger.info('[Database] Connecting to Prisma...');
    await prisma.$connect();
    logger.info('[Database] Connected at:', dbPath);

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
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
            FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
            UNIQUE(child_id, vaccine_id)
          );
        `);

        logger.info('[Database] Schema created successfully');
      }
    }

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
    const children = await prisma.child.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt sensitive fields
    return children.map(child => ({
      ...child,
      name: decrypt(child.name),
      surname: decrypt(child.surname),
      patronymic: decrypt(child.patronymic),
      birthDate: decrypt(child.birthDate),
    }));
  }));

  ipcMain.handle('db:get-child', ensureAuthenticated(async (_, id) => {
    const child = await prisma.child.findUnique({
      where: { id: Number(id) },
    });

    if (!child) return null;

    return {
      ...child,
      name: decrypt(child.name),
      surname: decrypt(child.surname),
      patronymic: decrypt(child.patronymic),
      birthDate: decrypt(child.birthDate),
    };
  }));

  ipcMain.handle('db:create-child', ensureAuthenticated(async (_, child) => {
    try {
      const validatedChild = ChildProfileSchema.parse(child);
      const { name, surname, patronymic, birthDate, birthWeight, gender } = validatedChild;

      const newChild = await prisma.child.create({
        data: {
          name: encrypt(name),
          surname: encrypt(surname),
          patronymic: encrypt(patronymic),
          birthDate: encrypt(String(birthDate)),
          birthWeight: Number(birthWeight) || 0,
          gender,
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
      logAudit('PATIENT_CREATED', { childId: newChild.id, name, surname });
      return newChild;
    } catch (error) {
      logger.error('[Database] Failed to create child:', error);
      if (error instanceof z.ZodError) {
        throw new Error(error.errors.map(e => e.message).join(', '));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:update-child', ensureAuthenticated(async (_, id, updates) => {
    try {
      const validatedUpdates = ChildProfileSchema.partial().parse(updates);
      const { name, surname, patronymic, birthDate, gender, birthWeight } = validatedUpdates;

      const dataToUpdate = {};
      if (name) dataToUpdate.name = encrypt(name);
      if (surname) dataToUpdate.surname = encrypt(surname);
      if (patronymic) dataToUpdate.patronymic = encrypt(patronymic);
      if (birthDate) dataToUpdate.birthDate = encrypt(String(birthDate));
      if (gender) dataToUpdate.gender = gender;
      if (birthWeight !== undefined) dataToUpdate.birthWeight = birthWeight;

      await prisma.child.update({
        where: { id: Number(id) },
        data: dataToUpdate,
      });
      logAudit('PATIENT_UPDATED', { childId: id, updates: Object.keys(dataToUpdate) });
      return true;
    } catch (error) {
      logger.error('[Database] Failed to update child:', error);
      if (error instanceof z.ZodError) {
        throw new Error(error.errors.map(e => e.message).join(', '));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:delete-child', ensureAuthenticated(async (_, id) => {
    await prisma.child.delete({
      where: { id: Number(id) },
    });
    logAudit('PATIENT_DELETED', { childId: id });
    return true;
  }));

  // ============= VACCINATION MODULE HANDLERS =============
  ipcMain.handle('db:get-vaccination-profile', ensureAuthenticated(async (_, childId) => {
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
          customVaccines: JSON.stringify([]),
        },
      });
    }

    return {
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
      customVaccines: JSON.parse(profile.customVaccines || '[]'),
      mantouxDate: profile.mantouxDate,
      mantouxResult: profile.mantouxResult,
      createdAt: profile.createdAt,
    };
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
          mantouxDate,
          mantouxResult,
          customVaccines: JSON.stringify(validatedProfile.customVaccines || []),
        },
      });
      logAudit('VACCINATION_PROFILE_UPDATED', { childId });
      return true;
    } catch (error) {
      logger.error('[Database] Failed to update vaccination profile:', error);
      if (error instanceof z.ZodError) {
        throw new Error(error.errors.map(e => e.message).join(', '));
      }
      throw error;
    }
  }));

  ipcMain.handle('db:get-records', ensureAuthenticated(async (_, childId) => {
    const records = await prisma.vaccinationRecord.findMany({
      where: { childId: Number(childId) },
    });

    return records.map(record => ({
      ...record,
      vaccineBrand: decrypt(record.vaccineBrand),
      notes: decrypt(record.notes),
    }));
  }));

  /**
   * Вычисляет возраст ребенка в месяцах на конкретную дату
   */
  function calculateAgeAtDate(birthDateStr, targetDate) {
    const birthDate = new Date(birthDateStr);
    const target = new Date(targetDate);
    const diffTime = Math.abs(target.getTime() - birthDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
  }

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

        // Вычисляем возраст на момент прививки БЦЖ
        const ageAtVaccination = calculateAgeAtDate(child.birthDate, completedDate);

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
      return true;
    } catch (error) {
      logger.error('[Database] Failed to save vaccination record:', error);
      if (error instanceof z.ZodError) {
        throw new Error(error.errors.map(e => e.message).join(', '));
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
      return true;
    } catch (error) {
      logger.error('[Database] Failed to delete vaccination record:', error);
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
