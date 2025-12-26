/**
 * Тесты для бэкенда записей прививок
 * 
 * Проверяет:
 * 1. Добавление одной записи не создает смежные записи
 * 2. Редактирование записи работает корректно
 * 3. Удаление записи работает корректно
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const BetterSqlite3 = require('better-sqlite3');

// Используем тестовую БД
const testDbPath = path.join(__dirname, '../prisma/test.db');
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
  birthDate: '2020-01-01',
  birthWeight: 3500,
  gender: 'male'
};

const TEST_VACCINE_1 = {
  vaccineId: 'hep_b_1',
  isCompleted: true,
  completedDate: '2020-01-15',
  vaccineBrand: 'Энджерикс В',
  notes: 'Первая доза',
  dose: '1',
  series: 'ABC123',
  expiryDate: '2025-01-15',
  manufacturer: 'GSK'
};

const TEST_VACCINE_2 = {
  vaccineId: 'dtp_1',
  isCompleted: true,
  completedDate: '2020-02-01',
  vaccineBrand: 'Инфанрикс',
  notes: 'Первая доза АКДС',
  dose: '1',
  series: 'XYZ789',
  expiryDate: '2025-02-01',
  manufacturer: 'GSK'
};

const TEST_VACCINE_3 = {
  vaccineId: 'bcg_1',
  isCompleted: false,
  completedDate: null,
  vaccineBrand: null,
  notes: null,
  dose: null,
  series: null,
  expiryDate: null,
  manufacturer: null
};

/**
 * Инициализация тестовой БД
 */
