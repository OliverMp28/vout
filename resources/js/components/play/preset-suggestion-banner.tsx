/**
 * Banner no bloqueante que propone aplicar un preset sugerido por el juego.
 *
 * Se muestra cuando el iframe envía `suggestedPreset` en el mensaje READY.
 * El usuario puede aceptarlo o descartarlo; no bloquea la carga del juego.
 */

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

type PresetSuggestionBannerProps = {
    preset: string;
    onAccept: (preset: string) => void;
    onDismiss: () => void;
};

export function PresetSuggestionBanner({
    preset,
    onAccept,
    onDismiss,
}: PresetSuggestionBannerProps) {
    const { t } = useTranslation();

    return (
        <div
            role="status"
            aria-live="polite"
            className="mb-4 flex animate-in flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 text-sm shadow-sm backdrop-blur-sm duration-300 fade-in slide-in-from-top-2"
        >
            <span className="font-medium text-foreground">
                {t('play.preset_suggestion.text', { preset })}
            </span>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onAccept(preset)}
                >
                    {t('play.preset_suggestion.accept')}
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDismiss}
                    aria-label={t('play.preset_suggestion.dismiss')}
                >
                    <X className="size-4" />
                </Button>
            </div>
        </div>
    );
}
