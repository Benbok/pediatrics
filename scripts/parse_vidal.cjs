/**
 * Парсер страниц Vidal.ru для извлечения структурированных данных о препаратах
 * 
 * Использование:
 * node scripts/parse_vidal.cjs <URL_страницы_Vidal>
 * 
 * Пример:
 * node scripts/parse_vidal.cjs https://www.vidal.ru/drugs/paracetamol-5
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Парсит HTML страницы Vidal.ru и извлекает данные о препарате
 * @param {string} html - HTML содержимое страницы
 * @returns {object} Структурированные данные препарата
 */
function parseVidalPage(html) {
    // Базовый парсинг (для полного парсинга нужна библиотека типа Cheerio)
    // Пока возвращаем структуру для ручного заполнения
    
    // Извлекаем название
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const nameRu = nameMatch ? nameMatch[1].trim() : null;
    
    // Извлекаем действующее вещество
    const substanceMatch = html.match(/Активное вещество[^:]*:\s*<a[^>]*>([^<]+)<\/a>/i);
    const activeSubstance = substanceMatch ? substanceMatch[1].trim() : null;
    
    // Извлекаем ATC код
    const atcMatch = html.match(/Код ATX[^:]*:\s*<a[^>]*>([^<]+)<\/a>/i);
    const atcCode = atcMatch ? atcMatch[1].trim() : null;
    
    // Извлекаем формы выпуска (упрощенно)
    const forms = [];
    const formMatches = html.match(/Форма выпуска[^<]*<[^>]*>([^<]+)/i);
    if (formMatches) {
        // Парсинг форм требует более сложной логики
        forms.push({
            type: 'solution', // Определяется по описанию
            description: formMatches[1].trim()
        });
    }
    
    // Извлекаем режим дозирования (требует сложного парсинга таблиц)
    // Пока возвращаем структуру для ручного заполнения
    
    return {
        nameRu,
        activeSubstance,
        atcCode,
        forms,
        // Остальные поля требуют более сложного парсинга
        // Рекомендуется использовать библиотеку Cheerio для полного парсинга
        note: 'Для полного парсинга требуется установка cheerio: npm install cheerio'
    };
}

/**
 * Загружает HTML страницы по URL
 */
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        client.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

// CLI интерфейс
if (require.main === module) {
    const url = process.argv[2];
    
    if (!url) {
        console.error('Использование: node parse_vidal.cjs <URL_страницы_Vidal>');
        console.error('Пример: node parse_vidal.cjs https://www.vidal.ru/drugs/paracetamol-5');
        process.exit(1);
    }
    
    console.log(`Загрузка страницы: ${url}`);
    
    fetchPage(url)
        .then(html => {
            const data = parseVidalPage(html);
            console.log(JSON.stringify(data, null, 2));
        })
        .catch(error => {
            console.error('Ошибка:', error.message);
            process.exit(1);
        });
}

module.exports = { parseVidalPage, fetchPage };
