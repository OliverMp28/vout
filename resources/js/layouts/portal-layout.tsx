import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AppShell } from '@/components/app-shell';
import type { AppLayoutProps } from '@/types';

export default function PortalLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="header" className="min-h-screen flex flex-col bg-background">
            <a 
                href="#main-content" 
                className="absolute left-4 top-4 z-100 -translate-y-[150%] rounded-md bg-primary px-4 py-2 text-primary-foreground shadow-sm transition-transform focus:translate-y-0"
            >
                Saltar al contenido principal
            </a>
            
            <AppHeader breadcrumbs={breadcrumbs} />
            
            <main id="main-content" className="flex-1 w-full mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8 animate-slide-up-fade" tabIndex={-1}>
                {children}
            </main>
            
            <AppFooter />
        </AppShell>
    );
}
