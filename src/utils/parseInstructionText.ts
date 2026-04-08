/**
 * Парсер текста инструкции к препарату.
 *
 * Три прохода:
 *   0. Presplit — вставляем \n\n перед известными маркерами начала разделов
 *      (для текстов без явных заголовков, хранящихся одним блоком).
 *   1. Ищем явные заголовки разделов (напр. «Противопоказания:», «ДОЗИРОВКА»)
 *      → разбиваем текст по ним.
 *   2. Если явных заголовков нет — paragraph-level классификация по фразам-маркерам
 *      из официальных инструкций по медицинскому применению.
 */

export interface InstructionSection {
    id: string;
    label: string;
    text: string;
    /** Tailwind-классы для бейджа раздела (bg + text + border) */
    colorClass: string;
    /** Приоритет отображения: 1 = первым/крупнее, 2 = обычный, 3 = мелким */
    priority: 1 | 2 | 3;
}

interface SectionDef {
    id: string;
    label: string;
    colorClass: string;
    priority: 1 | 2 | 3;
    /** Regex для явного заголовка раздела в тексте (case-insensitive) */
    headerRe: RegExp;
    /** Regex для классификации первой строки абзаца, когда заголовков нет */
    contentRe?: RegExp;
}

const SECTION_DEFS: SectionDef[] = [
    {
        id: 'indications',
        label: 'Показания',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
        priority: 1,
        headerRe: /показания(\s+к\s+(применению|использованию))?\s*[:\n\r]/i,
        contentRe: /^(инфекционно-воспалительные|назначают при|применяют при|лечение [а-яёa-z]|терапия [а-яёa-z]|применяется для)/i,
    },
    {
        id: 'contraindications',
        label: 'Противопоказания',
        colorClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
        priority: 1,
        headerRe: /противопоказания\s*[:\n\r]/i,
        contentRe: /^(повышенная\s+чувствительность|гиперчувствительность|противопоказан[оа]?\s+(при|применение|детям)|не\s+применяется\s+при|неврит\s+слухового\s+нерва|тяжел[ао][яе]\s+хроническ)/i,
    },
    {
        id: 'caution',
        label: 'С осторожностью',
        colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
        priority: 2,
        headerRe: /с\s+осторожностью\s*[:\n\r]/i,
        contentRe: /^с\s+осторожностью\s+(следует|можно|применять|назначать|использовать)/i,
    },
    {
        id: 'dosage',
        label: 'Дозировка и применение',
        colorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
        priority: 1,
        headerRe: /(дозировка|способ\s+применения|режим\s+дозирования|применение\s+и\s+дозы|дозы\s+и\s+способ)\s*[:\n\r]/i,
        contentRe: /^(для\s+(в\/в|в\/м|внутривенного|внутримышечного|внутрь|перорального|ингаляционного)|суточная\s+доза|взрослым?\s+и\s+детям|взрослые?\s+и\s+подростки|препарат\s+вводят|принимают\s+внутрь|назначают\s+в\/[мвМВ])/i,
    },
    {
        id: 'sideEffects',
        label: 'Побочные действия',
        colorClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
        priority: 2,
        headerRe: /(побочные\s+(действия|эффекты)|нежелательные\s+реакции)\s*[:\n\r]/i,
        contentRe: /^(со\s+стороны\s+[а-яё]|аллергические\s+реакции\s*:|местные\s+реакции\s*:|нечасто\s*[-:—]|редко\s*[-:—]|очень\s+редко\s*[-:—]|частота\s+неизвестна)/i,
    },
    {
        id: 'interactions',
        label: 'Лекарственное взаимодействие',
        colorClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
        priority: 2,
        headerRe: /лекарственное\s+взаимодействие\s*[:\n\r]/i,
        contentRe: /^(одновременное\s+применение\s+[а-яёa-z]|при\s+совместном\s+применении\s+[а-яёa-z]|механизм\s+взаимодействия|проявляет\s+синергизм|фармацевтически\s+несовместим)/i,
    },
    {
        id: 'overdose',
        label: 'Передозировка',
        colorClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
        priority: 2,
        headerRe: /передозировка\s*[:\n\r]/i,
        contentRe: /^(симптомы\s*:\s*(токсические|передозировки)|лечение\s*:\s*для\s+снятия\s+блокады)/i,
    },
    {
        id: 'special',
        label: 'Особые указания',
        colorClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
        priority: 2,
        headerRe: /(особые\s+указания|меры\s+предосторожности)\s*[:\n\r]/i,
        contentRe: /^(перед\s+(началом\s+лечения\s+следует|применением\s+определяют)|необходим\s+контроль|при\s+подозрении\s+на|с\s+целью\s+профилактики|в\s+случае\s+развития|в\s+период\s+лечения\s+необходимо|содержащийся\s+в\s+составе\s+препарата)/i,
    },
    {
        id: 'pharmacodynamics',
        label: 'Фармакодинамика',
        colorClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800',
        priority: 3,
        headerRe: /фармакодинамика\s*[:\n\r]/i,
        contentRe: /^(полусинтетический\s+антибиотик|механизм\s+действия|высокоактивен\s+в\s+отношении|действует\s+бактерицидно|антибиотик\s+широкого\s+спектра|к\s+препарату\s+устойчивы|амикацин\s+не\s+теряет)/i,
    },
    {
        id: 'pharmacokinetics',
        label: 'Фармакокинетика',
        colorClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800',
        priority: 3,
        headerRe: /фармакокинетика\s*[:\n\r]/i,
        contentRe: /^(всасывание\b|распределение\b|метаболизм\b|выведение\b|фармакокинетика\s+в\s+особых|c\s*max\b|t\s*½|t\s*1\/2)/i,
    },
    {
        id: 'specialGroups',
        label: 'Особые группы пациентов',
        colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800',
        priority: 3,
        headerRe: /(особые\s+группы|применение\s+у\s+(особых|отдельных)\s+групп|пациенты\s+особых\s+групп)\s*[:\n\r]/i,
        contentRe: /^(у\s+пациентов\s+с\s+(почечной|печёночной|печеночной)|у\s+пожилых\s+пациентов|при\s+беременности\s+и\s+лактации|при\s+кормлении\s+грудью)/i,
    },
    {
        id: 'driving',
        label: 'Влияние на управление ТС',
        colorClass: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800',
        priority: 3,
        headerRe: /влияние\s+на\s+(способность\s+)?(управлять|управление)\s*[:\n\r]/i,
        contentRe: /управлени[еяю]\s+транспортными\s+средствами/i,
    },
    {
        id: 'storage',
        label: 'Условия хранения',
        colorClass: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
        priority: 3,
        headerRe: /(условия\s+хранения|условия\s+отпуска)\s*[:\n\r]/i,
        contentRe: /^(список\s+[а-яёА-ЯЁ]\.|хранить\s+при|срок\s+годности|препарат\s+следует\s+хранить)/i,
    },
];

