/**
 * TelemetryCollector
 *
 * Clase agnóstica de worker/React para recolectar métricas continuas del Motor de Gestos.
 * Permite medir performance E2E manteniendo una ventana temporal vía RingBuffers para minimizar
 * el impacto del colector de basura.
 */

export type TelemetrySnapshot = {
    [key: string]: {
        p50: number;
        p95: number;
        avg: number;
        min: number;
        max: number;
        count: number;
    };
};

export class TelemetryCollector {
    private buffers: Map<string, Float32Array> = new Map();
    private counts: Map<string, number> = new Map();
    private readonly capacity: number;

    constructor(capacity = 300) {
        this.capacity = capacity;
    }

    /**
     * Asegura que exista un buffer circular pre-reservado y guarda el valor.
     */
    push(key: string, value: number): void {
        let buffer = this.buffers.get(key);
        if (!buffer) {
            buffer = new Float32Array(this.capacity);
            this.buffers.set(key, buffer);
            this.counts.set(key, 0);
        }

        const count = this.counts.get(key) ?? 0;
        const index = count % this.capacity;
        buffer[index] = value;
        this.counts.set(key, count + 1);
    }

    /**
     * Retorna estadísticas (p50, p95, avg, min, max, count) para cada métrica rastreada.
     */
    snapshot(): TelemetrySnapshot {
        const result: TelemetrySnapshot = {};

        for (const [key, buffer] of this.buffers.entries()) {
            const totalCount = this.counts.get(key) ?? 0;
            if (totalCount === 0) continue;

            // Extraer la porción del array que tiene datos reales (para cuando el set no está lleno aún)
            const activeCount = Math.min(totalCount, this.capacity);
            // Hacer una copia y ordenar es requerido para los percentiles
            const sorted = Float32Array.from(buffer.slice(0, activeCount)).sort();

            let sum = 0;
            for (let i = 0; i < activeCount; i++) {
                sum += sorted[i];
            }

            result[key] = {
                p50: sorted[Math.floor(activeCount * 0.5)],
                p95: sorted[Math.floor(activeCount * 0.95)],
                avg: sum / activeCount,
                min: sorted[0],
                max: sorted[activeCount - 1],
                count: activeCount,
            };
        }

        return result;
    }

    /**
     * Vacia todos los buffers internamente
     */
    reset(): void {
        // En lugar de instanciar nuevos Maps, solo reseteamos los contadores 
        // para abusar positivamente de la pre-alojación de Float32Arrays.
        for (const key of this.counts.keys()) {
            this.counts.set(key, 0);
        }
    }

    /**
     * Construye un string en formato CSV a partir de la ventana de captura.
     * Cuidado: Como cada buffer puede tener diferentes muestras recolectadas a distintos
     * timestamps, este exportador exportará p50, p95, avg, etc. en su lugar.
     */
    export(): string {
        const snap = this.snapshot();
        let csv = 'Metric,p50,p95,avg,min,max,count\n';

        for (const key of Object.keys(snap).sort()) {
            const data = snap[key];
            csv += `${key},${data.p50.toFixed(2)},${data.p95.toFixed(2)},${data.avg.toFixed(2)},${data.min.toFixed(2)},${data.max.toFixed(2)},${data.count}\n`;
        }

        return csv;
    }
}
