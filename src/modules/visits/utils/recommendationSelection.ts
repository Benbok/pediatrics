export function toggleRecommendationSelection(items: string[], text: string): string[] {
    const normalizedText = text.trim();
    if (!normalizedText) {
        return items;
    }

    if (items.includes(normalizedText)) {
        return items.filter(item => item !== normalizedText);
    }

    return [...items, normalizedText];
}
