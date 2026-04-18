/**
 * Tipos del módulo legal (Fase 5).
 *
 * Refleja las props que `LegalController::show` entrega a Inertia para la
 * página `legal/show`. El controlador ya sustituye los tokens del markdown
 * y extrae la metadata del frontmatter, así que aquí el componente sólo
 * renderiza strings.
 */

export type LegalDocumentMeta = {
    readonly slug: string;
    readonly title_key: string;
};

export type LegalShowProps = {
    readonly slug: string;
    readonly title_key: string;
    readonly markdown: string;
    readonly version: string | null;
    readonly last_updated: string | null;
    readonly locale: string;
    readonly available_locales: readonly string[];
    readonly documents: readonly LegalDocumentMeta[];
};
