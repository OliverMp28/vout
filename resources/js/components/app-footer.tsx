import { Link } from '@inertiajs/react';
import { Github, Twitter, Youtube } from 'lucide-react';
import AppLogo from '@/components/app-logo';

export function AppFooter() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
                <div className="xl:grid xl:grid-cols-3 xl:gap-8">
                    <div className="space-y-8">
                        <Link href="/" className="flex items-center gap-2">
                             <AppLogo />
                        </Link>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            La plataforma central de identidad y gaming hands-free.
                            Impulsando la accesibilidad a través de la visión artificial.
                        </p>
                        <div className="flex space-x-6">
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <span className="sr-only">Twitter</span>
                                <Twitter className="size-5" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <span className="sr-only">GitHub</span>
                                <Github className="size-5" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <span className="sr-only">YouTube</span>
                                <Youtube className="size-5" />
                            </a>
                        </div>
                    </div>
                    <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
                        <div className="md:grid md:grid-cols-2 md:gap-8">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Plataforma</h3>
                                <ul className="mt-4 space-y-4">
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Catálogo
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Desarrolladores
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            MediaPipe Plus
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            <div className="mt-12 md:mt-0">
                                <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Soporte</h3>
                                <ul className="mt-4 space-y-4">
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Documentación
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Guía de Gestos
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Contacto
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="md:grid md:grid-cols-2 md:gap-8">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Legal</h3>
                                <ul className="mt-4 space-y-4">
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Privacidad
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Términos
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                            Cookies
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-12 border-t border-border/40 pt-8">
                    <p className="text-sm text-muted-foreground xl:text-center">
                        &copy; {currentYear} Vout Ecosystem. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}
