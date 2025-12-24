const path = require('path');
const { app, ipcMain } = require('electron');

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

console.log(`[Database] Initializing with isDev=${isDev}`);
console.log(`[Database] DB Path: ${dbPath}`);
console.log(`[Database] __dirname: ${__dirname}`);

const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`
});
const prisma = new PrismaClient({
  adapter,
  log: isDev ? ['query', 'info', 'warn', 'error'] : ['error']
});

// Initialize Database (Schema synchronization)
async function initDatabase() {
  console.log('[Database] ========== INIT START ==========');
  console.log('[Database] isDev:', isDev);
  console.log('[Database] dbPath:', dbPath);

  try {
    console.log('[Database] Connecting to Prisma...');
    await prisma.$connect();
    console.log('[Database] Connected at:', dbPath);

    // In production, check if schema exists and is correct
    if (!isDev) {
      console.log('[Database] Production mode - checking schema...');
      let schemaIsValid = false;

      try {
        // Check if table exists AND has the surname column (key column)
        const result = await prisma.$queryRawUnsafe(
          `SELECT name FROM pragma_table_info('children') WHERE name = 'surname'`
        );
        schemaIsValid = Array.isArray(result) && result.length > 0;
        console.log('[Database] Schema check result:', schemaIsValid ? 'VALID' : 'INVALID or MISSING');
      } catch (error) {
        console.log('[Database] Schema check error:', error.message);
        schemaIsValid = false;
      }

      if (!schemaIsValid) {
        console.log('[Database] Dropping old tables and creating new schema...');

        // Drop existing tables (order matters due to foreign keys)
        try {
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS vaccination_records`);
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS vaccination_profiles`);
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS children`);
          console.log('[Database] Old tables dropped');
        } catch (e) {
          console.log('[Database] Drop error (ignoring):', e.message);
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

        console.log('[Database] Schema created successfully');
      }
    }

    console.log('[Database] ========== INIT COMPLETE ==========');
  } catch (error) {
    console.error('[Database] ========== INIT FAILED ==========');
    console.error('[Database] Error details:', error);
    console.error('[Database] Error stack:', error.stack);
  }
}

async function setupDatabaseHandlers() {
  console.log('[Database] ========== SETUP START ==========');
  console.log('[Database] Calling initDatabase...');
  await initDatabase();
  console.log('[Database] initDatabase completed');
  console.log('[Database] Registering IPC handlers...');

  // ============= PATIENTS MODULE HANDLERS =============
  ipcMain.handle('db:get-children', async () => {
    return await prisma.child.findMany({
      orderBy: { createdAt: 'desc' },
    });
  });

  ipcMain.handle('db:get-child', async (_, id) => {
    return await prisma.child.findUnique({
      where: { id: Number(id) },
    });
  });

  ipcMain.handle('db:create-child', async (_, child) => {
    const { name, surname, patronymic, birthDate, birthWeight, gender } = child;
    return await prisma.child.create({
      data: {
        name,
        surname,
        patronymic,
        birthDate: String(birthDate),
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
  });

  ipcMain.handle('db:update-child', async (_, id, updates) => {
    const { name, surname, patronymic, birthDate, gender, birthWeight } = updates;
    await prisma.child.update({
      where: { id: Number(id) },
      data: { name, surname, patronymic, birthDate, gender, birthWeight },
    });
    return true;
  });

  ipcMain.handle('db:delete-child', async (_, id) => {
    await prisma.child.delete({
      where: { id: Number(id) },
    });
    return true;
  });

  // ============= VACCINATION MODULE HANDLERS =============
  ipcMain.handle('db:get-vaccination-profile', async (_, childId) => {
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
  });

  ipcMain.handle('db:update-vaccination-profile', async (_, profile) => {
    const {
      childId,
      hepBRiskFactors,
      pneumoRiskFactors,
      pertussisContraindications,
      polioRiskFactors,
      mantouxDate,
      mantouxResult
    } = profile;

    await prisma.vaccinationProfile.update({
      where: { childId: Number(childId) },
      data: {
        hepBRiskFactors: JSON.stringify(hepBRiskFactors || []),
        pneumoRiskFactors: JSON.stringify(pneumoRiskFactors || []),
        pertussisContraindications: JSON.stringify(pertussisContraindications || []),
        polioRiskFactors: JSON.stringify(polioRiskFactors || []),
        mmrContraindications: JSON.stringify(profile.mmrContraindications || []),
        meningRiskFactors: JSON.stringify(profile.meningRiskFactors || []),
        varicellaRiskFactors: JSON.stringify(profile.varicellaRiskFactors || []),
        hepaRiskFactors: JSON.stringify(profile.hepaRiskFactors || []),
        fluRiskFactors: JSON.stringify(profile.fluRiskFactors || []),
        hpvRiskFactors: JSON.stringify(profile.hpvRiskFactors || []),
        tbeRiskFactors: JSON.stringify(profile.tbeRiskFactors || []),
        rotaRiskFactors: JSON.stringify(profile.rotaRiskFactors || []),
        mantouxDate,
        mantouxResult,
        customVaccines: JSON.stringify(profile.customVaccines || []),
      },
    });
    return true;
  });

  ipcMain.handle('db:get-records', async (_, childId) => {
    const records = await prisma.vaccinationRecord.findMany({
      where: { childId: Number(childId) },
    });
    return records;
  });

  ipcMain.handle('db:save-record', async (_, record) => {
    try {
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
        manufacturer
      } = record;

      console.log(`[Database] Saving record for child ${childId}, vaccine ${vaccineId}:`, {
        isCompleted,
        dose,
        series,
        expiryDate
      });

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
          vaccineBrand,
          notes,
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
          vaccineBrand,
          notes,
          dose,
          series,
          expiryDate,
          manufacturer
        },
      });
      return true;
    } catch (error) {
      console.error('[Database] Failed to save vaccination record:', error);
      throw error;
    }
  });
}

module.exports = { setupDatabaseHandlers };
