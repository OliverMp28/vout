import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type UrlPathInputProps = {
    /** id del input de path (para el htmlFor del Label en el padre). */
    id: string;
    /**
     * Lista de orígenes disponibles (`https://host[:port]`) tomada de los
     * `allowed_origins` de la app seleccionada. Vacía → solo input plano.
     */
    origins: readonly string[];
    /**
     * URL completa actual (origin + path). El componente la divide
     * internamente en prefijo y path para la edición.
     */
    value: string;
    /** Notifica con la URL completa reconstruida. */
    onChange: (next: string) => void;
    placeholder?: string;
    pathPlaceholder?: string;
    disabled?: boolean;
    invalid?: boolean;
};

/**
 * Input combinado para URLs cuyo origen debe estar dentro de una whitelist
 * (caso `embed_url` ⊂ `allowed_origins` de la app).
 *
 * - Si hay >1 origen, el prefijo es un `<Select>` con esos orígenes.
 * - Si hay 1 origen, el prefijo es texto fijo (no selector).
 * - Si hay 0 orígenes, queda un `<Input>` libre (ej. el dev aún no eligió app).
 *
 * Esto evita que el dev componga manualmente la URL completa y previene
 * errores de validación cruzada (`embed_url_not_in_allowed_origins`).
 */
export function UrlPathInput({
    id,
    origins,
    value,
    onChange,
    placeholder = 'https://mi-juego.com/play',
    pathPlaceholder = '/play',
    disabled = false,
    invalid = false,
}: UrlPathInputProps) {
    if (origins.length === 0) {
        return (
            <Input
                id={id}
                type="url"
                inputMode="url"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                className={cn(
                    'font-mono text-sm',
                    invalid &&
                        'border-destructive focus-visible:ring-destructive',
                )}
                maxLength={500}
            />
        );
    }

    const { prefix, path } = splitValue(value, origins);

    const handlePrefixChange = (nextPrefix: string): void => {
        onChange(joinUrl(nextPrefix, path));
    };

    const handlePathChange = (nextPath: string): void => {
        const normalized = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
        onChange(joinUrl(prefix, nextPath === '' ? '' : normalized));
    };

    return (
        <div
            className={cn(
                'flex flex-wrap items-stretch overflow-hidden rounded-md border border-input bg-background shadow-xs sm:flex-nowrap',
                'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
                invalid &&
                    'border-destructive focus-within:ring-destructive/40',
                disabled && 'opacity-60',
            )}
        >
            {origins.length === 1 ? (
                <span
                    className="flex items-center border-b border-input bg-muted/40 px-3 py-2 font-mono text-sm text-muted-foreground sm:border-r sm:border-b-0"
                    aria-hidden
                >
                    {origins[0]}
                </span>
            ) : (
                <Select
                    value={prefix}
                    onValueChange={handlePrefixChange}
                    disabled={disabled}
                >
                    <SelectTrigger
                        className="w-full rounded-none border-0 border-b border-input bg-muted/40 font-mono text-sm focus-visible:ring-0 sm:w-auto sm:border-r sm:border-b-0"
                        aria-label="Dominio"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {origins.map((origin) => (
                            <SelectItem
                                key={origin}
                                value={origin}
                                className="font-mono text-xs"
                            >
                                {origin}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <Input
                id={id}
                type="text"
                value={path}
                onChange={(event) => handlePathChange(event.target.value)}
                placeholder={pathPlaceholder}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                className="min-w-0 flex-1 rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
                maxLength={500}
            />
        </div>
    );
}

type Split = { prefix: string; path: string };

/**
 * Parte una URL completa en (prefijo, path) usando la lista de orígenes
 * permitidos como referencia. Si ninguna coincide, asume el primero como
 * prefijo y deja la URL completa como path (caso edición de un valor antiguo
 * que ya no encaja con los orígenes vigentes).
 */
function splitValue(value: string, origins: readonly string[]): Split {
    const fallback = origins[0] ?? '';
    if (value === '') {
        return { prefix: fallback, path: '' };
    }
    const match = origins.find((origin) => value.startsWith(origin));
    if (match !== undefined) {
        return { prefix: match, path: value.slice(match.length) };
    }
    return { prefix: fallback, path: value };
}

function joinUrl(prefix: string, path: string): string {
    if (prefix === '') {
        return path;
    }
    if (path === '') {
        return prefix;
    }
    return `${prefix}${path.startsWith('/') ? '' : '/'}${path}`;
}
