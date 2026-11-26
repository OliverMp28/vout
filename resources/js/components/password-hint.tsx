import { usePage } from '@inertiajs/react';
import { useTranslation } from '@/hooks/use-translation';

type PasswordRequirements = { min: number } | null;

/**
 * Lo que el servidor exige a una contraseña nueva (`PasswordPolicy`). Sin
 * política (local y tests) no muestra nada, para no prometer reglas que no
 * se comprueban.
 */
export default function PasswordHint({ id }: { id: string }) {
    const { t } = useTranslation();
    const { passwordRequirements } = usePage<{
        passwordRequirements?: PasswordRequirements;
    }>().props;

    if (!passwordRequirements) {
        return null;
    }

    return (
        <p id={id} className="text-xs text-muted-foreground">
            {t('auth.password.hint', { min: passwordRequirements.min })}
        </p>
    );
}

/** `aria-describedby` del campo: solo si la pista se muestra. */
export function usePasswordHintId(id: string): string | undefined {
    const { passwordRequirements } = usePage<{
        passwordRequirements?: PasswordRequirements;
    }>().props;

    return passwordRequirements ? id : undefined;
}
