import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    children: ReactNode;
    className?: string;
};

/** Contenedor de toda la página: cabecera arriba, contenido y pie. */
export function AppShell({ children, className }: Props) {
    return (
        <div className={cn('flex min-h-screen w-full flex-col', className)}>
            {children}
        </div>
    );
}