// ─────────────────────────────────────────────────────────────

/**
 * Паттерны, перед которыми нужно вставить \n\n, чтобы разбить сплошной
 * текст на параграфы даже при отсутствии явных заголовков разделов.
 */
const INJECT_BOUNDARIES: RegExp[] = [
    /С\s+осторожностью\s+(?:следует|можно)\s+применять/gi,
    /Препарат\s+вводят\s/gi,
    /Принимают\s+внутрь/gi,
    /Взрослым\s+(?:и\s+детям|назначают)/gi,
    /Со\s+стороны\s+[а-яёА-ЯЁ]/g,
    /Аллергические\s+реакции\s*:/gi,
    /Местные\s+реакции\s*:/gi,
    /Проявляет\s+синергизм/gi,
    /Фармацевтически\s+несовместим/gi,
    /Симптомы\s*:\s*токсические/gi,
    /Передозировка\s*[:\n\r]/gi,
    /Перед\s+применением\s+определяют/gi,
    /В\s+период\s+лечения\s+необходимо/gi,
    /Содержащийся\s+в\s+составе\s+препарата/gi,
    /Полусинтетический\s+антибиотик/gi,
    /Высокоактивен\s+в\s+отношении/gi,
    /Антибиотик\s+широкого\s+спектра/gi,
    /Всасывание\s+(?:После|Препарат)/gi,
    /Распределение\s+Связывание/gi,
    /Метаболизм\s+(?:Не\s+метаболизируется|Метаболизируется)/gi,
    /Выведение\s+T\s*(?:½|1\/2)\s/gi,
    /Фармакокинетика\s+в\s+особых/gi,
    /Список\s+[А-ЯЁа-яё]\./gi,
    /Противопоказано\s+применение\s+при/gi,
];

