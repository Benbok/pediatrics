# Модуль Питание

## Назначение

Модуль Питание предназначен для поддержки врача при:

- расчете суточной потребности ребенка 0-12 месяцев
- оценке смешанного и искусственного вскармливания
- сопровождении прикорма 4-12 месяцев
- подборе примерного рациона 1-3 года
- сохранении истории расчетов питания по пациенту

Важно: модуль является вспомогательным инструментом и не заменяет клиническое решение врача.

## Источники клинической логики

- Национальная программа оптимизации питания детей РФ, 2019
- МР 2.3.1.0253-21, 2021
- Формулы Тура и Зайцевой для 0-10 суток

## Архитектура

Поток данных:

UI (React) -> nutritionService -> window.electronAPI -> IPC handlers (Electron) -> NutritionService (Electron) -> Prisma -> SQLite

Ключевые слои:

- Pure логика расчетов:
  - src/logic/nutrition/calculateNeeds.ts
  - src/logic/nutrition/calculateFeeding.ts
- Frontend сервис:
  - src/modules/nutrition/services/nutritionService.ts
- Backend handlers/service:
  - electron/modules/nutrition/handlers.cjs
  - electron/modules/nutrition/service.cjs
- Валидация:
  - src/validators/nutrition.validator.ts
  - backend Zod в handlers

## UI структура

- src/modules/nutrition/NutritionModule.tsx
  - Расчет 0-12 мес.
  - Прикорм
  - Рацион 1-3 года
  - История расчетов
  - Смеси/продукты

Компоненты:

- src/modules/nutrition/components/QuickCalculatorPanel.tsx
- src/modules/nutrition/components/ComplementaryFeedingPanel.tsx
- src/modules/nutrition/components/DietPlan1to3Panel.tsx
- src/modules/nutrition/components/FeedingPlanHistory.tsx
- src/modules/nutrition/components/ProductsManager.tsx
- src/modules/nutrition/components/TemplateManager.tsx

Где добавлять шаблоны рациона:

- Вкладка `Шаблоны рациона` в модуле Питание
- Там можно создать/редактировать/удалить шаблон и его пункты (прием пищи, категория, порция, заметка)
- Эти шаблоны автоматически используются во вкладках `Прикорм` и `Рацион 1-3 года`

## Роутинг и вход в модуль

- Маршрут: patients/:childId/nutrition
- Подключение маршрута: src/App.tsx
- Вход из карточки пациента: src/modules/patients/PatientDetails.tsx

## Основные формулы

### 0-10 суток

Используется максимум из двух формул:

- Тур:
  - 80 x n при массе при рождении >= 3200 г
  - 70 x n при массе при рождении < 3200 г
- Зайцева:
  - 0.02 x масса_при_рождении_г x n

Где n - день жизни.

### 10 суток - 12 месяцев

- Объемный метод по возрастным коэффициентам
- Одновременно считается энергетическая потребность (ккал/кг)
- Для отображения используется средний коэффициент диапазона

### 12-36 месяцев

- Фиксированная энергетическая потребность по возрастной норме
- Вместо мл/сут используется ориентир общей массы пищи (г/сут)

### Сценарии вскармливания

- BF: только грудное вскармливание
- MF: дефицит смеси = потребность - оценочный объем грудного молока
- FF: два режима расчета смеси
  - Калорийный: объем вычисляется по калорийной потребности и ккал/100 мл выбранной смеси
  - Объемный: объем берется из возрастного объемного норматива
  - Авто: используется калорийный расчет, но с ограничением объемным нормативом

## IPC API

Каналы:

- nutrition:get-age-norms
- nutrition:get-product-categories
- nutrition:get-products
- nutrition:upsert-product
- nutrition:delete-product
- nutrition:get-templates
- nutrition:get-template-items
- nutrition:upsert-template
- nutrition:delete-template
- nutrition:get-child-feeding-plans
- nutrition:save-child-feeding-plan
- nutrition:delete-child-feeding-plan

Bridge методы в preload:

- getNutritionAgeNorms
- getNutritionProductCategories
- getNutritionProducts
- upsertNutritionProduct
- deleteNutritionProduct
- getNutritionTemplates
- getNutritionTemplateItems
- upsertNutritionTemplate
- deleteNutritionTemplate
- getChildFeedingPlans
- saveChildFeedingPlan
- deleteChildFeedingPlan

## База данных

Добавлены модели Prisma:

- NutritionAgeNorm
- NutritionProductCategory
- NutritionProduct
- NutritionFeedingTemplate
- NutritionFeedingTemplateItem
- ChildFeedingPlan

Также добавлены связи:

- Child -> feedingPlans
- User -> feedingPlans (UserFeedingPlans)

Seed в electron/init-db.cjs:

- возрастные нормы
- категории продуктов
- шаблоны рациона и прикорма

## Тесты

Файл unit-тестов:

- tests/nutrition-calculations.test.ts

Проверенные кейсы:

- Тур/Зайцева (оба порога массы)
- объемный расчет 2-4 месяца
- смешанное вскармливание (дефицит)
- порог рекомендаций перехода к ИВ
- окно статуса прикорма
- различие итогового объема между явными методами `калорийный` и `объемный`

UI дополнение:

- Поле `Смесь` в калькуляторе поддерживает поиск по названию/бренду для больших справочников

Запуск:

- npx vitest tests/nutrition-calculations.test.ts --run

## Состояние миграций в текущем окружении

При попытке выполнить prisma migrate dev обнаружен drift текущей dev БД.

Наблюдение:

- migrate dev требует reset базы
- db push в текущем состоянии также падает из-за рассинхронизации схемы/метаданных

Рекомендуемая безопасная последовательность:

1. Сделать backup файла БД (prisma/dev.db)
2. Зафиксировать важные локальные данные экспортом
3. Выполнить prisma migrate reset только после подтверждения
4. Затем выполнить prisma migrate dev --name add-nutrition-module
5. Проверить запуск приложения и корректность seed

## Минимальный smoke-check после миграции

1. Открыть карточку пациента и перейти в Питание
2. На вкладке Расчет 0-12 мес. выполнить расчет BF/MF/FF
3. Сохранить расчет и проверить запись в Истории
4. На вкладке Смеси добавить тестовую смесь и пересчитать FF
5. Проверить вкладки Прикорм и Рацион 1-3 года на соответствующем возрасте

## Ограничения и заметки

- Для возраста 0-10 суток масса при рождении вводится вручную
- История хранится в child_feeding_plan
- Для FF без выбранной смеси используется объемный fallback
- Для расчетов и отображения используются справочники из БД
