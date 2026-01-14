const { logger } = require('../../logger.cjs');
const path = require('path');
const fs = require('fs').promises;

// UIDs для атрибутов из JSON структуры
const ATTRIBUTE_UIDS = {
    UNIQUE_ID: 'e0aad94c-bf94-4378-b270-7d385f577124',
    CODE: '247cf12b-354c-43b7-81fc-569a0b809103',
    NAME: '2fc020c0-a043-4227-bdaf-6eb550076113',
    PARENT_ID: '16d70527-e7d6-47d5-9475-a0780ec8c8e9',
    SORT_FIELD: '29baff7e-579b-48ef-bfe8-879b82036e5b'
};

const IcdCodeService = {
    indexed: false,
    codes: [], // Массив всех кодов
    byCode: new Map(), // Map<code, IcdCode> - для быстрого поиска по коду
    byCategory: new Map(), // Map<category, IcdCode[]> - для фильтрации по категории

    /**
     * Извлекает значение атрибута из массива attributeValues
     */
    getAttributeValue(attributeValues, attributeUid) {
        const attr = attributeValues.find(av => av.attributeUid === attributeUid);
        return attr ? attr.value : null;
    },

    /**
     * Нормализует код МКБ (убирает пробелы, приводит к верхнему регистру)
     */
    normalizeCode(code) {
        if (!code || typeof code !== 'string') return null;
        return code.trim().toUpperCase();
    },

    /**
     * Получает категорию кода (первая буква)
     */
    getCategory(code) {
        if (!code || typeof code !== 'string') return null;
        const normalized = this.normalizeCode(code);
        return normalized ? normalized.charAt(0) : null;
    },

    /**
     * Загружает и индексирует данные из JSON файла
     */
    async load() {
        if (this.indexed) {
            logger.info('[IcdCodeService] Data already loaded');
            return;
        }

        try {
            const jsonPath = path.join(process.cwd(), 'src', 'data', 'мкб.json');
            logger.info(`[IcdCodeService] Loading ICD codes from: ${jsonPath}`);

            const fileContent = await fs.readFile(jsonPath, 'utf-8');
            const data = JSON.parse(fileContent);

            if (!data.data || !data.data.records || !Array.isArray(data.data.records)) {
                throw new Error('Invalid JSON structure: missing data.records');
            }

            const records = data.data.records;
            logger.info(`[IcdCodeService] Found ${records.length} records`);

            this.codes = [];
            this.byCode.clear();
            this.byCategory.clear();

            for (const record of records) {
                try {
                    const codeValue = this.getAttributeValue(record.attributeValues, ATTRIBUTE_UIDS.CODE);
                    const nameValue = this.getAttributeValue(record.attributeValues, ATTRIBUTE_UIDS.NAME);
                    const uniqueId = this.getAttributeValue(record.attributeValues, ATTRIBUTE_UIDS.UNIQUE_ID);
                    const parentId = this.getAttributeValue(record.attributeValues, ATTRIBUTE_UIDS.PARENT_ID);
                    const sortField = this.getAttributeValue(record.attributeValues, ATTRIBUTE_UIDS.SORT_FIELD);

                    // Пропускаем записи без кода или названия
                    if (!codeValue || !nameValue) {
                        continue;
                    }

                    const normalizedCode = this.normalizeCode(codeValue);
                    if (!normalizedCode) {
                        continue;
                    }

                    const icdCode = {
                        uid: record.uid,
                        code: normalizedCode,
                        name: nameValue,
                        uniqueId: uniqueId,
                        parentId: parentId || null,
                        sortField: sortField || null
                    };

                    this.codes.push(icdCode);

                    // Индекс по коду (если несколько записей с одним кодом - берем первую)
                    if (!this.byCode.has(normalizedCode)) {
                        this.byCode.set(normalizedCode, icdCode);
                    }

                    // Индекс по категории
                    const category = this.getCategory(normalizedCode);
                    if (category) {
                        if (!this.byCategory.has(category)) {
                            this.byCategory.set(category, []);
                        }
                        this.byCategory.get(category).push(icdCode);
                    }
                } catch (error) {
                    logger.warn(`[IcdCodeService] Failed to process record ${record.uid}:`, error.message);
                    continue;
                }
            }

            this.indexed = true;
            logger.info(`[IcdCodeService] Successfully indexed ${this.codes.length} ICD codes`);
            logger.info(`[IcdCodeService] Categories: ${Array.from(this.byCategory.keys()).sort().join(', ')}`);
        } catch (error) {
            logger.error('[IcdCodeService] Failed to load ICD codes:', error);
            throw error;
        }
    },

    /**
     * Получает код МКБ по точному совпадению кода
     * КРИТИЧНО для интеграции с PDF парсингом
     */
    async getByCode(code) {
        if (!this.indexed) {
            await this.load();
        }

        const normalizedCode = this.normalizeCode(code);
        if (!normalizedCode) {
            return null;
        }

        return this.byCode.get(normalizedCode) || null;
    },

    /**
     * Поиск по коду или названию
     */
    async search(query, limit = 100, offset = 0) {
        if (!this.indexed) {
            await this.load();
        }

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return {
                results: [],
                total: 0,
                limit,
                offset
            };
        }

        const searchQuery = query.trim().toLowerCase();
        const results = [];

        // Поиск по коду (точное совпадение или начало)
        for (const code of this.codes) {
            if (code.code.toLowerCase().includes(searchQuery) || 
                code.name.toLowerCase().includes(searchQuery)) {
                results.push(code);
            }
        }

        // Сортировка: сначала точные совпадения по коду, потом по названию
        results.sort((a, b) => {
            const aCodeMatch = a.code.toLowerCase().startsWith(searchQuery);
            const bCodeMatch = b.code.toLowerCase().startsWith(searchQuery);
            if (aCodeMatch && !bCodeMatch) return -1;
            if (!aCodeMatch && bCodeMatch) return 1;
            return a.code.localeCompare(b.code);
        });

        const total = results.length;
        const paginatedResults = results.slice(offset, offset + limit);

        return {
            results: paginatedResults,
            total,
            limit,
            offset
        };
    },

    /**
     * Получает коды по категории (A-Z)
     */
    async getByCategory(category, limit = 100, offset = 0) {
        if (!this.indexed) {
            await this.load();
        }

        const normalizedCategory = category ? category.toUpperCase().charAt(0) : null;
        if (!normalizedCategory || !this.byCategory.has(normalizedCategory)) {
            return {
                results: [],
                total: 0,
                limit,
                offset
            };
        }

        const codes = this.byCategory.get(normalizedCategory);
        // Сортируем по коду
        codes.sort((a, b) => a.code.localeCompare(b.code));

        const total = codes.length;
        const paginatedResults = codes.slice(offset, offset + limit);

        return {
            results: paginatedResults,
            total,
            limit,
            offset
        };
    },

    /**
     * Получает все коды с пагинацией
     */
    async getAll(limit = 100, offset = 0) {
        if (!this.indexed) {
            await this.load();
        }

        const total = this.codes.length;
        const paginatedResults = this.codes.slice(offset, offset + limit);

        return {
            results: paginatedResults,
            total,
            limit,
            offset
        };
    },

    /**
     * Получает список всех доступных категорий
     */
    async getCategories() {
        if (!this.indexed) {
            await this.load();
        }

        return Array.from(this.byCategory.keys()).sort();
    }
};

module.exports = { IcdCodeService };
