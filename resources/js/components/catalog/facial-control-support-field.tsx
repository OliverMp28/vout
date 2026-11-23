import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/hooks/use-translation';
import type { FacialControlSupport } from '@/types';

const LEVELS: readonly FacialControlSupport[] = [
    'none',
    'compatible',
    'designed',
];

type FacialControlSupportFieldProps = {
    /** Prefijo de los ids (hay un campo en el portal de desarrolladores y otro en el admin). */
    idPrefix: string;
    value: FacialControlSupport;
    onChange: (value: FacialControlSupport) => void;
    disabled?: boolean;
};

/**
 * Si el juego admite el control facial, con lo que significa cada nivel.
 *
 * Lo declara quien conoce el juego: el portal no puede comprobar si un
 * juego de otro origen entiende las teclas que le manda la cámara.
 */
export function FacialControlSupportField({
    idPrefix,
    value,
    onChange,
    disabled = false,
}: FacialControlSupportFieldProps) {
    const { t } = useTranslation();

    return (
        <RadioGroup
            value={value}
            onValueChange={(next) => onChange(next as FacialControlSupport)}
            disabled={disabled}
            aria-label={t('facial_control.support.label')}
        >
            {LEVELS.map((level) => {
                const id = `${idPrefix}-facial-control-${level}`;

                return (
                    <div
                        key={level}
                        className="flex items-start gap-3 rounded-lg border border-border/60 p-3 has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5"
                    >
                        <RadioGroupItem
                            id={id}
                            value={level}
                            aria-describedby={`${id}-desc`}
                            className="mt-0.5"
                        />
                        <div className="grid gap-1">
                            <Label htmlFor={id} className="font-medium">
                                {t(`facial_control.support.${level}.label`)}
                            </Label>
                            <p
                                id={`${id}-desc`}
                                className="text-xs text-muted-foreground"
                            >
                                {t(`facial_control.support.${level}.desc`)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </RadioGroup>
    );
}
