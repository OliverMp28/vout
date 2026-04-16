import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type InfoHintProps = {
    /** Texto invisible para lectores de pantalla, ej. "Ayuda sobre dominios". */
    label: string;
    /** Contenido del popover (texto plano, lista o mini-diagrama). */
    children: ReactNode;
    /** Tamaño máximo del popover. */
    width?: 'sm' | 'md';
    className?: string;
};

/**
 * Botón circular `?` que abre un Popover con explicación contextual.
 *
 * Pensado para anclarse junto a labels de campos técnicos en formularios:
 * mantiene la UI limpia (la jerga vive escondida) y a la vez accesible
 * (un click revela el qué/para qué del campo, con focus-visible y aria-label).
 */
export function InfoHint({
    label,
    children,
    width = 'sm',
    className,
}: InfoHintProps) {
    return (
        <Popover>
            <PopoverTrigger
                aria-label={label}
                className={cn(
                    'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground/70 transition-colors',
                    'hover:bg-muted hover:text-foreground',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    className,
                )}
            >
                <Info className="size-3.5" aria-hidden />
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                className={cn(
                    'space-y-2 text-xs leading-relaxed',
                    width === 'sm' ? 'w-64' : 'w-80',
                )}
            >
                {children}
            </PopoverContent>
        </Popover>
    );
}