/**
 * Вставляет \n\n перед известными маркерами начала разделов.
 * Убирает известные артефакты экспорта (напр. «Not Care»).
 */
function presplitText(text: string): string {
    let result = text.replace(/\bNot\s+Care\b\s*/gi, '');
    for (const re of INJECT_BOUNDARIES) {
        result = result.replace(re, (match) => '\n\n' + match);
    }
    return result.replace(/\n{3,}/g, '\n\n').trim();
}

// ─────────────────────────────────────────────────────────────

function defById(id: string): SectionDef | undefined {
    return SECTION_DEFS.find(d => d.id === id);
}

function makeSection(id: string, text: string): InstructionSection {
    const def = defById(id);
    if (!def || id === 'unknown') {
        return { id: 'unknown', label: 'Инструкция', text, colorClass: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600', priority: 2 };
    }
    return { id: def.id, label: def.label, text, colorClass: def.colorClass, priority: def.priority };
}

// ─────────────────────────────────────────────────────────────

/**
 * Разбирает текст инструкции на структурированные разделы.
 * Если текст нечитаемый или пустой — возвращает один раздел «Инструкция».
 */
export function parseInstructionText(text: string): InstructionSection[] {
    if (!text || !text.trim()) return [];

    // ── Pass 0: inject paragraph breaks at section boundaries ──
    const processed = presplitText(text);

    // ── Pass 1: find explicit section headers ──────────────────
    type Match = { pos: number; endPos: number; defId: string };
    const allMatches: Match[] = [];

    for (const def of SECTION_DEFS) {
        const re = new RegExp(def.headerRe.source, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(processed)) !== null) {
            allMatches.push({ pos: m.index, endPos: m.index + m[0].length, defId: def.id });
        }
    }

    if (allMatches.length >= 2) {
        // Sort by position, deduplicate sections (keep earliest occurrence)
        allMatches.sort((a, b) => a.pos - b.pos);
        const seen = new Set<string>();
        const unique = allMatches.filter(m => {
            if (seen.has(m.defId)) return false;
            seen.add(m.defId);
            return true;
        });

        const result: InstructionSection[] = [];

        // Text before first match
        const prefix = processed.slice(0, unique[0].pos).trim();
        if (prefix) result.push(makeSection('unknown', prefix));

        for (let i = 0; i < unique.length; i++) {
            const content = processed
                .slice(unique[i].endPos, i + 1 < unique.length ? unique[i + 1].pos : processed.length)
                .trim()
                // Remove stray heading repetition at the start of content
                .replace(new RegExp('^' + defById(unique[i].defId)?.headerRe.source ?? '', 'i'), '')
                .trim();
            if (content) result.push(makeSection(unique[i].defId, content));
        }

        return result;
    }

    // ── Pass 2: paragraph-level classification ─────────────────
    const paragraphs = processed
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean);

    if (paragraphs.length <= 1) {
        return [makeSection('unknown', processed)];
    }

    const result: InstructionSection[] = [];
    let current: InstructionSection | null = null;

    for (const para of paragraphs) {
        let matched = false;
        for (const def of SECTION_DEFS) {
            if (def.contentRe && def.contentRe.test(para)) {
                if (current && current.id === def.id) {
                    current.text += '\n\n' + para;
                } else {
                    current = makeSection(def.id, para);
                    result.push(current);
                }
                matched = true;
                break;
            }
        }
        if (!matched) {
            if (current) {
                current.text += '\n\n' + para;
            } else {
                current = makeSection('unknown', para);
                result.push(current);
            }
        }
    }

    return result;
}
