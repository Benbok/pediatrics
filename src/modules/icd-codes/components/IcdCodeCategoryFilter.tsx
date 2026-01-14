import React from 'react';
import { Button } from '../../../components/ui/Button';

interface IcdCodeCategoryFilterProps {
    categories: string[];
    selectedCategory: string | null;
    onCategorySelect: (category: string | null) => void;
}

export const IcdCodeCategoryFilter: React.FC<IcdCodeCategoryFilterProps> = ({
    categories,
    selectedCategory,
    onCategorySelect
}) => {
    return (
        <div className="flex flex-wrap gap-2">
            <Button
                variant={selectedCategory === null ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onCategorySelect(null)}
                className="font-mono"
            >
                Все
            </Button>
            {categories.map((category) => (
                <Button
                    key={category}
                    variant={selectedCategory === category ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => onCategorySelect(category)}
                    className="font-mono min-w-[2.5rem]"
                >
                    {category}
                </Button>
            ))}
        </div>
    );
};
