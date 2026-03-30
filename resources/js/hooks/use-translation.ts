import { usePage } from '@inertiajs/react';

export function useTranslation() {
    const { translations, locale } = usePage().props as any;

    const t = (key: string, replacements?: Record<string, string | number>) => {
        let translation = (translations || {})[key] || key;

        if (replacements && translation) {
            Object.keys(replacements).forEach((replaceKey) => {
                translation = translation.replace(
                    new RegExp(`:${replaceKey}`, 'g'),
                    String(replacements[replaceKey]),
                );
            });
        }

        return translation;
    };

    return { t, locale };
}
