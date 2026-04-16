import { Plus, X } from 'lucide-react';
import { InfoHint } from '@/components/developers/info-hint';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type DynamicUrlListProps = {
    id: string;
    label: string;
    /**
     * Si se proporciona, renderiza un botón `?` (InfoHint) junto al label
     * con la explicación contextual del campo.
     */
    hint?: { label: string; body: string };
    description?: string;
    placeholder?: string;
    values: readonly string[];
    onChange: (next: string[]) => void;
    /**
     * Mapa de errores por índice: `"redirect_uris.0": "mensaje"`.
     * El componente sólo lee las claves relevantes para este campo.
     */
    errors?: Record<string, string | undefined>;
    /**
     * Prefijo de la clave de error en el request (ej. "allowed_origins",
     * "redirect_uris"). Se usa para leer `errors[`${fieldName}.${index}`]`
     * y también el error genérico `errors[fieldName]`.
     */
    fieldName: string;
    /**
     * Tope de entradas. El botón "añadir" queda deshabilitado al alcanzarlo.
     */
    max?: number;
    /**
     * Marca si la entrada en el índice 0 es obligatoria (mantiene al menos
     * un input visible aunque el usuario intente quitar todos).
     */
    requireAtLeastOne?: boolean;
    /**
     * `type="url"` por defecto. Pasa `type="text"` para orígenes sin path.
     */
    inputType?: 'url' | 'text';
    /**
     * `autoComplete` del input. `off` por defecto.
     */
    autoComplete?: string;
    disabled?: boolean;
};

/**
 * Array input de URLs / orígenes con añadir/eliminar, respetando un tope
 * configurable y exponiendo errores server-side de Laravel por índice.
 *
 * El estado vive en el padre (normalmente un `useForm` de Inertia) — este
 * componente sólo emite el nuevo array completo vía `onChange`. Así se
 * integra sin fricción con la validación del backend.
 */
export function DynamicUrlList({
    id,
    label,
    hint,
    description,
    placeholder,
    values,
    onChange,
    errors,
    fieldName,
    max = 10,
    requireAtLeastOne = true,
    inputType = 'url',
    autoComplete = 'off',
    disabled = false,
}: DynamicUrlListProps) {
    const { t } = useTranslation();

    const entries = values.length === 0 && requireAtLeastOne ? [''] : values;
    const canAdd = !disabled && entries.length < max;
    const rootError = errors?.[fieldName];

    const updateAt = (index: number, next: string): void => {
        const copy = [...entries];
        copy[index] = next;
        onChange(copy);
    };

    const removeAt = (index: number): void => {
        if (requireAtLeastOne && entries.length === 1) {
            onChange(['']);

            return;
        }
        onChange(entries.filter((_, i) => i !== index));
    };

    const add = (): void => {
        if (!canAdd) {
            return;
        }
        onChange([...entries, '']);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                    <Label htmlFor={`${id}-0`}>{label}</Label>
                    {hint && (
                        <InfoHint label={hint.label}>
                            <p>{hint.body}</p>
                        </InfoHint>
                    )}
                </span>
                <span className="text-xs text-muted-foreground">
                    {entries.length}/{max}
                </span>
            </div>

            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}

            <ul className="space-y-2">
                {entries.map((value, index) => {
                    const itemError = errors?.[`${fieldName}.${index}`];
                    const inputId = `${id}-${index}`;
                    return (
                        <li key={inputId} className="space-y-1">
                            <div className="flex items-start gap-2">
                                <Input
                                    id={inputId}
                                    type={inputType}
                                    inputMode="url"
                                    autoComplete={autoComplete}
                                    spellCheck={false}
                                    value={value}
                                    onChange={(event) =>
                                        updateAt(index, event.target.value)
                                    }
                                    placeholder={placeholder}
                                    disabled={disabled}
                                    aria-invalid={
                                        itemError !== undefined || undefined
                                    }
                                    aria-describedby={
                                        itemError !== undefined
                                            ? `${inputId}-error`
                                            : undefined
                                    }
                                    className={cn(
                                        'font-mono text-sm',
                                        itemError !== undefined &&
                                            'border-destructive focus-visible:ring-destructive',
                                    )}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeAt(index)}
                                    disabled={
                                        disabled ||
                                        (requireAtLeastOne &&
                                            entries.length === 1 &&
                                            value === '')
                                    }
                                    aria-label={t(
                                        'developers.form.remove_entry',
                                    )}
                                    className="mt-0 shrink-0"
                                >
                                    <X className="size-4" aria-hidden />
                                </Button>
                            </div>
                            {itemError !== undefined && (
                                <InputError
                                    id={`${inputId}-error`}
                                    message={itemError}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="flex items-center justify-between gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={add}
                    disabled={!canAdd}
                    className="gap-1.5"
                >
                    <Plus className="size-4" aria-hidden />
                    {t('developers.form.add_entry')}
                </Button>
                {rootError !== undefined && <InputError message={rootError} />}
            </div>
        </div>
    );
}
