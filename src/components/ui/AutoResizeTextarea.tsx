import React, { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';

type AutoResizeTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    maxHeight?: number;
    autoResize?: boolean;
};

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
    ({ maxHeight = 360, autoResize = true, onInput, value, style, ...props }, ref) => {
        const innerRef = useRef<HTMLTextAreaElement | null>(null);

        const setRefs = useCallback(
            (node: HTMLTextAreaElement | null) => {
                innerRef.current = node;

                if (!ref) {
                    return;
                }

                if (typeof ref === 'function') {
                    ref(node);
                    return;
                }

                ref.current = node;
            },
            [ref],
        );

        const resize = useCallback(() => {
            if (!autoResize || !innerRef.current) {
                return;
            }

            const element = innerRef.current;
            element.style.height = 'auto';

            const nextHeight = Math.min(element.scrollHeight, maxHeight);
            element.style.height = `${nextHeight}px`;
            element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }, [autoResize, maxHeight]);

        useLayoutEffect(() => {
            resize();
        }, [resize, value]);

        const handleInput = useCallback(
            (event: React.FormEvent<HTMLTextAreaElement>) => {
                resize();
                onInput?.(event);
            },
            [onInput, resize],
        );

        return (
            <textarea
                {...props}
                ref={setRefs}
                value={value}
                onInput={handleInput}
                style={{
                    ...style,
                    overflowY: style?.overflowY,
                }}
            />
        );
    },
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
