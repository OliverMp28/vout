import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AppShell } from '@/components/app-shell';
import { CookieBanner } from '@/components/cookie-consent/cookie-banner';
import { MascotProvider } from '@/components/mascot/mascot-provider';
import { MascotRoot } from '@/components/mascot/mascot-root';
import { useTranslation } from '@/hooks/use-translation';
import type { AppLayoutProps } from '@/types';

export default function PortalLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { t } = useTranslation();

    return (
        <MascotProvider>
            <AppShell
                variant="header"
                className="flex min-h-screen flex-col bg-background"
            >
                <a
                    href="#main-content"
                    className="absolute top-4 left-4 z-100 -translate-y-[150%] rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-overlay transition-transform focus:translate-y-0"
                >
                    {t('nav.skip_to_content')}
                </a>

                <AppHeader breadcrumbs={breadcrumbs} />

                <main
                    id="main-content"
                    className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none md:px-6 lg:px-8"
                    tabIndex={-1}
                >
                    {children}
                </main>

                <AppFooter />
                <CookieBanner />
                <MascotRoot />
            </AppShell>
        </MascotProvider>
    );
}
