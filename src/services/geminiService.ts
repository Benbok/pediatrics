/// <reference types="vite/client" />
import { GoogleGenAI } from "@google/genai";
import { VaccineDefinition, ChildProfile, VaccinationProfile } from "../types";
import { calculateAgeInMonths } from "../utils/ageUtils";

// Lazy initialization - only create when API key is available
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

const getAIClient = (): GoogleGenAI | null => {
  // Priority 1: localStorage (user setting)
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;

  // Priority 2: environment variable
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Use env key as source if localStorage is empty
  const apiKey = (typeof window !== 'undefined' && localStorage.getItem('gemini_api_key')) || envKey;

  if (!apiKey) {
    console.warn("Gemini API key not found. AI features will be disabled.");
    return null;
  }

  // Re-initialize if key changed
  if (ai && currentApiKey !== apiKey) {
    ai = null;
  }

  if (!ai) {
    try {
      const baseUrl = getCustomBaseUrl();
      const options: any = { apiKey };
      if (baseUrl) {
        options.baseUrl = baseUrl
          .replace(/\/v1(beta)?\/?$/, '')
          .replace(/\/$/, '');
        console.log(`[Gemini] Initializing with custom Base URL (cleaned): ${options.baseUrl}`);
      }

      ai = new GoogleGenAI(options);
      currentApiKey = apiKey;
      console.log("[Gemini] AI client initialized");
      return ai;
    } catch (error) {
      console.error("Failed to initialize Gemini AI:", error);
      return null;
    }
  }

  return ai;
};

/**
 * Updates the API key in localStorage and reinitializes the client
 */
export const setApiKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gemini_api_key', key);
    ai = null; // Force re-initialization
    currentApiKey = null;
    console.log("[Gemini] API key updated");
  }
};

/**
 * Validates the API key and auto-detects the best available model by probing
 */
export const validateApiKey = async (key: string, baseUrl?: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const options: any = { apiKey: key };
    if (baseUrl) {
      // Google SDK appends /v1 or /v1beta itself. 
      // Many users provide URL with /v1, which causes double path like /v1/v1/models.
      // We strip /v1, /v1beta and trailing slashes.
      options.baseUrl = baseUrl
        .replace(/\/v1(beta)?\/?$/, '')
        .replace(/\/$/, '');
      console.log(`[Gemini] Using custom Base URL (cleaned): ${options.baseUrl}`);
    }

    const testClient = new GoogleGenAI(options);

    // Use strictly the model from environment or settings
    const modelToTest = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';

    console.log(`[Gemini] Validating with model: ${modelToTest} (BaseURL: ${baseUrl || 'default'})`);

    let workingModel = null;
    try {
      await testClient.models.generateContent({
        model: modelToTest,
        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
      });
      console.log(`[Gemini] Success with model: ${modelToTest}`);
      workingModel = modelToTest;
    } catch (e: any) {
      console.warn(`[Gemini] Model ${modelToTest} validation failed:`, e?.message?.split('.')[0]);
      throw e;
    }

    if (!workingModel) {
      throw new Error("Не найдено доступных моделей Gemini. Проверьте ключ, доступность региона или настройки прокси.");
    }

    // Save the working model and base URL
    console.log(`[Gemini] Selected model: ${workingModel}`);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_model', workingModel);
      if (baseUrl) {
        localStorage.setItem('gemini_base_url', baseUrl);
      } else {
        localStorage.removeItem('gemini_base_url');
      }
    }

    return { valid: true };
  } catch (error: any) {
    console.error("[Gemini] API key validation failed:", error);

    if (error?.message?.includes('API key')) {
      return { valid: false, error: 'Неверный API ключ' };
    }

    if (error?.status === 403 || error?.message?.includes('permission')) {
      return { valid: false, error: 'Нет доступа или неверный ключ' };
    }

    return { valid: false, error: error?.message || 'Ошибка проверки ключа' };
  }
};

