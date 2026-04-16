import { Link } from '@inertiajs/react';
import { AlertCircle, Plus } from 'lucide-react';
import type { ReactNode, SubmitEvent } from 'react';
import { FlowDiagram } from '@/components/developers/flow-diagram';
import { InfoHint } from '@/components/developers/info-hint';
import { UrlPathInput } from '@/components/developers/url-path-input';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type {
    CategoryOption,
    DeveloperAppOption,
    DeveloperOption,
    GameFormData,
} from '@/types';

const { apps: appsRoutes } = developers;

const MAX_CATEGORIES = 5;
const MAX_DEVELOPERS = 10;

type FormErrors = Partial<Record<keyof GameFormData | string, string>>;

type GameFormProps = {
    mode: 'create' | 'edit';
    data: GameFormData;
    errors: FormErrors;
    processing: boolean;
    apps: readonly DeveloperAppOption[];
    categories: readonly CategoryOption[];
    developers: readonly DeveloperOption[];
    onChange: <K extends keyof GameFormData>(
        key: K,
        value: GameFormData[K],
    ) => void;
    onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
    onReset?: () => void;
    submitLabel: string;
    secondary?: ReactNode;
    disabled?: boolean;
};

/**
 * Formulario reutilizable para envío y edición de juegos (Fase 4.2, S1).
 *
 * Estado y acción HTTP residen en el padre — este componente sólo emite
 * cambios tipados y pinta errores del backend. Así se comparte 1:1 entre
 * create.tsx (POST) y show.tsx (PUT) sin duplicar la UI.
 */
