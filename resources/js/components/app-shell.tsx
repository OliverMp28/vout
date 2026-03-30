import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type Props = {
    children: ReactNode;
    variant?: 'header' | 'sidebar';
    className?: string;
};

export function AppShell({ children, variant = 'header', className }: Props) {
    const isOpen = usePage().props.sidebarOpen;

    if (variant === 'header') {
        return (
            <div className={cn("flex min-h-screen w-full flex-col", className)}>
                {children}
            </div>
        );
    }

    return (
        <SidebarProvider defaultOpen={isOpen} className={className}>
            {children}
        </SidebarProvider>
    );
}