/**
 * Gets the current API key (from localStorage or env)
 */
export const getCurrentApiKey = (): string | null => {
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  return storedKey || envKey || null;
};

/**
 * Gets the custom Base URL if set
 */
export const getCustomBaseUrl = (): string | null => {
  return typeof window !== 'undefined' ? localStorage.getItem('gemini_base_url') : null;
};

// Helper to get the saved model or default
const getModelName = (): string => {
  const envModel = import.meta.env.VITE_GEMINI_MODEL;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('gemini_model');
    if (saved) return saved;
  }
  return envModel || 'gemini-2.5-flash';
};


const PEDIATRIC_SYSTEM_INSTRUCTION = `
Вы — медицинский ассистент-эксперт PediAssist.
Ваша роль: помощь педиатру в диагностике (на основе жалоб и симптомов), расчете дозировок препаратов, валидации данных, построении индивидуальных графиков вакцинации (включая догоняющие), проверке противопоказаний и информировании родителей.

ОСНОВНОЙ НОРМАТИВНЫЙ БАЗИС:
- Приказ МЗ РФ № 1122н (Национальный календарь).
- ФЗ № 157-ФЗ (Об иммунопрофилактике).
- МУ 3.3.1.1095-02 (Медицинские противопоказания).
- СанПиН 3.3686-21.

ЛОГИКА ПО ПНЕВМОКОККУ (Стрептококк pneumoniae):
1. ПРЕПАРАТЫ: ПКВ13 (Превенар 13), ППВ23 (Пневмовакс 23, с 2 лет для риска).
2. СХЕМЫ: Индивидуально по возрасту старта. ПКВ13 + ППВ23 через 8 недель для групп риска.

ЛОГИКА ПО АКДС (Коклюш, Дифтерия, Столбняк):
1. ПРЕПАРАТЫ: 
   - АКДС (wP): Цельноклеточная, реактогенна.
   - Пентаксим/Инфанрикс Гекса (aP): Бесклеточные, легкая переносимость.
   - Адасель: С 4-6 лет и взрослым (содержит коклюш).
   - АДС-М: Без коклюша, для плановых ревакцинаций и при противопоказаниях.
2. СХЕМА: 3 - 4.5 - 6 мес. Ревакцинация (RV1) строго через 12 месяцев после 3-й дозы.
3. ПРОТИВОПОКАЗАНИЯ (Коклюш): Прогрессирующая неврология, афебрильные судороги, энцефалопатия. В этих случаях — АДС-М.

ЛОГИКА ПО HIB (Гемофильная инфекция тип b):
1. ОПАСНОСТЬ: Главная причина бактериальных менингитов и эпиглоттита (отек гортани, риск удушья!) у детей до 5 лет. Это БАКТЕРИЯ, а не грипп.
2. СТРАТЕГИЯ Catch-up: 
   - До 6 мес: 3 дозы + ревакцинация.
   - 6-12 мес: 2 дозы + ревакцинация.
   - С 1 года до 5 лет: 1 доза однократно (курс завершен).
3. КОМБИНИРОВАННЫЕ: В Пентаксиме Hib — это отдельный сухой порошок. Если ребенку > 1 года и он уже привит или Hib не нужен, порошок можно не разводить.

ЛОГИКА ПО ПОЛИОМИЕЛИТУ:
1. ТИПЫ: 
   - ИПВ: Инактивированная (укол), абсолютно безопасна.
   - ОПВ: Живая (капли), создает местный иммунитет, но несет риск ВАПП (вакциноассоциированного паралича) у непривитых.
2. СТРАТЕГИЯ: Минимум 2 дозы ИПВ (V1-V2) перед любой ОПВ. В России сейчас V1-RV1 (4 дозы) — ИПВ.
3. ГРУППЫ РИСКА: ВИЧ, иммунодефициты, дети в интернатах, низкий вес, аномалии кишечника — СТРОГО ТОЛЬКО ИПВ на все 6 доз.
4. САНПИН (Разобщение): Если у ребенка менее 3 доз полио, он рискует заразиться от детей, получивших ОПВ. Требуется разобщение на 60 дней.

ЛОГИКА ПО КОРЬ-КРАСНУХА-ПАРОТИТ (КПК):
1. ПРЕПАРАТЫ: 
   - Комбинированные (Вактривир, MMR II) — приоритет 1 укол.
   - Ди- и Моновакцины: Требуют 2-3 уколов в разные места.
2. ЖИВАЯ ВАКЦИНА: Требует интервала 30 дней с другими живыми (Ветрянка) или в один день.
3. МАНТУ: Проба Манту должна быть ДО или в один день с КПК. К после КПК — только через 4-6 недель.
4. ОТЛОЖЕННАЯ РЕАКЦИЯ: Специфика КПК — реакция (температура, сыпь) возникает не сразу, а на 5-15 день. Это норма, ребенок не заразен.
5. ПРОТИВОПОКАЗАНИЯ: Тяжелые аллергии на яйцо (куриное/перепелиное — уточнять состав), неомицин, первичные иммунодефициты.

ЛОГИКА ПО МЕНИНГОКОККУ:
1. ОПАСНОСТЬ: Инфекция развивается молниеносно (до 24ч). Характерна геморрагическая сыпь ("звездочки"), не исчезающая при нажатии (ТЕСТ СТАКАНА).
2. ВАКЦИНЫ: Менактра (ACWY) — золотой стандарт. Бексеро (MenB) — дополняет защиту от группы B.
3. ГРАФИК (Менактра): До 23 мес — 2 дозы (интервал 3 мес). От 2 лет — 1 доза однократно.
4. ГРУППЫ РИСКА: Студенты в общежитиях, путешественники в эндемичные зоны, отсутствие селезенки.

ЛОГИКА ПО ВЕТРЯНОЙ ОСПЕ:
1. МИФЫ: "Легкая болезнь, лучше переболеть" — ОПАСНО. Осложнения: пневмония, энцефалит (шатающаяся походка), шрамы.
2. ОТЛОЖЕННАЯ УГРОЗА: Вирус остается навсегда и вызывает мучительный Опоясывающий лишай (Herpes Zoster) в старости. Вакцина защищает и от этого!
3. ВАКЦИНА: Варилрикс (живая). Золотой стандарт — 2 дозы (интервал 6 недель). 
4. ЭКСТРЕННАЯ ПРОФИЛАКТИКА (SOS): Если был контакт с заболевшим — есть 72-96 часов на вакцинацию. Это предотвратит болезнь.
5. СОВМЕСТИМОСТЬ: С КПК в один день или с интервалом 30 дней (обе живые).

ЛОГИКА ПО ГЕПАТИТУ А (Болезнь Боткина):
1. СУТЬ: "Болезнь грязных рук". Передается через воду, еду, игрушки. Острая фаза тяжелая, восстановление печени до 6 мес.
2. ВАКЦИНЫ: Хаврикс, Альгавак (Инактивированные = безопасные).
3. СХЕМА: 2 дозы. Интервал 6-12 месяцев.
4. КОГДА НУЖНА: Обязательна в Москве/Регионах перед садом. Рекомендована ВСЕМ перед поездкой на юг/море (Турция, Египет).

ЛОГИКА ПО ГРИППУ (Сезонная):
1. ВИРУС: Постоянно мутирует. Вакцина обновляется КАЖДЫЙ год. Прошлогодняя доза не работает.
2. СЕЗОН: Вакцинация начинается в Августе-Сентябре. Дедлайн: ноябрь (до эпидемии).
3. ВАКЦИНЫ: "Золотой стандарт" — 4-валентные (Ультрикс Квадри, Флю-М Тетра) = 15 мкг антигена. Избегать 3-валентных с консервантами.
4. ПЕРВЫЙ РАЗ: Детям до 3-9 лет, которые ни разу не болели и не прививались, НУЖНО 2 дозы (интервал 4 недели). Иначе иммунитет не сработает.
5. АЛЛЕРГИЯ НА ЯЙЦА: Обычно не является противопоказанием (следы белка минимальны).

ЛОГИКА ПО ВПЧ (Вирус папилломы):
1. ОПАСНОСТЬ: ВПЧ вызывает рак (шейки матки, горла). Вакцинация предотвращает рак.
2. ВОЗРАСТ: Чем раньше, тем лучше. Идеально 9-13 лет.
3. СХЕМА:
   - До 15 лет: 2 дозы (0, 6 мес).
   - С 15 лет: 3 дозы (0, 2, 6 мес).
4. МОСКВА: Девочкам 12-13 лет — БЕСПЛАТНО в поликлинике!
5. ВАКЦИНЫ:
   - Гардасил 4: защита от рака + кондилом.
   - Церварикс: мощная защита только от рака.
6. ВАЖНО: Вакцина болезненная. Ребенок должен посидеть 15-20 мин после укола (риск обморока).

ЛОГИКА ПО КЛЕЩЕВОМУ ЭНЦЕФАЛИТУ:
1. КЛЕЩИ: Переносят вирус, поражающий мозг (паралич).
2. СХЕМЫ:
   - ПЛАНОВАЯ (Осень): V1 -> (5-7 мес) -> V2. Самая надежная.
   - ЭКСТРЕННАЯ (Весна): V1 -> (2 нед) -> V2.
3. БЕЗОПАСНОСТЬ: В лес можно только через 2 недели ПОСЛЕ второй дозы! До этого иммунитета нет.
4. РЕВАКЦИНАЦИЯ: V3 через год. Далее каждые 3 года.
      ЭНДЕМИКИ: Сибирь, Урал, Дмитровский район (МО) — обязательно.

ЛОГИКА ПО РОТАВИРУСНОЙ ИНФЕКЦИИ:
1. ВАЖНОСТЬ: Защищает от тяжелой диареи и обезвоживания, частой причины госпитализации младенцев.
2. СРОКИ (Строгие!):
   - 1-я доза: строго в возрасте 6-12 недель. Если ребенку исполнилось 12 недель и 1 день, а первая доза не введена — вакцинация против ротавируса НЕ проводится вообще.
   - Завершение курса: Курс (3 дозы) должен быть ПОЛНОСТЬЮ завершен до 32 недель (8 месяцев).
3. ВАКЦИНЫ: РотаТек (3 дозы), Рота-V-Эйд (3 дозы). Это живые капли в рот.
4. ПРОТИВОПОКАЗАНИЯ: Инвагинация кишечника в анамнезе, некорригированные пороки развития ЖКТ, тяжелый комбинированный иммунодефицит (SCID). ТКИН — единственное абсолютное противопоказание среди иммунодефицитов.
5. СОВМЕСТИМОСТЬ: Можно совмещать с любыми вакцинами календаря (включая ОПВ), кроме БЦЖ. Нет необходимости разобщать с другими живыми вакцинами.

ПРАВИЛА КОНСУЛЬТАЦИИ:
1. ИСПОЛЬЗУЙТЕ ДОГОНЯЮЩУЮ ВАКЦИНАЦИЮ (Catch-up): Никогда не рекомендуйте начинать серию заново.
2. РОТАВИРУС: Строгие сроки! завершить до 8 месяцев.
3. КОМБИНИРОВАННЫЕ: Если выбран Пентаксим, он заменяет АКДС + Полио + Hib.
4. Тон: Профессиональный, медицинский, но доступный родителям. Всегда напоминайте, что окончательное решение принимает врач.
`;

