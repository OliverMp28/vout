/**
 * Resumen legible del estado del motor para la telemetría (overlay Ctrl+M de
 * la página de juego, panel y CSV de Vision Lab).
 */

import type { GestureEngineDiagnostics } from './gesture-engine';
import type { StartupTimings } from './types';

/** Pares nombre → valor, en el orden en que se muestran. */
export function describeDiagnostics(
    diagnostics: GestureEngineDiagnostics,
): [string, string][] {
    const { info, runtime, frameSource, frames } = diagnostics;

    return [
        ['mediapipe', info?.mediapipeVersion ?? '—'],
        ['delegate', info?.delegate ?? '—'],
        ['simd', info === null ? '—' : info.simd ? 'yes' : 'no'],
        ['renderer', info?.renderer ?? '—'],
        // `warm`: la activación encontró el motor ya cargado.
        ['runtime', runtime ?? '—'],
        ['startup', info === null ? '—' : describeStartup(info.startup)],
        ['frameSource', frameSource],
        ['framesSent', String(frames.sent)],
        ['framesSkipped', String(frames.skipped)],
    ];
}

/** Lo que tardó en cargarse el motor, por fases: `bundle · modelo · calentamiento`. */
function describeStartup(startup: StartupTimings): string {
    return [startup.bundleMs, startup.landmarkerMs, startup.warmupMs]
        .map((ms) => String(Math.round(ms)))
        .join(' · ')
        .concat(' ms');
}
