import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
    size?: 'sm' | 'md';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {

        const variants = {
            default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            primary: "bg-primary-50 text-primary-700 border border-primary-100 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800",
            success: "bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
            warning: "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
            error: "bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
        };

        const sizes = {
            sm: "px-2 py-0.5 text-xs rounded-md",
            md: "px-2.5 py-0.5 text-sm rounded-lg",
        };

        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center font-medium",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';
