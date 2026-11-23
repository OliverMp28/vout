import { describe, expect, test } from 'bun:test';

import { GestureType } from '@/lib/mediapipe/types';

import {
    calibrateFromRecording,
    loadRecordings,
    replay,
} from './support/recording-replay';
import type { StepStarts } from './support/recording-replay';

/*
 * Regresión con grabaciones guiadas reales de Vision Lab
 * (`tests/js/fixtures/gesture-recordings`, solo números: pose de la cabeza y
 * los blendshapes que usa el clasificador). Cada grabación se reproduce por
 * el motor como si viniera de la cámara: calibración automática con la cara
 * neutra del principio y clasificación de todo lo demás.
 *
 * Para cada grabación se anota lo que la persona hizo de verdad en cada paso
 * (no siempre coincide con la instrucción) y se exige que se detecte eso y
 * nada más. Así un ajuste de las reglas que arregla un caso no puede romper
 * otro sin que se note.
 *
 * Para añadir una grabación: descargarla en Vision Lab, recortarla a
 * `USED_BLENDSHAPE_KEYS`, guardarla en la carpeta y anotar aquí sus pasos.
 */

type Annotation = {
    /** Sensibilidad con la que se juega (la de la grabación). */
    sensitivity: number;
    /** Inicios de gesto por paso a esa sensibilidad. */
    expected: StepStarts;
    /**
     * Gestos ajenos al paso que son de la persona y no un fallo (o un límite
     * conocido), para comprobar sin falsos positivos otras sensibilidades.
     */
    tolerated: Partial<Record<string, GestureType[]>>;
};

const ANNOTATIONS: Record<string, Annotation> = {
    // Portátil con Intel UHD 620 (GPU), ~23 fps de análisis, luz de interior.
    '2026-11-21-intel-uhd-620': {
        sensitivity: 6,
        expected: {
            neutral: {},
            // Movió los ojos, no la cabeza.
            look_around: {},
            // Tres aperturas dentro del paso (0.31-0.38 sobre la cara neutra).
            mouth_front: { [GestureType.MouthOpen]: 3 },
            brows_front: { [GestureType.BrowRaise]: 5 },
            // Mirando arriba las cejas suben solas a ~0.3: no deben dispararse
            // antes que la boca (el error de "abrir la boca salta").
            mouth_up_right: { [GestureType.MouthOpen]: 1 },
            // Aperturas pequeñas (≤ 0.26): no llegan al umbral, pero tampoco
            // se dispara otra cosa con la cabeza girada.
            mouth_down_right: {},
            mouth_up_left: {},
            // Levantó las cejas tarde, al empezar el paso siguiente.
            brows_up: {},
            smile: { [GestureType.Smile]: 4, [GestureType.BrowRaise]: 1 },
            blink_left: { [GestureType.BlinkLeft]: 6 },
            blink_right: { [GestureType.BlinkRight]: 4 },
            // Parpadear con los dos ojos no es guiñar.
            blink_natural: {},
            frown: { [GestureType.BrowFrown]: 4 },
            pucker: { [GestureType.MouthPucker]: 3 },
            // Límite conocido: habla abriendo la boca casi tanto como cuando
            // la abre a propósito (0.32 frente a 0.31-0.38). Los morritos de
            // las "o" y "u" ya no cuentan.
            talk: { [GestureType.MouthOpen]: 1 },
            // Con el ojo izquierdo medio cerrado por cansancio.
            neutral_end: {},
        },
        tolerated: {
            smile: [GestureType.BrowRaise],
            talk: [GestureType.MouthOpen],
        },
    },
};

const recordings = loadRecordings();

describe('grabaciones guiadas', () => {
    test('cada grabación tiene sus anotaciones', () => {
        expect(recordings.map(({ name }) => name).sort()).toEqual(
            Object.keys(ANNOTATIONS).sort(),
        );
    });

    for (const { name, recording } of recordings) {
        const annotation = ANNOTATIONS[name];

        if (annotation === undefined) {
            continue;
        }

        describe(name, () => {
            const baseline = calibrateFromRecording(recording);

            test('la calibración automática toma la postura neutra', () => {
                expect(baseline.headPose).toBeDefined();
                expect(Math.abs(baseline.headPose!.pitch)).toBeLessThan(0.4);
                expect(Math.abs(baseline.headPose!.roll)).toBeLessThan(0.4);
            });

            test(`a sensibilidad ${annotation.sensitivity} detecta lo que hizo y nada más`, () => {
                expect(
                    replay(recording, baseline, annotation.sensitivity),
                ).toEqual(annotation.expected);
            });

            const nearby = [annotation.sensitivity - 1, annotation.sensitivity];

            for (const sensitivity of nearby) {
                test(`a sensibilidad ${sensitivity} no hay gestos ajenos a cada paso`, () => {
                    const starts = replay(recording, baseline, sensitivity);
                    const unexpected = recording.steps.flatMap((step) =>
                        Object.keys(starts[step.id])
                            .filter(
                                (gesture) =>
                                    !step.expected.includes(
                                        gesture as GestureType,
                                    ) &&
                                    !(
                                        annotation.tolerated[step.id] ?? []
                                    ).includes(gesture as GestureType),
                            )
                            .map((gesture) => `${step.id}: ${gesture}`),
                    );

                    expect(unexpected).toEqual([]);
                });
            }
        });
    }
});
