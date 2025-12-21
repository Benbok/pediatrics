const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { app, ipcMain } = require('electron');

const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const BetterSqlite3 = require('better-sqlite3');

const isDev = !app.isPackaged;

// Use the local Prisma DB in dev mode to stay in sync with CLI tools (Prisma Studio/Migrate)
// Use the standard userData path in production
const dbPath = isDev
  ? path.join(__dirname, '../prisma/dev.db')
  : path.join(app.getPath('userData'), 'pediatrics.db');

const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`
});
const prisma = new PrismaClient({ adapter });

// Initialize Database (Schema synchronization)
async function initDatabase() {
  try {
    // In a production Electron app, we'd typically use 'npx prisma migrate deploy'
    // but Prisma Client doesn't natively run migrations from JS without CLI.
    // For now, we rely on the schema being pushed/migrated during dev.
    // We can use $connect to verify the connection.
    await prisma.$connect();
    console.log('Database connected with Prisma at:', dbPath);
  } catch (error) {
    console.error('Failed to initialize Prisma database:', error);
  }
}

function setupDatabaseHandlers() {
  initDatabase();

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
    const { name, surname, patronymic, birthDate, gender } = child;
    return await prisma.child.create({
      data: {
        name,
        surname,
        patronymic,
        birthDate,
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
    const { name, surname, patronymic, birthDate, gender } = updates;
    await prisma.child.update({
      where: { id: Number(id) },
      data: { name, surname, patronymic, birthDate, gender },
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
    const { childId, vaccineId, isCompleted, completedDate, vaccineBrand, notes } = record;

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
      },
      create: {
        childId: Number(childId),
        vaccineId,
        isCompleted,
        completedDate,
        vaccineBrand,
        notes,
      },
    });
    return true;
  });
}

module.exports = { setupDatabaseHandlers };
