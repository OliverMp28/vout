/**
 * Mapeo de orientación de cabeza a cursor en espacio de pantalla.
 *
 * Convierte la orientación de la cabeza normalizada [-1, 1] en coordenadas
 * de pantalla [0, 1] aptas para renderizar un cursor virtual.
 *
 * Características:
 * - Zona muerta configurable (evita jitter cuando la cabeza está quieta)
 * - Suavizado EMA (Exponential Moving Average) configurable
 * - Inversión de ejes por eje (preferencia del usuario)
 *
 * Sin dependencias de DOM ni React — válido en Workers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeadTrackerConfig = {
    /** Radio de zona muerta (0.0-0.5). Valores por debajo se tratan como centro. */
    deadZone: number;
    /** Factor EMA (0.0-1.0). Mayor valor = más suave pero con más latencia. */
    smoothing: number;
    /** Invertir eje horizontal (derecha se convierte en izquierda). */
    invertX: boolean;
    /** Invertir eje vertical (arriba se convierte en abajo). */
    invertY: boolean;
};

export type HeadTrackPosition = {
    /** Posición horizontal: 0 = borde izquierdo, 1 = borde derecho. */
    x: number;
    /** Posición vertical: 0 = borde superior, 1 = borde inferior. */
    y: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: HeadTrackerConfig = {
    deadZone: 0.05,
    smoothing: 0.6,
    invertX: false,
    invertY: false,
};

// ---------------------------------------------------------------------------
// HeadTracker
// ---------------------------------------------------------------------------

export class HeadTracker {
    private config: HeadTrackerConfig;
    private smoothedX = 0.5;
    private smoothedY = 0.5;
    private initialized = false;

    constructor(config?: Partial<HeadTrackerConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Procesa una muestra de orientación y devuelve coordenadas de pantalla suavizadas.
     *
     * IMPORTANTE — desajuste de ejes de MediaPipe:
     * La descomposición ZYX de head-pose.ts asume Y hacia arriba, pero MediaPipe usa
     * un sistema de coordenadas diferente. Los ejes resultantes NO coinciden con los
     * movimientos físicos esperados. Empíricamente verificado en Vision Lab (2026-04-04):
     *
     *   headPose.pitch → responde al GIRO izquierda/derecha  → pasar como `horizontal`
     *   headPose.roll  → responde al CABECEO arriba/abajo    → pasar como `vertical`
     *   headPose.yaw   → responde al LADEO de cabeza         → no se usa para el cursor
     *
     * Negaciones correctas (verificadas empíricamente):
     *   horizontal = -headPose.pitch  (giro derecha → cursor derecha)
     *   vertical   = -headPose.roll   (cabeceo abajo → cursor abajo)
     *
     * @param horizontal  Valor que controla el eje horizontal, normalizado [-1, 1].
     * @param vertical    Valor que controla el eje vertical, normalizado [-1, 1].
     */
    update(horizontal: number, vertical: number): HeadTrackPosition {
        const { deadZone, smoothing, invertX, invertY } = this.config;

        // 1. Zona muerta con remapeo continuo.
        //    Valores dentro de la zona muerta colapsan a 0. Los externos se escalan
        //    para que el movimiento comience suavemente en el borde de la zona muerta.
        const remappedX = applyDeadZone(horizontal, deadZone);
        const remappedY = applyDeadZone(vertical, deadZone);

        // 2. Inversión de ejes (preferencia del usuario).
        const directedX = invertX ? -remappedX : remappedX;
        const directedY = invertY ? remappedY : -remappedY;

        // 3. Mapear [-1, 1] → [0, 1] para coordenadas de pantalla.
        //    directedX > 0 → cursor derecha, directedY > 0 → cursor arriba (Y invertida).
        const rawX = (directedX + 1) / 2;
        const rawY = (directedY + 1) / 2;

        // 4. Suavizado EMA.
        //    En el primer sample, posicionar directamente para evitar animación desde el centro.
        if (!this.initialized) {
            this.smoothedX = rawX;
            this.smoothedY = rawY;
            this.initialized = true;
        } else {
            this.smoothedX = smoothing * this.smoothedX + (1 - smoothing) * rawX;
            this.smoothedY = smoothing * this.smoothedY + (1 - smoothing) * rawY;
        }

        return { x: this.smoothedX, y: this.smoothedY };
    }

    /** Actualiza la configuración en tiempo de ejecución (ej. el usuario cambió un slider). */
    setConfig(partial: Partial<HeadTrackerConfig>): void {
        Object.assign(this.config, partial);
    }

    /** Reinicia el estado suavizado — llamar al detener la detección. */
    reset(): void {
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.initialized = false;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Aplica zona muerta con remapeo continuo.
 *
 * Si |value| < deadZone devuelve 0 (sin movimiento).
 * Si no, remapea [deadZone, 1] → [0, 1] preservando signo, para que no haya
 * salto brusco al cruzar el borde de la zona muerta.
 */
function applyDeadZone(value: number, deadZone: number): number {
    const abs = Math.abs(value);
    if (abs < deadZone) return 0;

    const scale = 1 / (1 - deadZone);
    return Math.sign(value) * Math.min(1, (abs - deadZone) * scale);
}
