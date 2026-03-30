import { Link } from '@inertiajs/react';
import { Github, Twitter, Youtube } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { useTranslation } from '@/hooks/use-translation';

export function AppFooter() {
    const currentYear = new Date().getFullYear();
    const { t } = useTranslation();

    return (
        <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
                <div className="xl:grid xl:grid-cols-3 xl:gap-8">
                    <div className="space-y-8">
                        <Link href="/" className="flex items-center gap-2">
                            <AppLogo />
                        </Link>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            {t('footer.desc')}
                        </p>
                        <div className="flex space-x-6">
                            <a
                                href="#"
                                className="text-muted-foreground transition-colors hover:text-primary"
                            >
                                <span className="sr-only">Twitter</span>
                                <Twitter className="size-5" />
                            </a>
                            <a
                                href="#"
                                className="text-muted-foreground transition-colors hover:text-primary"
                            >
                                <span className="sr-only">GitHub</span>
                                <Github className="size-5" />
                            </a>
                            <a
                                href="#"
                                className="text-muted-foreground transition-colors hover:text-primary"
                            >
                                <span className="sr-only">YouTube</span>
                                <Youtube className="size-5" />
                            </a>
                        </div>
                    </div>
                    <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
                        <div className="md:grid md:grid-cols-2 md:gap-8">
                            <div>
                                <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
                                    {t('footer.platform')}
                                </h3>
                                <ul className="mt-4 space-y-4">
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.catalog')}
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.developers')}
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            MediaPipe Plus
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            <div className="mt-12 md:mt-0">
                                <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
                                    {t('footer.support')}
                                </h3>
                                <ul className="mt-4 space-y-4">
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.docs')}
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.guides')}
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.contact')}
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="md:grid md:grid-cols-2 md:gap-8">
                            <div>
                                <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
                                    {t('footer.legal')}
                                </h3>
                                <ul className="mt-4 space-y-4">
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.privacy')}
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.terms')}
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="#"
                                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            {t('footer.cookies')}
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-12 border-t border-border/40 pt-8">
                    <p className="text-sm text-muted-foreground xl:text-center">
                        &copy; {currentYear} Vout Ecosystem. {t('footer.rights')}
                    </p>
                </div>
            </div>
        </footer>
    );
}
