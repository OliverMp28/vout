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

    /** Offsets de recentrado — se restan de la entrada raw antes de todo procesamiento. */
    private offsetX = 0;
    private offsetY = 0;

    /**
     * Bias de salida — desplaza el punto neutral de la salida.
     *
     * Sin bias, la cabeza neutral produce (0.5, 0.5) = centro del viewport.
     * Cuando el iframe no ocupa todo el viewport, el centro del viewport ≠
     * centro del iframe. El bias desplaza la salida para que la cabeza neutral
     * apunte al centro del iframe (o cualquier target que el consumidor elija).
     *
     * biasX = targetX - 0.5, biasY = targetY - 0.5.
     * Se suma a la salida después del EMA y se clampea a [0, 1].
     */
    private biasX = 0;
    private biasY = 0;

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

        // 0. Aplicar offset de recentrado (la posición neutral del usuario).
        //    Esto ocurre ANTES de todo procesamiento para que la zona muerta,
        //    la inversión y el suavizado trabajen con coordenadas centradas.
        const centeredH = horizontal - this.offsetX;
        const centeredV = vertical - this.offsetY;

        // 1. Zona muerta con remapeo continuo.
        //    Valores dentro de la zona muerta colapsan a 0. Los externos se escalan
        //    para que el movimiento comience suavemente en el borde de la zona muerta.
        const remappedX = applyDeadZone(centeredH, deadZone);
        const remappedY = applyDeadZone(centeredV, deadZone);

        // 2. Inversión de ejes (preferencia del usuario).
        const directedX = invertX ? -remappedX : remappedX;
        const directedY = invertY ? remappedY : -remappedY;

        // 3. Mapear [-1, 1] → [0, 1] para coordenadas de pantalla.
        //    directedX > 0 → cursor derecha, directedY > 0 → cursor arriba (Y invertida).
        const rawX = (directedX + 1) / 2;
        const rawY = (directedY + 1) / 2;

        // 4. Suavizado EMA Dinámico (Smart Dynamic Smoothing)
        if (!this.initialized) {
            this.smoothedX = rawX;
            this.smoothedY = rawY;
            this.initialized = true;
        } else {
            // Calcular la distancia subyacente entre la posición actual y el nuevo objetivo
            const deltaX = rawX - this.smoothedX;
            const deltaY = rawY - this.smoothedY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Umbral de salto rápido. Si recorre más del 8% de la pantalla en un frame, es crítico
            const fastMotionThreshold = 0.08;
            const speedFactor = Math.min(distance / fastMotionThreshold, 1.0);

            // Interpolar entre el smoothing estático (de precisión/reposo) y un fast-follow
            // smoothing: 0-1. Si el usuario configuró smoothing en 0.6 (base).
            // Cuando la velocidad es máxima (speedFactor=1), el smoothing bajará a actionSmoothing (ej 0.15)
            // dándonos un seguimiento ultrarrápido y recortando latencia.
            const actionSmoothing = 0.15;
            const fallbackSmoothing = Math.max(smoothing, 0.5); // Limitar mínimo para reposo
            const dynamicSmoothing =
                fallbackSmoothing -
                speedFactor * (fallbackSmoothing - actionSmoothing);

            this.smoothedX =
                dynamicSmoothing * this.smoothedX +
                (1 - dynamicSmoothing) * rawX;
            this.smoothedY =
                dynamicSmoothing * this.smoothedY +
                (1 - dynamicSmoothing) * rawY;
        }

        // 5. Aplicar bias de salida y clampear a [0, 1].
        //    Sin bias (default), neutral = 0.5 = centro del viewport.
        //    Con bias, neutral se desplaza al centro del iframe.
        return {
            x: clamp01(this.smoothedX + this.biasX),
            y: clamp01(this.smoothedY + this.biasY),
        };
    }

    /**
     * Recentra la posición neutral de la cabeza.
     *
     * Guarda los valores raw actuales como offset de entrada (la cabeza actual
     * se convierte en el nuevo punto neutral). Adicionalmente, calcula un bias
     * de salida para que el punto neutral apunte a `targetX`/`targetY` en
     * espacio de viewport, en lugar del hardcodeado (0.5, 0.5).
     *
     * Caso de uso: webcam en ángulo → cursor empieza desplazado. El iframe
     * del juego no ocupa todo el viewport (hay header + panel lateral), así
     * que (0.5, 0.5) en viewport no es el centro del juego. Al pulsar
     * "Centrar cursor", el offset corrige la entrada y el bias desplaza la
     * salida para que el cursor apunte al centro del iframe.
     *
     * @param rawHorizontal  Último valor horizontal raw recibido por update().
     * @param rawVertical    Último valor vertical raw recibido por update().
     * @param targetX        Posición X destino en viewport [0, 1] (default 0.5).
     * @param targetY        Posición Y destino en viewport [0, 1] (default 0.5).
     */
    recenter(
        rawHorizontal: number,
        rawVertical: number,
        targetX = 0.5,
        targetY = 0.5,
    ): void {
        this.offsetX = rawHorizontal;
        this.offsetY = rawVertical;

        // Bias de salida: la diferencia entre el target y el centro natural (0.5).
        // Se suma a la salida de update() para desplazar el punto neutral.
        this.biasX = targetX - 0.5;
        this.biasY = targetY - 0.5;

        // Internamente el EMA vuelve a 0.5 (neutral). El bias desplaza la
        // salida para que el cursor aparezca en targetX/targetY.
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
    }

    /** Actualiza la configuración en tiempo de ejecución (ej. el usuario cambió un slider). */
    setConfig(partial: Partial<HeadTrackerConfig>): void {
        Object.assign(this.config, partial);
    }

    /** Reinicia el estado suavizado, offsets y bias — llamar al detener la detección. */
    reset(): void {
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.offsetX = 0;
        this.offsetY = 0;
        this.biasX = 0;
        this.biasY = 0;
        this.initialized = false;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clampea un valor al rango [0, 1]. */
function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

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
