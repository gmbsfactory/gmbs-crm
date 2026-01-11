import React from 'react';
import { cn } from '@/lib/utils';

interface SectionLockProps {
    isLocked: boolean;
    children: React.ReactNode;
    className?: string;
}

/**
 * Composant utilitaire pour verrouiller une section de formulaire.
 * Utilise un fieldset pour désactiver proprement tous les éléments de formulaire enfants.
 */
export function SectionLock({ isLocked, children, className }: SectionLockProps) {
    return (
        <fieldset
            disabled={isLocked}
            className={cn(
                "min-w-0 border-0 p-0 m-0",
                isLocked && "opacity-80 pointer-events-none select-none",
                className
            )}
        >
            {children}
        </fieldset>
    );
}
