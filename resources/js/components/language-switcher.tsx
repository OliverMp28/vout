import { router } from '@inertiajs/react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';

export function LanguageSwitcher() {
    const { locale } = useTranslation();

    const changeLanguage = (newLocale: string) => {
        router.post(
            '/locale',
            { locale: newLocale },
            { preserveScroll: true, preserveState: false },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                >
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">Cambiar idioma / Change language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card-light mt-2 p-1 border-white/20">
                <DropdownMenuItem
                    onClick={() => changeLanguage('es')}
                    className={locale === 'es' ? 'bg-primary/10 font-bold text-primary' : ''}
                >
                    <span className="mr-2">🇪🇸</span> Español
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => changeLanguage('en')}
                    className={locale === 'en' ? 'bg-primary/10 font-bold text-primary' : ''}
                >
                    <span className="mr-2">🇺🇸</span> English
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
