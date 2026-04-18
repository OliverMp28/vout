import { Link, usePage } from '@inertiajs/react';
import { Gamepad2, Scan, Users } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { AppearanceSwitcher } from '@/components/appearance-switcher';
import { CookieBanner } from '@/components/cookie-consent/cookie-banner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="relative grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
            {/* ─── Panel decorativo ──────────────────────────── */}
            <div className="relative hidden overflow-hidden lg:block">
                {/* Fondo gradiente */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(145deg, var(--vout-gradient-start), var(--vout-gradient-end))',
                    }}
                />

                {/* Orbes ambient glow */}
                <div
                    className="animate-glow-pulse absolute -top-24 -left-24 h-72 w-72 rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
                    }}
                />
                <div
                    className="animate-glow-pulse absolute -right-16 bottom-32 h-56 w-56 rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)',
                        animationDelay: '2s',
                    }}
                />

                {/* Contenido del panel */}
                <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
                    {/* Logo */}
                    <Link
                        href={home()}
                        className="flex items-center transition-opacity duration-200 hover:opacity-80"
                    >
                        <span className="sr-only">{name}</span>
                        <img
                            src="/logos/vout-wordmark.png"
                            alt="Vout"
                            draggable={false}
                            className="h-8 w-auto select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                        />
                    </Link>

                    {/* Centro: eslogan + feature cards */}
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <h2 className="text-3xl leading-tight font-bold tracking-tight">
                                Tu pasaporte al
                                <br />
                                mundo gaming
                            </h2>
                            <p className="max-w-xs text-base leading-relaxed text-white/70">
                                Una cuenta, todos los juegos. Controla con tu
                                rostro, juega sin límites.
                            </p>
                        </div>

                        {/* Feature cards con glassmorfismo */}
                        <div className="space-y-3">
                            <div className="glass-card animate-float flex items-center gap-3 px-4 py-3">
                                <Users className="size-5 shrink-0 text-white/80" />
                                <div>
                                    <p className="text-sm font-medium">
                                        Identidad unificada
                                    </p>
                                    <p className="text-xs text-white/60">
                                        Una cuenta para todo el ecosistema
                                    </p>
                                </div>
                            </div>

                            <div
                                className="glass-card animate-float flex items-center gap-3 px-4 py-3"
                                style={{ animationDelay: '1s' }}
                            >
                                <Scan className="size-5 shrink-0 text-white/80" />
                                <div>
                                    <p className="text-sm font-medium">
                                        Control facial
                                    </p>
                                    <p className="text-xs text-white/60">
                                        Juega usando gestos con tu cámara
                                    </p>
                                </div>
                            </div>

                            <div
                                className="glass-card animate-float flex items-center gap-3 px-4 py-3"
                                style={{ animationDelay: '2s' }}
                            >
                                <Gamepad2 className="size-5 shrink-0 text-white/80" />
                                <div>
                                    <p className="text-sm font-medium">
                                        Portal de juegos
                                    </p>
                                    <p className="text-xs text-white/60">
                                        Descubre y juega desde el navegador
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-sm text-white/40">
                        © {new Date().getFullYear()} Vout. Plataforma de
                        identidad y gaming accesible.
                    </p>
                </div>
            </div>

            {/* ─── Panel del formulario ──────────────────────── */}
            <div className="relative flex w-full items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
                    <AppearanceSwitcher />
                    <LanguageSwitcher />
                </div>

                <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
                    {/* Logo en móvil */}
                    <Link
                        href={home()}
                        className="flex items-center justify-center lg:hidden"
                    >
                        <AppLogoIcon alt="Vout" className="size-12" />
                    </Link>

                    {/* Título y descripción */}
                    <div className="flex flex-col gap-2 text-center lg:text-left">
                        <h1 className="text-xl font-semibold tracking-tight">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Contenido del formulario */}
                    <div className="animate-slide-up-fade">{children}</div>
                </div>
            </div>

            <CookieBanner />
        </div>
    );
}
