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
                    className="text-muted-foreground hover:text-foreground"
                >
                    <TriggerIcon className="size-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1">
                {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
                    <DropdownMenuItem
                        key={value}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'gap-2',
                            appearance === value && 'bg-signal-soft font-bold',
                        )}
                    >
                        <Icon className="size-4" />
                        <span>{t(labelKey)}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
