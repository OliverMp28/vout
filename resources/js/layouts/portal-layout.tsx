import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AppShell } from '@/components/app-shell';
import { CookieBanner } from '@/components/cookie-consent/cookie-banner';
import { MascotProvider } from '@/components/mascot/mascot-provider';
import type { AppLayoutProps } from '@/types';

export default function PortalLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <MascotProvider>
            <AppShell
                variant="header"
                className="mesh-gradient-bg flex min-h-screen flex-col"
            >
                <a
                    href="#main-content"
                    className="absolute top-4 left-4 z-100 -translate-y-[150%] rounded-md bg-primary px-4 py-2 text-primary-foreground shadow-sm transition-transform focus:translate-y-0"
                >
                    Saltar al contenido principal
                </a>

                <AppHeader breadcrumbs={breadcrumbs} />

                <main
                    id="main-content"
                    className="animate-slide-up-fade mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8"
                    tabIndex={-1}
                >
                    {children}
                </main>

                <AppFooter />
                <CookieBanner />
            </AppShell>
        </MascotProvider>
    );
}
