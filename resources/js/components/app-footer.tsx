import { Link } from '@inertiajs/react';
import { Github } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { useTranslation } from '@/hooks/use-translation';
import { home, visionLab } from '@/routes';
import { index as catalogIndex } from '@/routes/catalog';
import { docs as developersDocs, landing as developersLanding } from '@/routes/developers';
import { show as legalShow } from '@/routes/legal';

const GITHUB_REPO_URL = 'https://github.com/OliverMp28/vout';

export function AppFooter() {
    const currentYear = new Date().getFullYear();
    const { t } = useTranslation();

    const platformLinks = [
        { label: t('footer.home'), href: home().url },
        { label: t('footer.catalog'), href: catalogIndex().url },
        { label: t('footer.vision_lab'), href: visionLab().url },
    ];

    const developerLinks = [
        { label: t('footer.developer_portal'), href: developersLanding().url },
        {
            label: t('footer.integration_guide'),
            href: developersDocs('integration-guide').url,
        },
    ];

    const legalLinks = [
        { label: t('footer.legal.notice'), href: legalShow('aviso-legal').url },
        { label: t('footer.legal.privacy'), href: legalShow('privacidad').url },
        { label: t('footer.legal.cookies'), href: legalShow('cookies').url },
        { label: t('footer.legal.terms'), href: legalShow('terminos').url },
    ];

    return (
        <footer className="border-t border-border/40 bg-background/90">
            <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
                <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
                    <div className="space-y-6">
                        <Link href={home().url} className="flex items-center gap-2">
                            <AppLogo />
                        </Link>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            {t('footer.desc')}
                        </p>
                        <div className="flex items-center gap-4">
                            <a
                                href={GITHUB_REPO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                                aria-label={t('footer.source_code')}
                            >
                                <Github className="size-4" aria-hidden="true" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            {t('footer.platform')}
                        </h3>
                        <ul className="mt-4 space-y-3">
                            {platformLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            {t('footer.developers')}
                        </h3>
                        <ul className="mt-4 space-y-3">
                            {developerLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <a
                                    href={GITHUB_REPO_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                >
                                    {t('footer.source_code')}
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            {t('footer.legal.title')}
                        </h3>
                        <ul className="mt-4 space-y-3">
                            {legalLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-12 border-t border-border/40 pt-8">
                    <p className="text-center text-sm text-muted-foreground">
                        &copy; {currentYear} Vout Ecosystem. {t('footer.rights')}
                    </p>
                </div>
            </div>
        </footer>
    );
}
