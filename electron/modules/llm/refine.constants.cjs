'use strict';

// ── Stage 1: Spelling correction (word-level focus) ─────────────────────────
// The model receives words and fixes spelling only, no punctuation changes.
const SPELLING_STAGE = Object.freeze({
  systemPrompt:
    'Ты — корректор орфографии русского медицинского текста.\n' +
    'Твоя ЕДИНСТВЕННАЯ задача: исправить написание каждого слова.\n' +
    'Правила:\n' +
    '- Исправь каждое слово с ошибкой на правильное русское слово.\n' +
    '- НЕ добавляй и НЕ удаляй слова. Количество слов на входе и выходе ОДИНАКОВОЕ.\n' +
    '- НЕ меняй порядок слов.\n' +
    '- НЕ добавляй знаки препинания.\n' +
    '- Числа оставляй как есть.\n' +
    '- Аббревиатуры (ОРВИ, ОРЗ, ЧСС, SpO2) оставляй как есть.\n' +
    'Примеры:\n' +
    'Вход: заложеношть носа сылная сопли теут\n' +
    'Выход: заложенность носа сильная сопли текут\n' +
    'Вход: грало болит темпаратура дершится слабасть\n' +
    'Выход: горло болит температура держится слабость\n' +
    'Вход: галовная боль насмрок чихайу мноу\n' +
    'Выход: головная боль насморк чихаю много\n' +
    'Вход: апетит пропал бивает озноб тяжлые\n' +
    'Выход: аппетит пропал бывает озноб тяжёлые\n' +
    'Верни ТОЛЬКО исправленные слова. Без пояснений.',
  userPromptPrefix: 'Исправь орфографию каждого слова. Верни слова через пробел:\n',
  generation: Object.freeze({
    temperature: 0.15,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.0,
    stop: ['</s>', '<|im_end|>', '\n\n'],
  }),
});

// ── Stage 2: Punctuation and formatting ─────────────────────────────────────
// The model receives correctly-spelled text and adds punctuation/structure.
const PUNCTUATION_STAGE = Object.freeze({
  systemPrompt:
    'Ты — медицинский редактор. Текст уже без орфографических ошибок.\n' +
    'Твоя задача: расставить знаки препинания, заглавные буквы и оформить текст.\n' +
    'Правила:\n' +
    '- Расставь запятые, точки и другие знаки препинания.\n' +
    '- Первое слово предложения — с заглавной буквы.\n' +
    '- Не добавляй новые слова и не удаляй существующие.\n' +
    '- Не меняй порядок слов.\n' +
    '- Числа и единицы измерения сохраняй как есть.\n' +
    '- Медицинские аббревиатуры сохраняй заглавными.\n' +
    '- Верни результат одной строкой.\n' +
    '- НЕ добавляй заголовки, метки, названия полей, слово "Контекст" или любые пояснения.\n' +
    'Верни ТОЛЬКО оформленный текст пациента, ничего больше.',
  userPromptPrefix: 'Расставь пунктуацию и заглавные буквы:\n',
  generation: Object.freeze({
    temperature: 0.1,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.05,
    stop: ['</s>', '<|im_end|>', '\n\n', 'Готово', 'Вот'],
  }),
});

const REFINE_SECTIONS = Object.freeze({
  diseaseHistory: Object.freeze({
    id: 'diseaseHistory',
    title: 'Анамнез заболевания',
    fields: Object.freeze(['complaints', 'diseaseOnset', 'diseaseCourse', 'treatmentBeforeVisit']),
    fieldConfigs: Object.freeze({
      complaints: Object.freeze({
        label: 'Жалобы на момент поступления',
        styleGuidance: 'краткие клинические жалобы через запятую',
      }),
      diseaseOnset: Object.freeze({
        label: 'Когда началось заболевание и первые симптомы',
        styleGuidance: 'хронологическое описание начала заболевания',
      }),
      diseaseCourse: Object.freeze({
        label: 'Течение болезни',
        styleGuidance: 'динамика симптомов 1-3 предложения',
      }),
      treatmentBeforeVisit: Object.freeze({
        label: 'Лечение, проводимое до обращения',
        styleGuidance: 'перечисление препаратов, доз, кратности',
      }),
    }),
  }),
});

// ── Stage Combined: single-pass spelling + punctuation for cloud models ─────
// Used instead of the two-stage pipeline when the provider is a cloud LLM
// (e.g. Gemini). Cloud models handle both tasks well in one pass and tend to
// truncate output when asked to do repetitive word-by-word tasks stage by stage.
const COMBINED_STAGE = Object.freeze({
  systemPrompt:
    'Ты — медицинский редактор и корректор русского текста.\n' +
    'Твои задачи (обе выполняются за один проход):\n' +
    '1. Исправь орфографические ошибки в каждом слове.\n' +
    '2. Расставь знаки препинания и заглавные буквы.\n' +
    'Строгие правила:\n' +
    '- Сохрани ВСЕ слова: не добавляй и не удаляй ни одного.\n' +
    '- Сохрани исходный порядок слов.\n' +
    '- Числа и единицы измерения оставь точно как есть (37,5 — сохрани запятую).\n' +
    '- Медицинские аббревиатуры (ОРВИ, ЧСС, SpO2, АД) оставь заглавными.\n' +
    '- Верни результат одной строкой.\n' +
    '- НЕ добавляй заголовки, пояснения, вводные слова или метки полей.\n' +
    'Пример:\n' +
    'Вход: рибёнок кашляит 3 дня насморк силный тимпература 38 слабасть апетит снижен\n' +
    'Выход: Ребёнок кашляет 3 дня, насморк сильный, температура 38, слабость, аппетит снижен.\n' +
    'Верни ТОЛЬКО отредактированный текст.',
  userPromptPrefix: 'Исправь орфографию и пунктуацию:\n',
  generation: Object.freeze({
    temperature: 0.1,
    topP: 0.9,
    stop: [],
    thinkingBudget: 0,
  }),
});

