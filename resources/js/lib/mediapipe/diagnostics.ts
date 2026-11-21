/**
 * Resumen legible del estado del motor para la telemetría (overlay Ctrl+M de
 * la página de juego, panel y CSV de Vision Lab).
 */

import type { GestureEngineDiagnostics } from './gesture-engine';

/** Pares nombre → valor, en el orden en que se muestran. */
export function describeDiagnostics(
    diagnostics: GestureEngineDiagnostics,
): [string, string][] {
    const { info, frameSource, frames } = diagnostics;

    return [
        ['mediapipe', info?.mediapipeVersion ?? '—'],
        ['delegate', info?.delegate ?? '—'],
        ['simd', info === null ? '—' : info.simd ? 'yes' : 'no'],
        ['renderer', info?.renderer ?? '—'],
        ['frameSource', frameSource],
        ['framesSent', String(frames.sent)],
        ['framesSkipped', String(frames.skipped)],
    ];
}
