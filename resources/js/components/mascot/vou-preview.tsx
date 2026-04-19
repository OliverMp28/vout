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
            className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-linear-to-br from-primary/5 via-background to-accent/10 md:h-48"
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                aria-hidden
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 20% 30%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 45%), radial-gradient(circle at 80% 70%, color-mix(in oklch, var(--accent) 18%, transparent) 0%, transparent 50%)',
                }}
            />
            <div className="relative h-20 w-20 md:h-24 md:w-24">
                <VouSvg />
            </div>
        </div>
    );
}
