import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to track which section is currently visible in the viewport
 * using Intersection Observer API
 */
export const useActiveSection = (sectionIds: string[], options?: {
    threshold?: number;
    rootMargin?: string;
}) => {
    const [activeSection, setActiveSection] = useState<string>(sectionIds[0] || '');
    const observerRef = useRef<IntersectionObserver | null>(null);
    
    // Track which sections are currently intersecting
    const intersectingRef = useRef<Map<string, number>>(new Map());

    // Update default when sectionIds change
    useEffect(() => {
        if (!activeSection && sectionIds.length > 0) {
            setActiveSection(sectionIds[0]);
        }
    }, [sectionIds, activeSection]);

    useEffect(() => {
        if (sectionIds.length === 0) return;

        // Cleanup previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const handleIntersection = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    intersectingRef.current.set(entry.target.id, entry.intersectionRatio);
                } else {
                    intersectingRef.current.delete(entry.target.id);
                }
            });

            // Find the first section that is intersecting (in order)
            for (const sectionId of sectionIds) {
                const ratio = intersectingRef.current.get(sectionId) || 0;
                if (ratio > 0) {
                    setActiveSection(sectionId);
                    return;
                }
            }
            
            // If no section is intersecting, keep the first one as default
            if (intersectingRef.current.size === 0 && sectionIds.length > 0) {
                setActiveSection(sectionIds[0]);
            }
        };

        // Use a simpler threshold and rootMargin
        observerRef.current = new IntersectionObserver(handleIntersection, {
            threshold: options?.threshold ?? [0, 0.1, 0.2],
            rootMargin: options?.rootMargin ?? '-100px 0px -40% 0px',
        });

        // Observe all sections with a small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            sectionIds.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    observerRef.current?.observe(element);
                }
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            observerRef.current?.disconnect();
        };
    }, [sectionIds, options?.threshold, options?.rootMargin]);

    const scrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (!element) {
            console.warn('Section element not found:', sectionId);
            return;
        }

        // Try to find the scrollable container by ID first, then by selectors
        let scrollContainer = document.getElementById('app-main-content') as HTMLElement;
        
        if (!scrollContainer) {
            scrollContainer = document.querySelector('main[class*="overflow-y-auto"]') as HTMLElement;
        }
        
        if (!scrollContainer) {
            scrollContainer = document.querySelector('main') as HTMLElement;
        }
        
        if (!scrollContainer) {
            scrollContainer = document.querySelector('[role="main"]') as HTMLElement;
        }
        
        if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
            // Get current scroll position
            const currentScrollTop = scrollContainer.scrollTop;
            
            // Calculate element position relative to viewport
            const elementRect = element.getBoundingClientRect();
            
            // Calculate offset for sticky header
            const header = document.querySelector('[data-visit-form-header]') as HTMLElement;
            const headerHeight = header ? header.getBoundingClientRect().height : 0;
            const extraOffset = 32; // Additional spacing below header
            
            // Calculate target scroll position
            // elementRect.top is relative to viewport, add current scroll to get absolute position
            const targetScrollTop = currentScrollTop + elementRect.top - headerHeight - extraOffset;
            
            console.log('Scrolling to section:', sectionId, {
                currentScrollTop,
                targetScrollTop: Math.max(0, targetScrollTop),
                headerHeight,
                elementTop: elementRect.top,
                scrollContainerId: scrollContainer.id,
            });

            scrollContainer.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth',
            });
        } else {
            // Fallback: use window scroll
            console.log('Using window scroll fallback for:', sectionId);
            const header = document.querySelector('[data-visit-form-header]') as HTMLElement;
            const headerHeight = header ? header.getBoundingClientRect().height : 0;
            const elementRect = element.getBoundingClientRect();
            const targetY = window.scrollY + elementRect.top - headerHeight - 32;
            
            window.scrollTo({
                top: Math.max(0, targetY),
                behavior: 'smooth',
            });
        }
        
        setActiveSection(sectionId);
    }, []);

    return { activeSection: activeSection || sectionIds[0] || '', scrollToSection };
};
