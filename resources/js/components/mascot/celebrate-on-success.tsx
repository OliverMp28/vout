import { useEffect } from 'react';
import { useMascot } from '@/hooks/use-mascot';
import { useTranslation } from '@/hooks/use-translation';

type Props = {
    recentlySuccessful: boolean;
    messageKey?: string;
};

/**
 * Componente invisible que, al pasar `recentlySuccessful` a `true`, dispara
 * la celebración de Vou y una notificación de éxito en su tooltip.
 *
 * Pensado para usarse dentro de render props de `<Form>` de Inertia, donde
 * no podemos llamar hooks directamente. Ejemplo:
 *
 * ```tsx
 * <Form {...action}>
 *   {({ recentlySuccessful }) => (
 *     <>
 *       <CelebrateOnSuccess recentlySuccessful={recentlySuccessful} />
 *       ...
 *     </>
 *   )}
 * </Form>
 * ```
 */
export function CelebrateOnSuccess({
    recentlySuccessful,
    messageKey = 'settings.saved',
}: Props) {
    const { celebrate, notify } = useMascot();
    const { t } = useTranslation();

    useEffect(() => {
        if (recentlySuccessful) {
            celebrate();
            notify(t(messageKey), 'success');
        }
    }, [recentlySuccessful, celebrate, notify, t, messageKey]);

    return null;
}
