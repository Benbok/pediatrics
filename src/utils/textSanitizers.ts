export function sanitizeDisplayText(input: string | null | undefined): string {
    if (!input) {
        return '';
    }

    const withoutTags = input.replace(/<[^>]*>/gi, ' ');

    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        const textarea = window.document.createElement('textarea');
        textarea.innerHTML = withoutTags;
        return textarea.value.replace(/\s+/g, ' ').trim();
    }

    return withoutTags
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}