// Динамический лимит с запасом для Gemini и русского текста.
// В cloud-моделях output может токенизироваться плотнее, поэтому
// используем более консервативный budget, чтобы не получать обрезанные ответы.
function calcRefineMaxTokens(inputLength) {
  return Math.min(2048, Math.max(256, Math.ceil(inputLength * 2.2)));
}

const ALLOWED_REFINE_FIELDS = Object.freeze(
  Object.values(REFINE_SECTIONS).flatMap((section) => section.fields)
);

function getRefineSectionByField(field) {
  return Object.values(REFINE_SECTIONS).find((section) => section.fields.includes(field)) || null;
}

function getRefineFieldConfig(field) {
  const section = getRefineSectionByField(field);
  if (!section) return null;
  return section.fieldConfigs[field] || null;
}

// Stage 1: spelling messages
function buildSpellingMessages(text) {
  return [
    { role: 'system', content: SPELLING_STAGE.systemPrompt },
    { role: 'user', content: `${SPELLING_STAGE.userPromptPrefix}${text}` },
  ];
}

// Stage 2: punctuation messages
function buildPunctuationMessages(field, text) {
  const section = getRefineSectionByField(field);
  const fieldConfig = getRefineFieldConfig(field);
  if (!section) throw new Error('LLM_REFINE_SECTION_NOT_FOUND');
  if (!fieldConfig) throw new Error('LLM_REFINE_FIELD_NOT_FOUND');
  return [
    {
      role: 'system',
      content:
        PUNCTUATION_STAGE.systemPrompt + '\n' +
        `Это поле: "${fieldConfig.label}". Стиль: ${fieldConfig.styleGuidance}.`,
    },
    {
      role: 'user',
      content: `${PUNCTUATION_STAGE.userPromptPrefix}${text}`,
    },
  ];
}

// Combined single-pass: spelling + punctuation for cloud models
function buildCombinedRefineMessages(field, text) {
  const section = getRefineSectionByField(field);
  const fieldConfig = getRefineFieldConfig(field);
  if (!section) throw new Error('LLM_REFINE_SECTION_NOT_FOUND');
  if (!fieldConfig) throw new Error('LLM_REFINE_FIELD_NOT_FOUND');
  return [
    {
      role: 'system',
      content:
        COMBINED_STAGE.systemPrompt + '\n' +
        `Это поле: "${fieldConfig.label}". Стиль: ${fieldConfig.styleGuidance}.`,
    },
    {
      role: 'user',
      content: `${COMBINED_STAGE.userPromptPrefix}${text}`,
    },
  ];
}

function buildCombinedGenerationOptions(inputText, requestedMaxTokens) {
  const inputLen = typeof inputText === 'string' ? inputText.length : 0;
  const calculatedMaxTokens = calcRefineMaxTokens(inputLen);
  return {
    maxTokens: typeof requestedMaxTokens === 'number'
      ? Math.min(requestedMaxTokens, calculatedMaxTokens)
      : calculatedMaxTokens,
    ...COMBINED_STAGE.generation,
  };
}

// Legacy single-pass builder (kept for compatibility)
function buildRefineMessages(field, text) {
  return buildPunctuationMessages(field, text);
}

function buildSpellingGenerationOptions(inputText, requestedMaxTokens) {
  const inputLen = typeof inputText === 'string' ? inputText.length : 0;
  const calculatedMaxTokens = calcRefineMaxTokens(inputLen);
  return {
    maxTokens: typeof requestedMaxTokens === 'number'
      ? Math.min(requestedMaxTokens, calculatedMaxTokens)
      : calculatedMaxTokens,
    ...SPELLING_STAGE.generation,
  };
}

function buildPunctuationGenerationOptions(inputText, requestedMaxTokens) {
  const inputLen = typeof inputText === 'string' ? inputText.length : 0;
  const calculatedMaxTokens = calcRefineMaxTokens(inputLen);
  return {
    maxTokens: typeof requestedMaxTokens === 'number'
      ? Math.min(requestedMaxTokens, calculatedMaxTokens)
      : calculatedMaxTokens,
    ...PUNCTUATION_STAGE.generation,
  };
}

function buildRefineGenerationOptions(field, inputText, requestedMaxTokens) {
  return buildPunctuationGenerationOptions(inputText, requestedMaxTokens);
}

module.exports = {
  REFINE_SECTIONS,
  SPELLING_STAGE,
  PUNCTUATION_STAGE,
  COMBINED_STAGE,
  ALLOWED_REFINE_FIELDS,
  getRefineSectionByField,
  getRefineFieldConfig,
  buildSpellingMessages,
  buildPunctuationMessages,
  buildCombinedRefineMessages,
  buildCombinedGenerationOptions,
  buildRefineMessages,
  buildSpellingGenerationOptions,
  buildPunctuationGenerationOptions,
  buildRefineGenerationOptions,
  calcRefineMaxTokens,
};