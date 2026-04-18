/**
 * Editor de mapeo de gestos a acciones de juego.
 *
 * Permite al usuario configurar qué acción ejecuta cada gesto facial o
 * dirección de cabeza. Cada trigger se muestra en una fila con su acción
 * actual; al hacer clic se expande un editor inline con los campos
 * específicos del tipo de acción (tecla, modo, botón de ratón).
 *
 * Incluye:
 * - Selector de modo de head tracking (cursor / gesture / disabled)
 * - Dropdown para aplicar presets predefinidos
 * - Botón de guardar que hace PUT al backend
 *
 * Se muestra debajo del CalibrationWizard cuando el usuario ya tiene un
 * perfil de gestos activo.
 */

import { router } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, Gamepad2, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { KeyPicker } from '@/components/vision/key-picker';
import { useTranslation } from '@/hooks/use-translation';
import { ALL_PRESETS } from '@/lib/mediapipe/action-presets';
import type { ActionPreset } from '@/lib/mediapipe/action-presets';
import {
    HeadDirectionType,
    normalizeGestureMapping,
    resolveEventKey,
} from '@/lib/mediapipe/action-types';
import type {
    GameAction,
    GestureActionMapping,
    HeadTrackingMode,
} from '@/lib/mediapipe/action-types';
import { GestureType } from '@/lib/mediapipe/types';
import type { GestureConfigData } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Todos los triggers faciales en el orden deseado para la UI. */
const FACIAL_TRIGGERS = Object.values(GestureType);

/** Todos los triggers direccionales en el orden deseado para la UI. */
const HEAD_TRIGGERS = Object.values(HeadDirectionType);

/** i18n keys para los nombres de cada trigger. */
const TRIGGER_I18N: Record<string, string> = {
    [GestureType.BrowRaise]: 'vision.gesture.brow_raise',
    [GestureType.MouthOpen]: 'vision.gesture.mouth_open',
    [GestureType.BlinkLeft]: 'vision.gesture.blink_left',
    [GestureType.BlinkRight]: 'vision.gesture.blink_right',
    [GestureType.Smile]: 'vision.gesture.smile',
    [GestureType.BrowFrown]: 'vision.gesture.brow_frown',
    [GestureType.MouthPucker]: 'vision.gesture.mouth_pucker',
    [HeadDirectionType.HeadLeft]: 'vision.gesture.head_left',
    [HeadDirectionType.HeadRight]: 'vision.gesture.head_right',
    [HeadDirectionType.HeadUp]: 'vision.gesture.head_up',
    [HeadDirectionType.HeadDown]: 'vision.gesture.head_down',
};

/** Acción por defecto cuando el usuario cambia de tipo de acción. */
function defaultActionForType(type: string): GameAction {
    switch (type) {
        case 'keyboard':
            return { type: 'keyboard', key: 'Space', mode: 'press' };
        case 'mouse_click':
            return { type: 'mouse_click', button: 'left' };
        case 'game_event':
            return { type: 'game_event', event: 'ACTION' };
        default:
            return { type: 'none' };
    }
}

