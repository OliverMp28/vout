import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/hooks/use-translation';
import type { AccountRequirement } from '@/types';

const LEVELS: readonly AccountRequirement[] = ['none', 'optional', 'required'];

type AccountRequirementFieldProps = {
    /** Prefijo de los ids (hay un campo en el portal de desarrolladores y otro en el admin). */
    idPrefix: string;
    value: AccountRequirement;
    onChange: (value: AccountRequirement) => void;
    disabled?: boolean;
};

/**
 * Si hace falta una cuenta de Vout para jugar, con lo que significa cada
 * modo para el jugador y para el juego (qué mensaje recibe).
 */
export function AccountRequirementField({
    idPrefix,
    value,
    onChange,
    disabled = false,
}: AccountRequirementFieldProps) {
    const { t } = useTranslation();

    return (
        <RadioGroup
            value={value}
            onValueChange={(next) => onChange(next as AccountRequirement)}
            disabled={disabled}
            aria-label={t('account_requirement.label')}
        >
            {LEVELS.map((level) => {
                const id = `${idPrefix}-account-${level}`;

                return (
                    <div
                        key={level}
                        className="flex items-start gap-3 rounded-lg border border-border/60 p-3 has-data-[state=checked]:border-border-strong has-data-[state=checked]:bg-surface-sunken"
                    >
                        <RadioGroupItem
                            id={id}
                            value={level}
                            aria-describedby={`${id}-desc`}
                            className="mt-0.5"
                        />
                        <div className="grid gap-1">
                            <Label htmlFor={id} className="font-medium">
                                {t(`account_requirement.${level}.label`)}
                            </Label>
                            <p
                                id={`${id}-desc`}
                                className="text-xs text-muted-foreground"
                            >
                                {t(`account_requirement.${level}.desc`)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </RadioGroup>
    );
}
