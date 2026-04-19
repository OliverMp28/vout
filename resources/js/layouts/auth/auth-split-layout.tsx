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
                {/* Fondo gradiente base */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(145deg, var(--vout-gradient-start), var(--vout-gradient-end))',
                    }}
                />

                {/* Grid de líneas sutil — técnico, suave */}
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-60"
                    style={{
                        backgroundImage: [
                            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px)',
                            'linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
                        ].join(', '),
                        backgroundSize: '72px 72px',
                        maskImage:
                            'radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 90%)',
                    }}
                />

                {/* Grain noise — cereza del pastel, textura premium */}
                <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12] mix-blend-overlay"
                >
                    <filter id="auth-grain">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.85"
                            numOctaves="2"
                            seed="4"
                        />
                        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0" />
                    </filter>
                    <rect
                        width="100%"
                        height="100%"
                        filter="url(#auth-grain)"
                    />
                </svg>

                {/* Aros concéntricos con retícula — evoca el enfoque facial */}
                <svg
                    aria-hidden
                    className="h-xl absolute -top-24 -right-28 w-xl"
                    viewBox="0 0 400 400"
                    fill="none"
                >
                    <circle
                        cx="200"
                        cy="200"
                        r="80"
                        stroke="white"
                        strokeOpacity="0.22"
                        strokeWidth="1"
                    />
                    <circle
                        cx="200"
                        cy="200"
                        r="140"
                        stroke="white"
                        strokeOpacity="0.15"
                        strokeWidth="1"
                    />
                    <circle
                        cx="200"
                        cy="200"
                        r="200"
                        stroke="white"
                        strokeOpacity="0.09"
                        strokeWidth="1"
                    />
                    {/* Pequeñas marcas de retícula */}
                    <line
                        x1="200"
                        y1="60"
                        x2="200"
                        y2="96"
                        stroke="white"
                        strokeOpacity="0.3"
                    />
                    <line
                        x1="200"
                        y1="304"
                        x2="200"
                        y2="340"
                        stroke="white"
                        strokeOpacity="0.3"
                    />
                    <line
                        x1="60"
                        y1="200"
                        x2="96"
                        y2="200"
                        stroke="white"
                        strokeOpacity="0.3"
                    />
                    <line
                        x1="304"
                        y1="200"
                        x2="340"
                        y2="200"
                        stroke="white"
                        strokeOpacity="0.3"
                    />
                </svg>

                {/* Triángulo suave — esquina inferior-izquierda */}
                <svg
                    aria-hidden
                    className="absolute -bottom-16 -left-10 h-72 w-72 opacity-[0.14]"
                    viewBox="0 0 200 200"
                    fill="none"
                >
                    <polygon
                        points="100,20 180,180 20,180"
                        stroke="white"
                        strokeWidth="1"
                    />
                    <polygon
                        points="100,70 150,160 50,160"
                        stroke="white"
                        strokeOpacity="0.55"
                        strokeWidth="1"
                    />
                </svg>

                {/* Orbes ambient glow */}
                <div
                    className="animate-glow-pulse absolute -top-32 -left-32 h-80 w-80 rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)',
                    }}
                />
                <div
                    className="animate-glow-pulse absolute right-0 -bottom-20 h-72 w-72 rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(190,150,255,0.22), transparent 70%)',
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
                            className="h-8 w-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.25)] select-none"
                        />
                    </Link>

                    {/* Centro: eslogan + feature cards */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            {/* Badge de confianza — IdP / OAuth */}
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                                <span className="size-1.5 animate-pulse rounded-full bg-white/80" />
                                Identity Provider · OAuth 2.0
                            </div>

                            <h2 className="text-3xl leading-[1.15] font-bold tracking-tight">
                                Tu pasaporte al
                                <br />
                                <span className="bg-linear-to-r from-white to-white/70 bg-clip-text text-transparent">
                                    mundo gaming.
                                </span>
                            </h2>
                            <p className="max-w-sm text-base leading-relaxed text-white/75">
                                Una cuenta que funciona en todo el ecosistema.
                                Sin descargas, sin cuentas duplicadas.
                            </p>
                        </div>

                        {/* Feature cards con glassmorfismo */}
                        <div className="space-y-3">
                            <div className="glass-card flex items-center gap-3 px-4 py-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/10">
                                    <Users className="size-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        Una cuenta, todos los juegos
                                    </p>
                                    <p className="text-xs text-white/60">
                                        Login único para todo el ecosistema
                                    </p>
                                </div>
                            </div>

                            <div className="glass-card flex items-center gap-3 px-4 py-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/10">
                                    <Scan className="size-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        Juega sin manos
                                    </p>
                                    <p className="text-xs text-white/60">
                                        Control por gestos faciales con tu
                                        cámara
                                    </p>
                                </div>
                            </div>

                            <div className="glass-card flex items-center gap-3 px-4 py-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/10">
                                    <Gamepad2 className="size-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">
                                        Portal de juegos
                                    </p>
                                    <p className="text-xs text-white/60">
                                        Jugables al instante desde el navegador
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-4 text-xs text-white/45">
                        <span>© {new Date().getFullYear()} Vout</span>
                        <span className="text-right">
                            Identidad y gaming accesible
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── Panel del formulario ──────────────────────── */}
            <div className="relative flex w-full items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
                {/* Glow sutil detrás del formulario (se nota más en mobile) */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70 lg:opacity-30"
                    style={{
                        background:
                            'radial-gradient(55% 100% at 50% 0%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 75%)',
                    }}
                />

                {/* Banner de marca en mobile — tira fina con el gradiente */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[3px] lg:hidden"
                    style={{
                        background:
                            'linear-gradient(90deg, var(--vout-gradient-start), var(--vout-gradient-end))',
                    }}
                />

                <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
                    <AppearanceSwitcher />
                    <LanguageSwitcher />
                </div>

                <div className="relative mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
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
