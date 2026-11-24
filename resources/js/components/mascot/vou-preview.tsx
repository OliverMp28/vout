import { useTranslation } from '@/hooks/use-translation';
import { VouSvg } from './vou-svg';

/**
 * Preview estático del personaje Vou.
 *
 * Usado en la página de settings/appearance para que el usuario vea de
 * verdad a su compañero antes de activarlo. Reutiliza `VouSvg` tal cual
 * — la respiración y el parpadeo están definidos a nivel global, así
 * que el preview "vive" sin necesidad de conectar la máquina de estados.
 *
 * Deliberadamente no usa `position: fixed` ni el wrapper `.vou-mascot`
 * interactivo: aquí el personaje es pura ilustración.
 */
export function VouPreview() {
    const { t } = useTranslation();

    return (
        <div
            role="img"
            aria-label={t('mascot.aria_label')}
            className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-surface border bg-surface-sunken md:h-48"
        >
            <div className="relative h-20 w-20 md:h-24 md:w-24">
                <VouSvg />
            </div>
        </div>
    );
}
