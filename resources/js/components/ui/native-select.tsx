import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type NativeSelectOption = {
    value: string;
    label: string;
    disabled?: boolean;
};

export type NativeSelectGroup = {
    label: string;
    options: readonly NativeSelectOption[];
};

type NativeSelectProps = Omit<
    React.ComponentProps<'select'>,
    'size' | 'children'
> & {
    options?: readonly NativeSelectOption[];
    groups?: readonly NativeSelectGroup[];
    placeholder?: string;
    placeholderDisabled?: boolean;
    size?: 'sm' | 'default';
};

/**
 * Select nativo con apariencia shadcn/Radix.
 *
 * Diseñado como reemplazo directo de `<Select>` de Radix cuando el popover
 * generado por el portal introduce overhead de layout (forced reflow) en
 * formularios pesados. Usa `<select>` nativo del navegador: sin JS, sin
 * `react-remove-scroll`, sin `@floating-ui`.
 *
 * Hereda el mismo ADN visual que `SelectTrigger`: `border-input`,
 * `bg-surface-2`, sombra interior suave, foco con `outline`,
 * `aria-invalid` con borde destructivo y chevron alineado a la derecha.
 */
function NativeSelect({
    className,
    options,
    groups,
    placeholder,
    placeholderDisabled = true,
    size = 'default',
    value,
    disabled,
    ...props
}: NativeSelectProps) {
    const renderOption = (option: NativeSelectOption) => (
        <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="bg-background text-foreground"
        >
            {option.label}
        </option>
    );

    return (
        <div className="group relative">
            <select
                data-slot="native-select"
                data-size={size}
                value={value}
                disabled={disabled}
                className={cn(
                    'peer flex w-full appearance-none items-center justify-between gap-2 rounded-control border border-input bg-surface-2 pr-8 pl-3 text-sm shadow-[inset_0_1px_2px_oklch(0.2_0.01_245/0.07)] transition-[color,border-color] outline-none',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'aria-invalid:border-danger',
                    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                    size === 'default' ? 'h-10 py-2' : 'h-8 py-1.5',
                    !value && placeholder ? 'text-muted-foreground' : '',
                    className,
                )}
                {...props}
            >
                {placeholder !== undefined && (
                    <option
                        value=""
                        disabled={placeholderDisabled}
                        className="bg-background text-foreground"
                    >
                        {placeholder}
                    </option>
                )}
                {options?.map(renderOption)}
                {groups?.map((group) => (
                    <optgroup
                        key={group.label}
                        label={group.label}
                        className="bg-background text-foreground"
                    >
                        {group.options.map(renderOption)}
                    </optgroup>
                ))}
            </select>
            <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground opacity-60 transition-opacity peer-hover:opacity-100 peer-focus-visible:text-foreground peer-focus-visible:opacity-100 peer-disabled:opacity-40"
            />
        </div>
    );
}

export { NativeSelect };
