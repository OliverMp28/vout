import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

export default function AppearanceToggleTab({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();
    const { t } = useTranslation();

    const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: t('appearance.mode.light') },
        { value: 'dark', icon: Moon, label: t('appearance.mode.dark') },
        { value: 'system', icon: Monitor, label: t('appearance.mode.system') },
    ];

    return (
        <div
            className={cn(
                'inline-flex gap-1 rounded-control border bg-surface-sunken p-1',
                className,
            )}
            {...props}
        >
            {tabs.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearance(value)}
                    aria-pressed={appearance === value}
                    className={cn(
                        'flex items-center rounded-sm border px-3.5 py-1.5 font-semibold transition-colors',
                        appearance === value
                            ? 'border-border-strong bg-key-light text-foreground shadow-[0_2px_0_0_var(--key-light-edge)]'
                            : 'border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )}
                >
                    <Icon className="-ml-1 h-4 w-4" />
                    <span className="ml-1.5 text-sm">{label}</span>
                </button>
            ))}
        </div>
    );
}
