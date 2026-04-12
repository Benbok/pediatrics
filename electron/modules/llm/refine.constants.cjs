'use strict';

const REFINE_SECTIONS = Object.freeze({
  diseaseHistory: Object.freeze({
    id: 'diseaseHistory',
    title: 'Анамнез заболевания',
    fields: Object.freeze(['complaints', 'diseaseOnset', 'diseaseCourse', 'treatmentBeforeVisit']),
    fieldConfigs: Object.freeze({
      complaints: Object.freeze({
        label: 'Жалобы на момент поступления',
        styleGuidance: 'Сохраняй формат кратких клинических жалоб. Предпочитай компактное перечисление симптомов через запятую без лишней литературности.',
      }),
      diseaseOnset: Object.freeze({
        label: 'Когда началось заболевание и первые симптомы',
        styleGuidance: 'Сохраняй хронологическое описание начала заболевания. Допустимы короткие причинно-временные связки, но без добавления новых фактов.',
      }),
      diseaseCourse: Object.freeze({
        label: 'Течение болезни',
        styleGuidance: 'Сохраняй связный клинический нарратив о динамике симптомов и лечении. Предпочитай 1-3 коротких предложения в одной строке.',
      }),
      treatmentBeforeVisit: Object.freeze({
        label: 'Лечение, проводимое до обращения',
        styleGuidance: 'Сохраняй формат фактического перечисления препаратов, доз, кратности и эффекта. Не обобщай и не переставляй клинически значимые элементы.',
      }),
    }),
    systemPrompt:
      'Ты — медицинский редактор. Исправь только орфографию, регистр и пунктуацию. ' +
      'Не добавляй новую информацию и не меняй клинический смысл. ' +
      'Нормализуй обычные слова к стандартному письменному регистру (не ALL CAPS), ' +
      'но медицинские аббревиатуры и коды (например ОРВИ, CRP, ICD-10) сохраняй как есть. ' +
      'Числа и единицы измерения сохраняй по значению и составу. Допустима только безопасная типографическая нормализация записи уже существующих значений и единиц. ' +
      'Если подряд идут три числа, похожие на дату, интерпретируй их как дату и оформляй в виде ДД.ММ.ГГ или ДД.MM.ГГГГ. ' +
      'Верни результат строго в одну строку: без переносов строк, без списков, без абзацев. ' +
      'Если в исходном тексте несколько мыслей, разделяй их обычными предложениями в одной строке. ' +
      'Не добавляй заголовки, двоеточия, списки и любые новые структуры текста. ' +
      'Не расшифровывай сокращения и не заменяй термины синонимами. ' +
      'Верни ТОЛЬКО исправленный текст. Никаких пояснений, приветствий или маркеров окончания.',
    userPromptPrefix:
      'Исправь текст ниже: орфография, пунктуация, регистр обычных слов. ' +
      'Сохрани клинический смысл, аббревиатуры, коды, числа и единицы измерения. ' +
      'Верни результат одной строкой. Если встречаются три числа подряд и это похоже на дату, оформи их как дату. ' +
      'Не меняй структуру текста, не добавляй двоеточия и заголовки.',
    generation: Object.freeze({
      temperature: 0.1,
      topP: 0.9,
      topK: 40,
      repeatPenalty: 1.05,
      stop: ['</s>', '<|im_end|>', '\n\n', 'Готово', 'Вот'],
    }),
  }),
});

// Динамический лимит: минимум 128, но подстраивается под длину ввода
function calcRefineMaxTokens(inputLength) {
  return Math.min(512, Math.max(128, Math.ceil(inputLength / 2.5)));
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

function buildRefineMessages(field, text) {
  const section = getRefineSectionByField(field);
  const fieldConfig = getRefineFieldConfig(field);
  if (!section) throw new Error('LLM_REFINE_SECTION_NOT_FOUND');
  if (!fieldConfig) throw new Error('LLM_REFINE_FIELD_NOT_FOUND');
  return [
    { role: 'system', content: section.systemPrompt },
    {
      role: 'user',
      content:
        `${section.userPromptPrefix}\n` +
        `РАЗДЕЛ: ${section.title}\n` +
        `ПОЛЕ: ${fieldConfig.label}\n` +
        `СТИЛЬ ПОЛЯ: ${fieldConfig.styleGuidance}\n\n` +
        `ТЕКСТ:\n${text}`,
    },
  ];
}

function buildRefineGenerationOptions(field, inputText, requestedMaxTokens) {
  const section = getRefineSectionByField(field);
  if (!section) throw new Error('LLM_REFINE_SECTION_NOT_FOUND');

  const inputLen = typeof inputText === 'string' ? inputText.length : 0;
  const calculatedMaxTokens = calcRefineMaxTokens(inputLen);
  return {
    maxTokens: typeof requestedMaxTokens === 'number'
      ? Math.min(requestedMaxTokens, calculatedMaxTokens)
      : calculatedMaxTokens,
    ...section.generation,
  };
}

module.exports = {
  REFINE_SECTIONS,
  ALLOWED_REFINE_FIELDS,
  getRefineSectionByField,
  getRefineFieldConfig,
  buildRefineMessages,
  buildRefineGenerationOptions,
  calcRefineMaxTokens,
};