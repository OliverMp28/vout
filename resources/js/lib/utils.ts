import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

/**
 * Devuelve solo el host de una URL — útil para mostrar a qué sitio
 * pertenece algo sin enseñar un querystring lleno de parámetros internos.
 * Devuelve `null` si la URL no parsea (entrada corrupta).
 */
export function urlHost(url: string): string | null {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}