/** Texto compacto para mostrar la acción actual en el badge. */
function actionLabel(action: GameAction | undefined): string {
    if (!action || action.type === 'none') return '—';
    switch (action.type) {
        case 'keyboard': {
            const keyDisplay =
                action.key === 'Space' ? 'Space' : resolveEventKey(action.key);
            return `${keyDisplay} (${action.mode})`;
        }
        case 'mouse_click':
            return `Click ${action.button}`;
        case 'game_event':
            return `Event: ${action.event}`;
    }
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Editor inline de una acción individual. */
function ActionEditor({
    action,
    onChange,
}: {
    action: GameAction;
    onChange: (action: GameAction) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-end gap-3 pt-3">
            {/* Tipo de acción */}
            <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase">
                    {t('vision.action.type')}
                </Label>
                <Select
                    value={action.type}
                    onValueChange={(type) =>
                        onChange(defaultActionForType(type))
                    }
                >
                    <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="keyboard">
                            {t('vision.action.keyboard')}
                        </SelectItem>
                        <SelectItem value="mouse_click">
                            {t('vision.action.mouse_click')}
                        </SelectItem>
                        <SelectItem value="game_event">
                            {t('vision.action.game_event')}
                        </SelectItem>
                        <SelectItem value="none">
                            {t('vision.action.none')}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Campos específicos de teclado */}
            {action.type === 'keyboard' && (
                <>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">
                            {t('vision.action.key_label')}
                        </Label>
                        <KeyPicker
                            value={action.key}
                            onValueChange={(key) =>
                                onChange({ ...action, key })
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">
                            {t('vision.action.mode_label')}
                        </Label>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            size="sm"
                            value={action.mode}
                            onValueChange={(mode) => {
                                if (mode)
                                    onChange({
                                        ...action,
                                        mode: mode as 'press' | 'hold',
                                    });
                            }}
                        >
                            <ToggleGroupItem value="press">
                                {t('vision.action.mode.press')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="hold">
                                {t('vision.action.mode.hold')}
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </>
            )}

            {/* Campos específicos de clic de ratón */}
            {action.type === 'mouse_click' && (
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">
                        {t('vision.action.button_label')}
                    </Label>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={action.button}
                        onValueChange={(button) => {
                            if (button)
                                onChange({
                                    ...action,
                                    button: button as 'left' | 'right',
                                });
                        }}
                    >
                        <ToggleGroupItem value="left">
                            {t('vision.action.button.left')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="right">
                            {t('vision.action.button.right')}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            )}
        </div>
    );
}

/** Fila individual de un trigger con su acción y editor expandible. */
function TriggerRow({
    trigger,
    action,
    onAction,
    disabled = false,
    hasConflict = false,
}: {
    trigger: string;
    action: GameAction;
    onAction: (action: GameAction) => void;
    disabled?: boolean;
    hasConflict?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const { t } = useTranslation();

    const label = t(TRIGGER_I18N[trigger] ?? trigger);

    return (
        <div
            className={cn(
                'rounded-lg border px-3 py-2 transition-all duration-200',
                disabled
                    ? 'border-border/30 bg-muted/30 opacity-50'
                    : hasConflict
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : expanded
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/50 bg-background/50 hover:border-border',
            )}
        >
            <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => !disabled && setExpanded(!expanded)}
                disabled={disabled}
                aria-expanded={expanded}
            >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                    {hasConflict && (
                        <AlertTriangle
                            className="size-3.5 text-amber-500"
                            aria-hidden="true"
                        />
                    )}
                    {label}
                </span>
                <div className="flex items-center gap-2">
                    <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                    >
                        {actionLabel(action)}
                    </Badge>
                    {!disabled && (
                        <ChevronDown
                            className={cn(
                                'size-3.5 text-muted-foreground transition-transform duration-200',
                                expanded && 'rotate-180',
                            )}
                        />
                    )}
                </div>
            </button>

            {expanded && !disabled && (
                <div className="animate-in duration-200 fade-in slide-in-from-top-1">
                    <ActionEditor action={action} onChange={onAction} />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type GestureMappingEditorProps = {
    config: GestureConfigData;
};

function GestureMappingEditor({ config }: GestureMappingEditorProps) {
    const { t } = useTranslation();

    // Estado local inicializado desde la config del servidor.
    // normalizeGestureMapping maneja datos legacy (strings planos) por seguridad.
    const [mapping, setMapping] = useState<GestureActionMapping>(() =>
        normalizeGestureMapping(config.gesture_mapping),
    );
    const [headMode, setHeadMode] = useState<HeadTrackingMode>(
        config.head_tracking_mode ?? 'cursor',
    );
    const [saving, setSaving] = useState(false);

    // Actualizar la acción de un trigger específico.
    const setAction = useCallback((trigger: string, action: GameAction) => {
        setMapping((prev) => ({ ...prev, [trigger]: action }));
    }, []);

    // Detectar conflictos: dos triggers con la misma tecla de teclado.
    const conflictTriggers = useMemo(() => {
        const keyToTriggers: Record<string, string[]> = {};
        for (const [trigger, action] of Object.entries(mapping)) {
            if (action?.type === 'keyboard') {
                const key = resolveEventKey(action.key);
                keyToTriggers[key] ??= [];
                keyToTriggers[key].push(trigger);
            }
        }
        const conflicts = new Set<string>();
        for (const triggers of Object.values(keyToTriggers)) {
            if (triggers.length > 1) triggers.forEach((t) => conflicts.add(t));
        }
        return conflicts;
    }, [mapping]);

    // Aplicar un preset completo.
    const applyPreset = useCallback((preset: ActionPreset) => {
        setMapping(preset.mapping);
        setHeadMode(preset.headTrackingMode);
    }, []);

    // Guardar: PUT al backend con el mapping y el modo de head tracking.
    const handleSave = useCallback(() => {
        setSaving(true);
        router.put(
            `/gesture-configs/${config.id}`,
            { gesture_mapping: mapping, head_tracking_mode: headMode },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    }, [config.id, mapping, headMode]);

    return (
        <div className="animate-in space-y-5 duration-500 fade-in slide-in-from-top-4">
            {/* Título */}
            <div className="flex items-start gap-3">
                <Gamepad2 className="mt-0.5 size-4 text-primary" />
                <div>
                    <h3 className="text-base font-medium">
                        {t('vision.mapping.title')}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {t('vision.mapping.desc')}
                    </p>
                </div>
            </div>

            {/* Preset + Head tracking mode */}
            <div className="flex flex-wrap items-end gap-4">
                {/* Selector de preset */}
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">
                        {t('vision.mapping.preset')}
                    </Label>
                    <Select
                        onValueChange={(idx) =>
                            applyPreset(ALL_PRESETS[Number(idx)])
                        }
                    >
                        <SelectTrigger size="sm" className="w-36">
                            <SelectValue
                                placeholder={t('vision.mapping.preset')}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_PRESETS.map((preset, i) => (
                                <SelectItem
                                    key={preset.nameKey}
                                    value={String(i)}
                                >
                                    {t(preset.nameKey)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Modo de head tracking */}
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">
                        {t('vision.mapping.head_mode')}
                    </Label>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={headMode}
                        onValueChange={(mode) => {
                            if (mode) setHeadMode(mode as HeadTrackingMode);
                        }}
                    >
                        <ToggleGroupItem value="cursor">
                            {t('vision.head_tracking.cursor')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="gesture">
                            {t('vision.head_tracking.gesture')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="disabled">
                            {t('vision.head_tracking.disabled')}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </div>

            {/* Aviso de conflictos (no bloqueante) */}
            {conflictTriggers.size > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{t('vision.mapping.conflict_warning')}</span>
                </div>
            )}

            {/* Sección: Gestos faciales */}
            <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                    {t('vision.mapping.facial_gestures')}
                </h4>
                <div className="space-y-1.5">
                    {FACIAL_TRIGGERS.map((trigger) => (
                        <TriggerRow
                            key={trigger}
                            trigger={trigger}
                            action={mapping[trigger] ?? { type: 'none' }}
                            onAction={(a) => setAction(trigger, a)}
                            hasConflict={conflictTriggers.has(trigger)}
                        />
                    ))}
                </div>
            </div>

            {/* Sección: Movimiento de cabeza */}
            <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                    {t('vision.mapping.head_movement')}
                </h4>
                {headMode !== 'gesture' && (
                    <p className="text-xs text-muted-foreground">
                        {t('vision.mapping.head_disabled_hint')}
                    </p>
                )}
                <div className="space-y-1.5">
                    {HEAD_TRIGGERS.map((trigger) => (
                        <TriggerRow
                            key={trigger}
                            trigger={trigger}
                            action={mapping[trigger] ?? { type: 'none' }}
                            onAction={(a) => setAction(trigger, a)}
                            disabled={headMode !== 'gesture'}
                            hasConflict={conflictTriggers.has(trigger)}
                        />
                    ))}
                </div>
            </div>

            {/* Guardar */}
            <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? t('vision.mapping.saving') : t('vision.mapping.save')}
            </Button>
        </div>
    );
}

export { GestureMappingEditor };
