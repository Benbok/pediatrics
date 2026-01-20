-- Удаление всех данных из таблицы visits
-- ВНИМАНИЕ: Это удалит все существующие данные приемов!

-- Сначала удаляем связанные записи (если таблица существует)
DELETE FROM informed_consents WHERE visit_id IS NOT NULL;

-- Затем удаляем все записи из таблицы visits
DELETE FROM visits;