async function initTestDatabase() {
  try {
    // Удаляем старую тестовую БД если существует
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
 * Симуляция метода db:delete-record
 */
async function deleteRecord(childId, vaccineId) {
  return await prisma.vaccinationRecord.delete({
    where: {
      childId_vaccineId: {
        childId: Number(childId),
        vaccineId: vaccineId,
      },
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
 * ТЕСТ 1: Добавление одной записи не создает смежные записи
 */
async function testSingleRecordCreation() {
  console.log('\n🧪 ТЕСТ 1: Добавление одной записи не создает смежные записи');
  
  await cleanup();
  const child = await createTestChild();
  
  // Добавляем только одну запись
  await saveRecord(child.id, TEST_VACCINE_1);
  
  // Проверяем, что создана только одна запись
  const records = await getRecords(child.id);
  
  if (records.length !== 1) {
    throw new Error(`Ожидалась 1 запись, получено ${records.length}`);
  }
  
  if (records[0].vaccineId !== TEST_VACCINE_1.vaccineId) {
    throw new Error(`Неверный vaccineId: ожидался ${TEST_VACCINE_1.vaccineId}, получен ${records[0].vaccineId}`);
  }
  
  console.log('✅ ТЕСТ 1 ПРОЙДЕН: Создана только одна запись');
  return true;
}

/**
 * ТЕСТ 2: Добавление нескольких записей работает независимо
 */
async function testMultipleRecordsCreation() {
  console.log('\n🧪 ТЕСТ 2: Добавление нескольких записей работает независимо');
  
  await cleanup();
  const child = await createTestChild();
  
  // Добавляем первую запись
  await saveRecord(child.id, TEST_VACCINE_1);
  let records = await getRecords(child.id);
  if (records.length !== 1) {
    throw new Error(`После первой записи ожидалась 1 запись, получено ${records.length}`);
  }
  
  // Добавляем вторую запись
  await saveRecord(child.id, TEST_VACCINE_2);
  records = await getRecords(child.id);
  if (records.length !== 2) {
    throw new Error(`После второй записи ожидалось 2 записи, получено ${records.length}`);
  }
  
  // Проверяем, что записи независимы
  const record1 = records.find(r => r.vaccineId === TEST_VACCINE_1.vaccineId);
  const record2 = records.find(r => r.vaccineId === TEST_VACCINE_2.vaccineId);
  
  if (!record1 || !record2) {
    throw new Error('Не найдены обе записи');
  }
  
  if (record1.vaccineBrand !== TEST_VACCINE_1.vaccineBrand) {
    throw new Error('Данные первой записи изменены');
  }
  
  if (record2.vaccineBrand !== TEST_VACCINE_2.vaccineBrand) {
    throw new Error('Данные второй записи изменены');
  }
  
  console.log('✅ ТЕСТ 2 ПРОЙДЕН: Несколько записей создаются независимо');
  return true;
}

/**
 * ТЕСТ 3: Редактирование записи работает корректно
 */
async function testRecordUpdate() {
  console.log('\n🧪 ТЕСТ 3: Редактирование записи работает корректно');
  
  await cleanup();
  const child = await createTestChild();
  
  // Создаем запись
  await saveRecord(child.id, TEST_VACCINE_1);
  
  // Редактируем запись (используем тот же vaccineId, но другие данные)
  const updatedData = {
    ...TEST_VACCINE_1,
    vaccineBrand: 'Регевак В',
    notes: 'Обновленная запись',
    dose: '2',
    series: 'NEW456'
  };
  
  await saveRecord(child.id, updatedData);
  
  // Проверяем, что запись обновлена
  const records = await getRecords(child.id);
  
  if (records.length !== 1) {
    throw new Error(`Ожидалась 1 запись после обновления, получено ${records.length}`);
  }
  
  const record = records[0];
  if (record.vaccineBrand !== updatedData.vaccineBrand) {
    throw new Error(`Ожидался бренд ${updatedData.vaccineBrand}, получен ${record.vaccineBrand}`);
  }
  
  if (record.notes !== updatedData.notes) {
    throw new Error(`Ожидались заметки "${updatedData.notes}", получены "${record.notes}"`);
  }
  
  if (record.dose !== updatedData.dose) {
    throw new Error(`Ожидалась доза ${updatedData.dose}, получена ${record.dose}`);
  }
  
  console.log('✅ ТЕСТ 3 ПРОЙДЕН: Редактирование записи работает корректно');
  return true;
}

/**
 * ТЕСТ 4: Удаление записи работает корректно
 */
async function testRecordDeletion() {
  console.log('\n🧪 ТЕСТ 4: Удаление записи работает корректно');
  
  await cleanup();
  const child = await createTestChild();
  
  // Создаем две записи
  await saveRecord(child.id, TEST_VACCINE_1);
  await saveRecord(child.id, TEST_VACCINE_2);
  
  let records = await getRecords(child.id);
  if (records.length !== 2) {
    throw new Error(`Ожидалось 2 записи, получено ${records.length}`);
  }
  
  // Удаляем одну запись
  await deleteRecord(child.id, TEST_VACCINE_1.vaccineId);
  
  // Проверяем, что осталась только одна запись
  records = await getRecords(child.id);
  if (records.length !== 1) {
    throw new Error(`После удаления ожидалась 1 запись, получено ${records.length}`);
  }
  
  // Проверяем, что удалена правильная запись
  if (records[0].vaccineId !== TEST_VACCINE_2.vaccineId) {
    throw new Error(`Осталась не та запись: ожидался ${TEST_VACCINE_2.vaccineId}, получен ${records[0].vaccineId}`);
  }
  
  console.log('✅ ТЕСТ 4 ПРОЙДЕН: Удаление записи работает корректно');
  return true;
}

/**
 * ТЕСТ 5: Удаление несуществующей записи вызывает ошибку
 */
async function testDeleteNonExistentRecord() {
  console.log('\n🧪 ТЕСТ 5: Удаление несуществующей записи вызывает ошибку');
  
  await cleanup();
  const child = await createTestChild();
  
  try {
    await deleteRecord(child.id, 'non_existent_vaccine');
    throw new Error('Ожидалась ошибка при удалении несуществующей записи');
  } catch (error) {
    if (error.code === 'P2025' || error.message.includes('Record to delete does not exist')) {
      console.log('✅ ТЕСТ 5 ПРОЙДЕН: Удаление несуществующей записи вызывает ошибку');
      return true;
    }
    throw error;
  }
}

/**
 * ТЕСТ 6: Upsert создает новую запись если её нет
 */
async function testUpsertCreatesNew() {
  console.log('\n🧪 ТЕСТ 6: Upsert создает новую запись если её нет');
  
  await cleanup();
  const child = await createTestChild();
  
  // Используем upsert для создания новой записи
  await saveRecord(child.id, TEST_VACCINE_1);
  
  const records = await getRecords(child.id);
  if (records.length !== 1) {
    throw new Error(`Ожидалась 1 запись, получено ${records.length}`);
  }
  
  console.log('✅ ТЕСТ 6 ПРОЙДЕН: Upsert создает новую запись');
  return true;
}

/**
 * ТЕСТ 7: Upsert обновляет существующую запись
 */
async function testUpsertUpdatesExisting() {
  console.log('\n🧪 ТЕСТ 7: Upsert обновляет существующую запись');
  
  await cleanup();
  const child = await createTestChild();
  
  // Создаем запись
  await saveRecord(child.id, TEST_VACCINE_1);
  
  // Обновляем через upsert
  const updated = {
    ...TEST_VACCINE_1,
    vaccineBrand: 'Обновленный бренд'
  };
  await saveRecord(child.id, updated);
  
  const records = await getRecords(child.id);
  if (records.length !== 1) {
    throw new Error(`Ожидалась 1 запись, получено ${records.length}`);
  }
  
  if (records[0].vaccineBrand !== updated.vaccineBrand) {
    throw new Error(`Запись не обновлена: ожидался ${updated.vaccineBrand}, получен ${records[0].vaccineBrand}`);
  }
  
  console.log('✅ ТЕСТ 7 ПРОЙДЕН: Upsert обновляет существующую запись');
  return true;
}

/**
 * Запуск всех тестов
 */
async function runAllTests() {
  console.log('🚀 Запуск тестов бэкенда прививок\n');
  console.log('='.repeat(60));
  
  try {
    await initTestDatabase();
    
    const tests = [
      testSingleRecordCreation,
      testMultipleRecordsCreation,
      testRecordUpdate,
      testRecordDeletion,
      testDeleteNonExistentRecord,
      testUpsertCreatesNew,
      testUpsertUpdatesExisting
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
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 РЕЗУЛЬТАТЫ: ${passed} пройдено, ${failed} провалено`);
    
    if (failed === 0) {
      console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
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
  testSingleRecordCreation,
  testMultipleRecordsCreation,
  testRecordUpdate,
  testRecordDeletion,
  testDeleteNonExistentRecord,
  testUpsertCreatesNew,
  testUpsertUpdatesExisting
};