export function GameForm({
    mode,
    data,
    errors,
    processing,
    apps,
    categories,
    developers: developerOptions,
    onChange,
    onSubmit,
    onReset,
    submitLabel,
    secondary,
    disabled = false,
}: GameFormProps) {
    const { t } = useTranslation();
    const isLocked = disabled || processing;

    const hasApps = apps.length > 0;
    const selectedApp = apps.find((app) => app.id === data.registered_app_id);

    const toggleCategory = (id: number): void => {
        const next = data.category_ids.includes(id)
            ? data.category_ids.filter((existing) => existing !== id)
            : data.category_ids.length < MAX_CATEGORIES
              ? [...data.category_ids, id]
              : data.category_ids;
        onChange('category_ids', next);
    };

    const toggleDeveloper = (id: number): void => {
        const next = data.developer_ids.includes(id)
            ? data.developer_ids.filter((existing) => existing !== id)
            : data.developer_ids.length < MAX_DEVELOPERS
              ? [...data.developer_ids, id]
              : data.developer_ids;
        onChange('developer_ids', next);
    };

    return (
        <form
            onSubmit={onSubmit}
            noValidate
            className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
            <div className="space-y-6">
                {!hasApps && mode === 'create' && (
                    <Alert variant="default" className="border-amber-500/40">
                        <AlertCircle className="size-4 text-amber-500" />
                        <AlertTitle>
                            {t('developers.games.create.no_apps.title')}
                        </AlertTitle>
                        <AlertDescription className="space-y-3">
                            <p>
                                {t(
                                    'developers.games.create.no_apps.description',
                                )}
                            </p>
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={appsRoutes.create().url}
                                    prefetch
                                    className="gap-1.5"
                                >
                                    <Plus className="size-4" aria-hidden />
                                    {t(
                                        'developers.games.create.no_apps.cta',
                                    )}
                                </Link>
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                <Section
                    title={t('developers.games.form.section.basics.title')}
                    description={t(
                        'developers.games.form.section.basics.description',
                    )}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="game-name">
                            {t('developers.games.form.name.label')}
                        </Label>
                        <Input
                            id="game-name"
                            type="text"
                            value={data.name}
                            onChange={(event) =>
                                onChange('name', event.target.value)
                            }
                            autoComplete="off"
                            maxLength={120}
                            required
                            disabled={isLocked}
                            placeholder={t(
                                'developers.games.form.name.placeholder',
                            )}
                            aria-invalid={
                                errors.name !== undefined || undefined
                            }
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="game-description">
                            {t('developers.games.form.description.label')}
                        </Label>
                        <Textarea
                            id="game-description"
                            value={data.description}
                            onChange={(event) =>
                                onChange('description', event.target.value)
                            }
                            rows={6}
                            required
                            maxLength={2000}
                            disabled={isLocked}
                            placeholder={t(
                                'developers.games.form.description.placeholder',
                            )}
                            aria-invalid={
                                errors.description !== undefined || undefined
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('developers.games.form.description.hint')}
                        </p>
                        <InputError message={errors.description} />
                    </div>
                </Section>

                <Section
                    title={t('developers.games.form.section.app.title')}
                    description={t(
                        'developers.games.form.section.app.description',
                    )}
                >
                    <div className="grid gap-2">
                        <span className="inline-flex items-center gap-1.5">
                            <Label htmlFor="game-app">
                                {t('developers.games.form.app.label')}
                            </Label>
                            <InfoHint
                                label={t('developers.hints.allowed_origins.label')}
                            >
                                <p>
                                    {t('developers.hints.allowed_origins.body')}
                                </p>
                            </InfoHint>
                        </span>
                        <Select
                            value={
                                data.registered_app_id !== null
                                    ? String(data.registered_app_id)
                                    : undefined
                            }
                            onValueChange={(value) =>
                                onChange(
                                    'registered_app_id',
                                    value ? Number(value) : null,
                                )
                            }
                            disabled={isLocked || !hasApps}
                        >
                            <SelectTrigger
                                id="game-app"
                                aria-invalid={
                                    errors.registered_app_id !== undefined ||
                                    undefined
                                }
                                className="w-full"
                            >
                                <SelectValue
                                    placeholder={t(
                                        'developers.games.form.app.empty_option',
                                    )}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {apps.map((app) => (
                                    <SelectItem
                                        key={app.id}
                                        value={String(app.id)}
                                        disabled={!app.is_active}
                                    >
                                        {app.name}
                                        {!app.is_active
                                            ? ` — ${t('developers.dashboard.index.status.paused')}`
                                            : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {t('developers.games.form.app.hint')}
                        </p>
                        <InputError message={errors.registered_app_id} />
                    </div>

                    <div className="grid gap-2">
                        <span className="inline-flex items-center gap-1.5">
                            <Label htmlFor="game-embed-url">
                                {t('developers.games.form.embed_url.label')}
                            </Label>
                            <InfoHint
                                label={t('developers.hints.embed_url.label')}
                            >
                                <p>{t('developers.hints.embed_url.body')}</p>
                            </InfoHint>
                        </span>
                        <UrlPathInput
                            id="game-embed-url"
                            origins={selectedApp?.allowed_origins ?? []}
                            value={data.embed_url}
                            onChange={(next) => onChange('embed_url', next)}
                            disabled={isLocked}
                            invalid={errors.embed_url !== undefined}
                            pathPlaceholder={t(
                                'developers.games.form.embed_url.path_placeholder',
                            )}
                        />
                        <p className="text-xs text-muted-foreground">
                            {selectedApp
                                ? t('developers.games.form.embed_url.hint')
                                : t(
                                      'developers.games.form.embed_url.no_app_hint',
                                  )}
                        </p>
                        <InputError message={errors.embed_url} />
                    </div>
                </Section>

                <Section
                    title={t('developers.games.form.section.meta.title')}
                    description={t(
                        'developers.games.form.section.meta.description',
                    )}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="game-cover-image">
                            {t('developers.games.form.cover_image.label')}
                        </Label>
                        <Input
                            id="game-cover-image"
                            type="url"
                            inputMode="url"
                            value={data.cover_image}
                            onChange={(event) =>
                                onChange('cover_image', event.target.value)
                            }
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={500}
                            disabled={isLocked}
                            placeholder="https://cdn.mi-app.com/cover.jpg"
                            className="font-mono text-sm"
                            aria-invalid={
                                errors.cover_image !== undefined || undefined
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('developers.games.form.cover_image.hint')}
                        </p>
                        <InputError message={errors.cover_image} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="game-release-date">
                                {t(
                                    'developers.games.form.release_date.label',
                                )}
                            </Label>
                            <Input
                                id="game-release-date"
                                type="date"
                                value={data.release_date}
                                onChange={(event) =>
                                    onChange(
                                        'release_date',
                                        event.target.value,
                                    )
                                }
                                disabled={isLocked}
                                aria-invalid={
                                    errors.release_date !== undefined ||
                                    undefined
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'developers.games.form.release_date.hint',
                                )}
                            </p>
                            <InputError message={errors.release_date} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="game-repo-url">
                                {t('developers.games.form.repo_url.label')}
                            </Label>
                            <Input
                                id="game-repo-url"
                                type="url"
                                inputMode="url"
                                value={data.repo_url}
                                onChange={(event) =>
                                    onChange('repo_url', event.target.value)
                                }
                                autoComplete="off"
                                spellCheck={false}
                                maxLength={255}
                                disabled={isLocked}
                                placeholder="https://github.com/org/game"
                                className="font-mono text-sm"
                                aria-invalid={
                                    errors.repo_url !== undefined || undefined
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {t('developers.games.form.repo_url.hint')}
                            </p>
                            <InputError message={errors.repo_url} />
                        </div>
                    </div>
                </Section>

                <Section
                    title={t(
                        'developers.games.form.section.taxonomy.title',
                    )}
                    description={t(
                        'developers.games.form.section.taxonomy.description',
                    )}
                >
                    <ChipGroup
                        legend={t('developers.games.form.categories.label')}
                        hint={t('developers.games.form.categories.hint')}
                        counter={`${data.category_ids.length}/${MAX_CATEGORIES}`}
                        options={categories}
                        selected={data.category_ids}
                        onToggle={toggleCategory}
                        fieldPrefix="category"
                        disabled={isLocked}
                        error={
                            errors.category_ids ??
                            errors['category_ids.0' as keyof typeof errors]
                        }
                    />

                    <ChipGroup
                        legend={t('developers.games.form.developers.label')}
                        hint={t('developers.games.form.developers.hint')}
                        counter={`${data.developer_ids.length}/${MAX_DEVELOPERS}`}
                        options={developerOptions}
                        selected={data.developer_ids}
                        onToggle={toggleDeveloper}
                        fieldPrefix="developer"
                        disabled={isLocked}
                        error={errors.developer_ids}
                    />
                </Section>

                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        type="submit"
                        disabled={isLocked || (mode === 'create' && !hasApps)}
                    >
                        {processing
                            ? t('developers.form.submitting')
                            : submitLabel}
                    </Button>
                    {onReset && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onReset}
                            disabled={isLocked}
                        >
                            {t('developers.form.reset')}
                        </Button>
                    )}
                    {secondary}
                </div>
            </div>

            <aside
                className="order-first h-fit space-y-4 rounded-2xl border border-border bg-card p-6 text-sm shadow-sm lg:order-0 lg:sticky lg:top-24"
                aria-label={t('developers.games.form.help.heading')}
            >
                <h2 className="text-base font-semibold tracking-tight">
                    {t('developers.games.form.help.heading')}
                </h2>
                <FlowDiagram variant="game" />
                <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    {t('developers.games.form.help.review.description')}
                </p>
            </aside>
        </form>
    );
}

type SectionProps = {
    title: string;
    description?: string;
    children: ReactNode;
};

function Section({ title, description, children }: SectionProps) {
    return (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

type ChipGroupProps = {
    legend: string;
    hint: string;
    counter: string;
    options: readonly { id: number; name: string; slug: string }[];
    selected: readonly number[];
    onToggle: (id: number) => void;
    fieldPrefix: string;
    disabled: boolean;
    error?: string;
};

function ChipGroup({
    legend,
    hint,
    counter,
    options,
    selected,
    onToggle,
    fieldPrefix,
    disabled,
    error,
}: ChipGroupProps) {
    return (
        <fieldset className="space-y-2" disabled={disabled}>
            <div className="flex items-baseline justify-between gap-2">
                <legend className="text-sm font-medium">{legend}</legend>
                <span className="text-xs text-muted-foreground">{counter}</span>
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
            {options.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    —
                </p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {options.map((option) => {
                        const checked = selected.includes(option.id);
                        const id = `${fieldPrefix}-${option.id}`;
                        return (
                            <li key={option.id}>
                                <label
                                    htmlFor={id}
                                    className={cn(
                                        'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                                        checked
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                        disabled &&
                                            'cursor-not-allowed opacity-60',
                                    )}
                                >
                                    <Checkbox
                                        id={id}
                                        checked={checked}
                                        onCheckedChange={() =>
                                            onToggle(option.id)
                                        }
                                        className="size-3.5"
                                    />
                                    {option.name}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
            <InputError message={error} />
        </fieldset>
    );
}

