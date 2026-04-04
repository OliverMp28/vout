/**
 * Selector de tecla para el mapeo de gestos.
 *
 * Envuelve el componente Select de shadcn/ui con teclas comunes
 * agrupadas por categoría (flechas, WASD, acciones, letras, números).
 *
 * El valor almacenado es un KeyboardEvent.code (ej. 'Space', 'ArrowLeft', 'KeyA')
 * siguiendo el formato de GameAction.key definido en action-types.ts.
 */

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { COMMON_GAME_KEYS } from '@/lib/mediapipe/action-types';

// ---------------------------------------------------------------------------
// Agrupación de teclas por categoría
// ---------------------------------------------------------------------------

const KEY_GROUPS = [
    { id: 'arrows', labelKey: 'vision.keys.arrows' },
    { id: 'wasd', labelKey: 'vision.keys.wasd' },
    { id: 'actions', labelKey: 'vision.keys.actions' },
    { id: 'letters', labelKey: 'vision.keys.letters' },
    { id: 'numbers', labelKey: 'vision.keys.numbers' },
] as const;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

type KeyPickerProps = {
    /** Valor actual — KeyboardEvent.code (ej. 'Space', 'ArrowLeft'). */
    value: string;
    /** Callback cuando el usuario selecciona una tecla distinta. */
    onValueChange: (code: string) => void;
    /** Desactiva el selector. */
    disabled?: boolean;
};

function KeyPicker({ value, onValueChange, disabled }: KeyPickerProps) {
    const { t } = useTranslation();

    return (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger size="sm" className="w-36">
                <SelectValue placeholder={t('vision.keys.select')} />
            </SelectTrigger>
            <SelectContent>
                {KEY_GROUPS.map(({ id, labelKey }) => {
                    const keys = COMMON_GAME_KEYS.filter((k) => k.group === id);
                    if (keys.length === 0) return null;
                    return (
                        <SelectGroup key={id}>
                            <SelectLabel>{t(labelKey)}</SelectLabel>
                            {keys.map((k) => (
                                <SelectItem key={k.code} value={k.code}>
                                    {k.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    );
                })}
            </SelectContent>
        </Select>
    );
}

export { KeyPicker };
