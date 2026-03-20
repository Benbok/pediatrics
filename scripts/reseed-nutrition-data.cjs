const { app } = require('electron');
const { seedNutritionData } = require('../electron/init-db.cjs');

async function main() {
  try {
    await app.whenReady();
    await seedNutritionData();
    console.log('Nutrition reference data reseeded');
    await app.quit();
  } catch (error) {
    console.error('Failed to reseed nutrition data:', error);
    app.exit(1);
  }
}

main();