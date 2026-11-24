import { Link, usePage } from '@inertiajs/react';
import { Camera, MonitorSmartphone, UserCheck } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { AppearanceSwitcher } from '@/components/appearance-switcher';
import { CookieBanner } from '@/components/cookie-consent/cookie-banner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { VouSvg } from '@/components/mascot/vou-svg';
import { useTranslation } from '@/hooks/use-translation';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

const FACTS = [
    { key: 'recognise', icon: UserCheck },
    { key: 'camera', icon: Camera },
    { key: 'install', icon: MonitorSmartphone },
] as const;

/**
 * Acceso a la cuenta: a la izquierda (en escritorio) qué es una cuenta de
 * Vout, con tres datos concretos y Vou; a la derecha, el formulario. Usa los
 * mismos tokens que el resto del portal, así que va bien en claro y oscuro.
 */
export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;
    const { t } = useTranslation();

    return (
        <div className="relative grid min-h-dvh bg-background lg:grid-cols-[1fr_1.1fr]">
            {/* ─── Qué es una cuenta de Vout ───────────────────── */}
            <div className="relative hidden border-r bg-surface-1 lg:block">
                <div className="flex h-full flex-col justify-between gap-10 p-10">
                    <Link
                        href={home()}
                        className="inline-flex w-fit items-center gap-3 rounded-control"
                    >
                        <span className="sr-only">{name}</span>
                        <AppLogo className="h-9" />
                    </Link>

                    <div className="max-w-md space-y-8">
                        <div className="space-y-3">
                            <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-balance">
                                {t('auth.panel.title')}
                            </h2>
                            <p className="text-base leading-relaxed text-muted-foreground">
                                {t('auth.panel.subtitle')}
                            </p>
                        </div>

                        <ul className="divide-y rounded-surface border bg-background shadow-surface">
                            {FACTS.map(({ key, icon: Icon }) => (
                                <li
                                    key={key}
                                    className="flex gap-3 px-4 py-3.5"
                                >
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-signal-soft text-foreground">
                                        <Icon className="size-4" aria-hidden />
                                    </span>
                                    <div>
                                        <p className="text-sm font-bold">
                                            {t(`auth.panel.${key}.title`)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {t(`auth.panel.${key}.desc`)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                        <span className="text-xs text-muted-foreground">
                            © {new Date().getFullYear()} Vout
                        </span>
                        <div className="size-20" aria-hidden>
                            <VouSvg />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Formulario ─────────────────────────────────── */}
            <div className="relative flex w-full items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
                    <AppearanceSwitcher />
                    <LanguageSwitcher />
                </div>

                <div className="relative mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
                    {/* Logo en móvil */}
                    <Link
                        href={home()}
                        className="flex items-center justify-center gap-2.5 lg:hidden"
                    >
                        <AppLogo className="h-8" />
                    </Link>

                    <div className="flex flex-col gap-2 text-center lg:text-left">
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>

                    <div>{children}</div>
                </div>
            </div>

            <CookieBanner />
        </div>
    );
}
