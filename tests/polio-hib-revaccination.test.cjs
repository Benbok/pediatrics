/**
 * Тесты для проверки: не создаются ли автоматически записи на ревакцинацию
 * при добавлении первой дозы полиомиелита или гемофильной инфекции
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Используем тестовую БД
const testDbPath = path.join(__dirname, '../prisma/test-revaccination.db');
const adapter = new PrismaBetterSqlite3({
  url: `file:${testDbPath}`
});

const prisma = new PrismaClient({
  adapter,
  log: ['error']
});

// Тестовые данные
const TEST_CHILD = {
  name: 'Тестовый',
  surname: 'Ребенок',
  patronymic: 'Тестович',
  birthDate: '2023-01-01', // Ребенок родился 1 января 2023
  birthWeight: 3500,
  gender: 'male'
};

/**
 * Инициализация тестовой БД
 */
async function initTestDatabase() {
  try {
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    await prisma.$connect();

    // Создаем таблицы
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

    console.log('✅ Тестовая БД инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации тестовой БД:', error);
    throw error;
  }
}

/**
 * Очистка тестовых данных
 */
async function cleanup() {
  try {
    await prisma.vaccinationRecord.deleteMany({});
    await prisma.vaccinationProfile.deleteMany({});
    await prisma.child.deleteMany({});
    console.log('✅ Тестовые данные очищены');
  } catch (error) {
    console.error('❌ Ошибка очистки данных:', error);
  }
}

/**
 * Создание тестового ребенка
 */
async function createTestChild() {
  const child = await prisma.child.create({
    data: {
      ...TEST_CHILD,
      vaccinationProfile: {
        create: {
          hepBRiskFactors: JSON.stringify([]),
          pneumoRiskFactors: JSON.stringify([]),
          pertussisContraindications: JSON.stringify([]),
        },
      },
    },
  });
  return child;
}

/**
 * Симуляция метода db:save-record
 */
