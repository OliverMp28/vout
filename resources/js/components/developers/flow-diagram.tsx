import { ArrowRight, Globe, Layers, MonitorPlay } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

type FlowDiagramProps = {
    /** Variante del flujo a representar. */
    variant: 'app' | 'game';
};

/**
 * Mini-diagrama vertical del flujo de un juego en el ecosistema Vout.
 *
 * - `app`: muestra el ciclo Sitio web → Vout embebe → Jugadores juegan.
 * - `game`: foco en URL jugable → iframe en /play → handshake postMessage.
 *
 * Vive en el aside de los formularios de Apps/Games para que el dev entienda
 * de un vistazo qué hace cada campo, sin leer párrafos de ayuda.
 */
export function FlowDiagram({ variant }: FlowDiagramProps) {
    const { t } = useTranslation();

    const steps =
        variant === 'app'
            ? ([
                  {
                      icon: Globe,
                      title: t('developers.flow.app.step1.title'),
                      description: t('developers.flow.app.step1.description'),
                  },
                  {
                      icon: Layers,
                      title: t('developers.flow.app.step2.title'),
                      description: t('developers.flow.app.step2.description'),
                  },
                  {
                      icon: MonitorPlay,
                      title: t('developers.flow.app.step3.title'),
                      description: t('developers.flow.app.step3.description'),
                  },
              ] as const)
            : ([
                  {
                      icon: Globe,
                      title: t('developers.flow.game.step1.title'),
                      description: t('developers.flow.game.step1.description'),
                  },
                  {
                      icon: MonitorPlay,
                      title: t('developers.flow.game.step2.title'),
                      description: t('developers.flow.game.step2.description'),
                  },
                  {
                      icon: Layers,
                      title: t('developers.flow.game.step3.title'),
                      description: t('developers.flow.game.step3.description'),
                  },
              ] as const);

    return (
        <ol className="space-y-3" aria-label={t('developers.flow.aria_label')}>
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === steps.length - 1;
                return (
                    <li key={step.title} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <span
                                className="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
                                aria-hidden
                            >
                                <Icon className="size-4" />
                            </span>
                            {!isLast && (
                                <ArrowRight
                                    className="mt-1 size-3 rotate-90 text-muted-foreground/60"
                                    aria-hidden
                                />
                            )}
                        </div>
                        <div className="space-y-0.5 pb-1">
                            <p className="text-xs font-semibold tracking-tight">
                                {step.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {step.description}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
