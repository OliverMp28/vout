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
import { cn } from '@/lib/utils';

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
                    className="text-muted-foreground hover:text-foreground"
                >
                    <Globe className="size-5" />
                    <span className="sr-only">
                        Cambiar idioma / Change language
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1">
                <DropdownMenuItem
                    onClick={() => changeLanguage('es')}
                    className={cn(
                        'gap-2.5',
                        locale === 'es' && 'bg-signal-soft font-bold',
                    )}
                >
                    <span className="w-6 font-mono text-xs text-muted-foreground">
                        ES
                    </span>
                    Español
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => changeLanguage('en')}
                    className={cn(
                        'gap-2.5',
                        locale === 'en' && 'bg-signal-soft font-bold',
                    )}
                >
                    <span className="w-6 font-mono text-xs text-muted-foreground">
                        EN
                    </span>
                    English
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
