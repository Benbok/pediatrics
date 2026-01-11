import React, { InputHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    onRightIconClick?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, leftIcon, rightIcon, onRightIconClick, id, ...props }, ref) => {
        const inputId = id || props.name;

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        className={cn(
                            "w-full h-10 bg-white dark:bg-slate-900 border rounded-lg text-sm transition-all duration-200 placeholder:text-slate-400",
                            "focus:outline-none focus:ring-2 focus:ring-offset-0",
                            leftIcon ? "pl-10" : "pl-3",
                            rightIcon ? "pr-10" : "pr-3",
                            error
                                ? "border-red-300 text-red-900 focus:ring-red-500/20 focus:border-red-500"
                                : "border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-primary-500/20 focus:border-primary-500",
                            props.disabled && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800",
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <div
                            className={cn(
                                "absolute inset-y-0 right-0 pr-3 flex items-center text-slate-600",
                                onRightIconClick ? "cursor-pointer hover:text-slate-800" : "pointer-events-none"
                            )}
                            onClick={onRightIconClick}
                        >
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-1 text-xs text-red-500 font-medium animate-in slide-in-from-top-1">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
