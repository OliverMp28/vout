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
    // El mismo portátil, ya con la separación de los labios (`lipsApart`) y
    // los pasos de labios entreabiertos y de sonrisa enseñando los dientes.
    '2026-11-23-intel-uhd-620': {
        sensitivity: 5,
        expected: {
            neutral: {},
            look_around: {},
            // Cinco aperturas, varias con la mandíbula casi quieta (0.09-0.21)
            // que antes no llegaban al umbral.
            mouth_front: { [GestureType.MouthOpen]: 5 },
            // Solo los labios (mandíbula 0.03-0.11): lo que no se detectaba.
            lips_apart: { [GestureType.MouthOpen]: 4 },
            // La cuarta vez apenas las levantó.
            brows_front: { [GestureType.BrowRaise]: 3 },
            mouth_up_right: { [GestureType.MouthOpen]: 1 },
            // Al bajar la cabeza apretó los labios hacia delante una vez.
            mouth_down_right: {
                [GestureType.MouthOpen]: 4,
                [GestureType.MouthPucker]: 1,
            },
            mouth_up_left: { [GestureType.MouthOpen]: 4 },
            brows_up: { [GestureType.BrowRaise]: 4 },
            // Los labios se separan al sonreír y al dejar de sonreír: no es
            // abrir la boca (el dino se agachaba al relajar la sonrisa). La
            // sonrisa grande baja las cejas: tampoco es el ceño.
            smile: { [GestureType.Smile]: 5 },
            smile_teeth: { [GestureType.Smile]: 2 },
            blink_left: { [GestureType.BlinkLeft]: 3 },
            // Una vez cerró los dos ojos con fuerza (no hay asimetría que
            // diga que es un guiño) y se le separaron los labios.
            blink_right: {
                [GestureType.BlinkRight]: 4,
                [GestureType.MouthOpen]: 1,
            },
            blink_natural: {},
            // Al terminar abrió la boca (mandíbula 0.11).
            frown: {
                [GestureType.BrowFrown]: 5,
                [GestureType.MouthOpen]: 1,
            },
            pucker: { [GestureType.MouthPucker]: 4 },
            // Límite conocido, mayor con los labios: al hablar la boca se
            // abre y se cierra de verdad.
            talk: {
                [GestureType.MouthOpen]: 8,
                [GestureType.MouthPucker]: 1,
                [GestureType.Smile]: 1,
            },
            // Seguía hablando al empezar el paso.
            neutral_end: { [GestureType.MouthOpen]: 1 },
        },
        tolerated: {
            mouth_down_right: [GestureType.MouthPucker],
            blink_right: [GestureType.MouthOpen],
            frown: [GestureType.MouthOpen],
            talk: [
                GestureType.MouthOpen,
                GestureType.MouthPucker,
                GestureType.Smile,
            ],
            neutral_end: [GestureType.MouthOpen],
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
