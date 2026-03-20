const { app } = require('electron');
const { prisma } = require('../electron/prisma-client.cjs');

async function main() {
  try {
    await app.whenReady();
    const templates = await prisma.nutritionFeedingTemplate.findMany({
      orderBy: { ageMinDays: 'asc' },
      include: { items: true },
    });

    console.log(JSON.stringify(
      templates.map((template) => ({
        title: template.title,
        ageMinDays: template.ageMinDays,
        ageMaxDays: template.ageMaxDays,
        items: template.items.length,
        description: template.description,
      })),
      null,
      2,
    ));

    await prisma.$disconnect();
    await app.quit();
  } catch (error) {
    console.error('Failed to verify nutrition templates:', error);
    try {
      await prisma.$disconnect();
    } catch {}
    app.exit(1);
  }
}

main();