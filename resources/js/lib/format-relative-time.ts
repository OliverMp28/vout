type Translator = (key: string, params?: Record<string, string | number>) => string;

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Tiempo relativo humano sin librerías externas.
 *
 * Devuelve la traducción según el diff con `now`:
 *   < 1 min  → "ahora"
 *   < 1 h    → "hace Xm"
 *   < 1 d    → "hace Xh"
 *   < 2 d    → "ayer"
 *   < 7 d    → "hace Xd"
 *   resto    → "el 14 feb" (formato fecha del locale)
 *
 * El translator se inyecta para no acoplar a `useTranslation`
 * y permitir tests unitarios puros.
 */
export function formatRelativeTime(
    isoDate: string,
    t: Translator,
    locale = 'es',
    now: Date = new Date(),
): string {
    const then = new Date(isoDate);
    const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (Number.isNaN(diffSeconds) || diffSeconds < 0) {
        return t('common.time.just_now');
    }

    if (diffSeconds < MINUTE) {
        return t('common.time.just_now');
    }

    if (diffSeconds < HOUR) {
        const minutes = Math.floor(diffSeconds / MINUTE);
        return t('common.time.minutes_ago', { count: minutes });
    }

    if (diffSeconds < DAY) {
        const hours = Math.floor(diffSeconds / HOUR);
        return t('common.time.hours_ago', { count: hours });
    }

    if (diffSeconds < 2 * DAY) {
        return t('common.time.yesterday');
    }

    if (diffSeconds < WEEK) {
        const days = Math.floor(diffSeconds / DAY);
        return t('common.time.days_ago', { count: days });
    }

    return then.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
    });
}
