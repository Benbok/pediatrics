'use strict';

const REFINE_SECTIONS = Object.freeze({
  diseaseHistory: Object.freeze({
    id: 'diseaseHistory',
    fields: Object.freeze(['complaints', 'diseaseOnset', 'diseaseCourse', 'treatmentBeforeVisit']),
    systemPrompt:
      'Ты — медицинский редактор. Исправь только орфографию, регистр и пунктуацию. ' +
      'Не добавляй новую информацию и не меняй клинический смысл. ' +
      'Нормализуй обычные слова к стандартному письменному регистру (не ALL CAPS), ' +
      'но медицинские аббревиатуры и коды (например ОРВИ, CRP, ICD-10) сохраняй как есть. ' +
      'Числа и единицы измерения приводи к стандартному медицинскому формату (38.5 → 38,5°C; 120/80 → 120/80 мм рт. ст.). ' +
      'Не добавляй заголовки, двоеточия, списки и любые новые структуры текста. ' +
      'Не расшифровывай сокращения и не заменяй термины синонимами. ' +
      'Верни ТОЛЬКО исправленный текст. Никаких пояснений, приветствий или маркеров окончания.',
    userPromptPrefix:
      'Исправь текст ниже: орфография, пунктуация, регистр обычных слов. ' +
      'Сохрани клинический смысл, аббревиатуры, коды, числа и единицы измерения. ' +
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

function buildRefineMessages(field, text) {
  const section = getRefineSectionByField(field);
  if (!section) throw new Error('LLM_REFINE_SECTION_NOT_FOUND');
  return [
    { role: 'system', content: section.systemPrompt },
    { role: 'user', content: `${section.userPromptPrefix}\n\nТЕКСТ:\n${text}` },
  ];
}

function buildRefineGenerationOptions(field, inputText) {
  const section = getRefineSectionByField(field);
  if (!section) throw new Error('LLM_REFINE_SECTION_NOT_FOUND');

  const inputLen = typeof inputText === 'string' ? inputText.length : 0;
  return {
    maxTokens: calcRefineMaxTokens(inputLen),
    ...section.generation,
  };
}

module.exports = {
  REFINE_SECTIONS,
  ALLOWED_REFINE_FIELDS,
  getRefineSectionByField,
  buildRefineMessages,
  buildRefineGenerationOptions,
  calcRefineMaxTokens,
};