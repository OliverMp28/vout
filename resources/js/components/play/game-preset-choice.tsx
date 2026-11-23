/**
 * Los controles que sugiere el juego (`suggestedPreset` en el READY), dentro
 * del panel de control facial: solo lo ve quien usa la cámara.
 *
 * La primera vez pregunta si se usan los del juego o los propios; la
 * respuesta se guarda por juego y después queda una línea para cambiarla.
 */

import { Gamepad2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { findPresetByKey } from '@/lib/mediapipe/action-presets';
import { OWN_CONTROLS } from '@/lib/play/preset-choice';

type GamePresetChoiceProps = {
    /** Preset que sugiere el juego. */
    suggested: string;
    /** Preset del juego en uso, o null si se usan los controles propios. */
    active: string | null;
    /** Aún no ha respondido (o el juego cambió su sugerencia). */
    ask: boolean;
    onChoose: (choice: string) => void;
};

export function GamePresetChoice({
    suggested,
    active,
    ask,
    onChoose,
}: GamePresetChoiceProps) {
    const { t } = useTranslation();
    const preset = findPresetByKey(suggested);
    const presetName = preset ? t(preset.nameKey) : suggested;

    if (ask) {
        return (
            <section
                id="play-preset-choice"
                data-preset-ask="true"
                role="status"
                aria-live="polite"
                className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5"
            >
                <p className="flex items-start gap-2 text-sm text-foreground">
                    <Gamepad2
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    {t('play.preset.ask', { preset: presetName })}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Button
                        type="button"
                        id="play-preset-use-game"
                        size="sm"
                        onClick={() => onChoose(suggested)}
                    >
                        {t('play.preset.use_game')}
                    </Button>
                    <Button
                        type="button"
                        id="play-preset-use-own"
                        size="sm"
                        variant="secondary"
                        onClick={() => onChoose(OWN_CONTROLS)}
                    >
                        {t('play.preset.use_own')}
                    </Button>
                </div>
            </section>
        );
    }

    const usingGame = active !== null;

    return (
        <section
            id="play-preset-choice"
            data-preset-ask="false"
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5"
        >
            <span className="text-xs text-muted-foreground">
                {usingGame
                    ? t('play.preset.current_game', { preset: presetName })
                    : t('play.preset.current_own')}
            </span>
            <Button
                type="button"
                id="play-preset-switch"
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => onChoose(usingGame ? OWN_CONTROLS : suggested)}
            >
                {usingGame
                    ? t('play.preset.use_own')
                    : t('play.preset.use_game')}
            </Button>
        </section>
    );
}