export const getVaccineAdvice = async (
  vaccine: VaccineDefinition,
  child: ChildProfile,
  vaccinationProfile?: VaccinationProfile
): Promise<string> => {
  try {
    const client = getAIClient();

    if (!client) {
      return "AI функции отключены. Пожалуйста, настройте API ключ Gemini в настройках.";
    }

    const ageInMonths = calculateAgeInMonths(child.birthDate, new Date());

    const prompt = `
      Ребенок: ${child.surname} ${child.name}, возраст ${ageInMonths} мес.
      Группы риска по Гепатиту В: ${vaccinationProfile?.hepBRiskFactors?.join(', ') || 'нет'}
      Группы риска по Полиомиелиту: ${vaccinationProfile?.polioRiskFactors?.join(', ') || 'нет'}
      Противопоказания (Коклюш): ${vaccinationProfile?.pertussisContraindications?.join(', ') || 'нет'}
      Противопоказания (КПК/Живые): ${vaccinationProfile?.mmrContraindications?.join(', ') || 'нет'}
      Группы риска (Менингококк): ${vaccinationProfile?.meningRiskFactors?.join(', ') || 'нет'}
      Группы риска (Ветрянка SOS): ${vaccinationProfile?.varicellaRiskFactors?.join(', ') || 'нет'}
      Группы риска (Гепатит А): ${vaccinationProfile?.hepaRiskFactors?.join(', ') || 'нет'}
      Группы риска (Грипп): ${vaccinationProfile?.fluRiskFactors?.join(', ') || 'нет'}
      Группы риска (ВПЧ): ${vaccinationProfile?.hpvRiskFactors?.join(', ') || 'нет'}
      Группы риска (ВПЧ): ${vaccinationProfile?.hpvRiskFactors?.join(', ') || 'нет'}
      Группы риска (Клещ): ${vaccinationProfile?.tbeRiskFactors?.join(', ') || 'нет'}
      Группы риска (Ротавирус): ${vaccinationProfile?.rotaRiskFactors?.join(', ') || 'нет'}
      Вакцина: ${vaccine.name} (Заболевание: ${vaccine.disease}).
      Стандартный срок по календарю: ${vaccine.ageMonthStart} мес.
      
      Дайте краткую справку (до 150 слов) в Markdown:
      1. Почему это важно для ребенка в этом возрасте?
      2. Какие норманые реакции ожидать (температура, место укола)?
      3. Когда срочно вызвать врача?
      4. Есть ли особенности догоняющего графика, если мы опоздали?
    `;

    const modelName = getModelName();
    console.log(`[Gemini] Using model: ${modelName}`);

    const response = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: PEDIATRIC_SYSTEM_INSTRUCTION,
      }
    });

    return (response as any).text() || response.text || "Информация временно недоступна.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Не удалось получить консультацию ИИ. Пожалуйста, проверьте соединение.";
  }
};

export const getGeneralAdvice = async (
  query: string,
  child: ChildProfile,
  vaccinationProfile?: VaccinationProfile
): Promise<string> => {
  try {
    const client = getAIClient();

    if (!client) {
      return "AI функции отключены. Пожалуйста, настройте API ключ Gemini в настройках.";
    }

    const prompt = `
      Вопрос пользователя: "${query}"
      
      Информация о ребенке:
      ФИО: ${child.surname} ${child.name} ${child.patronymic || ''}
      Дата рождения: ${child.birthDate}
      Группы риска по Гепатиту В: ${vaccinationProfile?.hepBRiskFactors?.join(', ') || 'нет'}
      
      Ответьте на вопрос, опираясь на российские медицинские стандарты и рекомендации ВОЗ.
    `;

    const modelName = getModelName();
    console.log(`[Gemini] Using model: ${modelName}`);

    const response = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: PEDIATRIC_SYSTEM_INSTRUCTION,
      }
    });

    return (response as any).text() || response.text || "Ответ не получен.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ошибка при обращении к ИИ.";
  }
};
