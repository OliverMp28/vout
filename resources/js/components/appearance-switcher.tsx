import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type Option = {
    value: Appearance;
    icon: LucideIcon;
    labelKey: string;
};

const OPTIONS: readonly Option[] = [
    { value: 'light', icon: Sun, labelKey: 'appearance.mode.light' },
    { value: 'dark', icon: Moon, labelKey: 'appearance.mode.dark' },
    { value: 'system', icon: Monitor, labelKey: 'appearance.mode.system' },
] as const;

export function AppearanceSwitcher() {
    const { appearance, resolvedAppearance, updateAppearance } =
        useAppearance();
    const { t } = useTranslation();

    const TriggerIcon = resolvedAppearance === 'dark' ? Moon : Sun;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('appearance.switcher.label')}
                    className="h-9 w-9 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                >
                    <TriggerIcon className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="glass-card-light mt-2 border-white/20 p-1"
            >
                {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
                    <DropdownMenuItem
                        key={value}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'gap-2',
                            appearance === value &&
                                'bg-primary/10 font-bold text-primary',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        <span>{t(labelKey)}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