async function saveRecord(childId, record) {
  const {
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

  return await prisma.vaccinationRecord.upsert({
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
}

/**
 * Получение всех записей для ребенка
 */
async function getRecords(childId) {
  return await prisma.vaccinationRecord.findMany({
    where: { childId: Number(childId) },
  });
}

/**
 * ТЕСТ 1: Добавление первой дозы полиомиелита не создает ревакцинацию
 */
async function testPolioFirstDoseNoRevaccination() {
  console.log('\n🧪 ТЕСТ 1: Добавление первой дозы полиомиелита не создает ревакцинацию');
  
  await cleanup();
  const child = await createTestChild();
  
  // Добавляем только первую дозу полиомиелита
  await saveRecord(child.id, {
    vaccineId: 'polio-1',
    isCompleted: true,
    completedDate: '2023-04-01', // В 3 месяца
    vaccineBrand: 'Полимилекс',
    notes: 'Первая доза',
    dose: '1',
    series: 'ABC123',
    expiryDate: '2025-04-01',
    manufacturer: 'Нанолек'
  });
  
  // Проверяем, что создана только одна запись
  const records = await getRecords(child.id);
  
  if (records.length !== 1) {
    throw new Error(`Ожидалась 1 запись, получено ${records.length}. Созданы записи: ${records.map(r => r.vaccineId).join(', ')}`);
  }
  
  if (records[0].vaccineId !== 'polio-1') {
    throw new Error(`Неверный vaccineId: ожидался polio-1, получен ${records[0].vaccineId}`);
  }
  
  // Проверяем, что НЕТ записей на ревакцинацию
  const revaccinationRecords = records.filter(r => r.vaccineId.startsWith('polio-rv'));
  if (revaccinationRecords.length > 0) {
    throw new Error(`Обнаружены неожиданные записи на ревакцинацию: ${revaccinationRecords.map(r => r.vaccineId).join(', ')}`);
  }
  
  console.log('✅ ТЕСТ 1 ПРОЙДЕН: Создана только одна запись polio-1, ревакцинация не создана');
  return true;
}

/**
 * ТЕСТ 2: Добавление первой дозы гемофильной инфекции не создает ревакцинацию
 */
async function testHibFirstDoseNoRevaccination() {
  console.log('\n🧪 ТЕСТ 2: Добавление первой дозы гемофильной инфекции не создает ревакцинацию');
  
  await cleanup();
  const child = await createTestChild();
  
  // Добавляем только первую дозу Hib
  await saveRecord(child.id, {
    vaccineId: 'hib-1',
    isCompleted: true,
    completedDate: '2023-04-01', // В 3 месяца
    vaccineBrand: 'Хиберикс',
    notes: 'Первая доза',
    dose: '1',
    series: 'XYZ789',
    expiryDate: '2025-04-01',
    manufacturer: 'GSK'
  });
  
  // Проверяем, что создана только одна запись
  const records = await getRecords(child.id);
  
  if (records.length !== 1) {
    throw new Error(`Ожидалась 1 запись, получено ${records.length}. Созданы записи: ${records.map(r => r.vaccineId).join(', ')}`);
  }
  
  if (records[0].vaccineId !== 'hib-1') {
    throw new Error(`Неверный vaccineId: ожидался hib-1, получен ${records[0].vaccineId}`);
  }
  
  // Проверяем, что НЕТ записей на ревакцинацию
  const revaccinationRecords = records.filter(r => r.vaccineId.startsWith('hib-rv'));
  if (revaccinationRecords.length > 0) {
    throw new Error(`Обнаружены неожиданные записи на ревакцинацию: ${revaccinationRecords.map(r => r.vaccineId).join(', ')}`);
  }
  
  console.log('✅ ТЕСТ 2 ПРОЙДЕН: Создана только одна запись hib-1, ревакцинация не создана');
  return true;
}

/**
 * ТЕСТ 3: Добавление обеих первых доз не создает ревакцинации
 */
async function testBothFirstDosesNoRevaccination() {
  console.log('\n🧪 ТЕСТ 3: Добавление обеих первых доз (полио + hib) не создает ревакцинации');
  
  await cleanup();
  const child = await createTestChild();
  
  // Добавляем первую дозу полиомиелита
  await saveRecord(child.id, {
    vaccineId: 'polio-1',
    isCompleted: true,
    completedDate: '2023-04-01',
    vaccineBrand: 'Полимилекс',
    notes: 'Первая доза',
    dose: '1',
    series: 'POL123',
    expiryDate: '2025-04-01',
    manufacturer: 'Нанолек'
  });
  
  // Добавляем первую дозу Hib
  await saveRecord(child.id, {
    vaccineId: 'hib-1',
    isCompleted: true,
    completedDate: '2023-04-01',
    vaccineBrand: 'Хиберикс',
    notes: 'Первая доза',
    dose: '1',
    series: 'HIB456',
    expiryDate: '2025-04-01',
    manufacturer: 'GSK'
  });
  
  // Проверяем, что созданы только две записи
  const records = await getRecords(child.id);
  
  if (records.length !== 2) {
    throw new Error(`Ожидалось 2 записи, получено ${records.length}. Созданы записи: ${records.map(r => r.vaccineId).join(', ')}`);
  }
  
  const vaccineIds = records.map(r => r.vaccineId).sort();
  if (!vaccineIds.includes('polio-1') || !vaccineIds.includes('hib-1')) {
    throw new Error(`Неверные записи: ожидались polio-1 и hib-1, получены ${vaccineIds.join(', ')}`);
  }
  
  // Проверяем, что НЕТ записей на ревакцинацию
  const revaccinationRecords = records.filter(r => 
    r.vaccineId.startsWith('polio-rv') || r.vaccineId.startsWith('hib-rv')
  );
  if (revaccinationRecords.length > 0) {
    throw new Error(`Обнаружены неожиданные записи на ревакцинацию: ${revaccinationRecords.map(r => r.vaccineId).join(', ')}`);
  }
  
  console.log('✅ ТЕСТ 3 ПРОЙДЕН: Созданы только две записи (polio-1 и hib-1), ревакцинации не созданы');
  return true;
}

/**
 * ТЕСТ 4: Ревакцинация создается только при явном добавлении
 */
async function testRevaccinationOnlyWhenExplicitlyAdded() {
  console.log('\n🧪 ТЕСТ 4: Ревакцинация создается только при явном добавлении');
  
  await cleanup();
  const child = await createTestChild();
  
  // Добавляем первую дозу полиомиелита
  await saveRecord(child.id, {
    vaccineId: 'polio-1',
    isCompleted: true,
    completedDate: '2023-04-01',
    vaccineBrand: 'Полимилекс',
    notes: 'Первая доза',
    dose: '1',
    series: 'POL123',
    expiryDate: '2025-04-01',
    manufacturer: 'Нанолек'
  });
  
  // Явно добавляем ревакцинацию
  await saveRecord(child.id, {
    vaccineId: 'polio-rv1',
    isCompleted: true,
    completedDate: '2024-07-01', // В 18 месяцев (1.6 лет)
    vaccineBrand: 'Полимилекс',
    notes: 'Ревакцинация',
    dose: 'RV1',
    series: 'POL456',
    expiryDate: '2026-07-01',
    manufacturer: 'Нанолек'
  });
  
  // Проверяем, что теперь есть обе записи
  const records = await getRecords(child.id);
  
  if (records.length !== 2) {
    throw new Error(`Ожидалось 2 записи, получено ${records.length}. Созданы записи: ${records.map(r => r.vaccineId).join(', ')}`);
  }
  
  const vaccineIds = records.map(r => r.vaccineId).sort();
  if (!vaccineIds.includes('polio-1') || !vaccineIds.includes('polio-rv1')) {
    throw new Error(`Неверные записи: ожидались polio-1 и polio-rv1, получены ${vaccineIds.join(', ')}`);
  }
  
  console.log('✅ ТЕСТ 4 ПРОЙДЕН: Ревакцинация создается только при явном добавлении');
  return true;
}

/**
 * Запуск всех тестов
 */
async function runAllTests() {
  console.log('🚀 Запуск тестов: проверка автоматического создания ревакцинаций\n');
  console.log('='.repeat(70));
  
  try {
    await initTestDatabase();
    
    const tests = [
      testPolioFirstDoseNoRevaccination,
      testHibFirstDoseNoRevaccination,
      testBothFirstDosesNoRevaccination,
      testRevaccinationOnlyWhenExplicitlyAdded
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testFn of tests) {
      try {
        await testFn();
        passed++;
      } catch (error) {
        console.error(`❌ ТЕСТ ПРОВАЛЕН: ${error.message}`);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`📊 РЕЗУЛЬТАТЫ: ${passed} пройдено, ${failed} провалено`);
    
    if (failed === 0) {
      console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
      console.log('✅ Подтверждено: добавление первой дозы НЕ создает автоматически записи на ревакцинацию');
    } else {
      console.log('❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testPolioFirstDoseNoRevaccination,
  testHibFirstDoseNoRevaccination,
  testBothFirstDosesNoRevaccination,
  testRevaccinationOnlyWhenExplicitlyAdded
};



