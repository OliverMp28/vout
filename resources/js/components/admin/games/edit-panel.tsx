import { useForm } from '@inertiajs/react';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Panel } from '@/components/admin/panel';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import admin from '@/routes/admin';
import type { AdminGameCategory, AdminGameDetail } from '@/types';

const { games: gamesRoutes } = admin;

const MAX_CATEGORIES = 5;
const MAX_DEVELOPERS = 10;

type EditPanelProps = {
    game: AdminGameDetail;
    categories: AdminGameCategory[];
    developers: AdminGameCategory[];
};

export function EditPanel({ game, categories, developers }: EditPanelProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: game.name,
        description: game.description ?? '',
        embed_url: game.embed_url ?? '',
        cover_image: game.cover_image ?? '',
        release_date: game.release_date ?? '',
        repo_url: game.repo_url ?? '',
        category_ids: game.category_ids,
        developer_ids: game.developer_ids,
    });

    const handleSave = (): void => {
        put(gamesRoutes.update(game.slug).url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    const toggleCategory = (id: number): void => {
        const next = data.category_ids.includes(id)
            ? data.category_ids.filter((v) => v !== id)
            : data.category_ids.length < MAX_CATEGORIES
              ? [...data.category_ids, id]
              : data.category_ids;
        setData('category_ids', next);
    };

    const toggleDeveloper = (id: number): void => {
        const next = data.developer_ids.includes(id)
            ? data.developer_ids.filter((v) => v !== id)
            : data.developer_ids.length < MAX_DEVELOPERS
              ? [...data.developer_ids, id]
              : data.developer_ids;
        setData('developer_ids', next);
    };

    if (!open) {
        return (
            <Panel title={t('admin.games.show.edit.heading')}>
                <p className="text-sm text-muted-foreground">
                    {t('admin.games.show.edit.description')}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(true)}
                    className="w-fit gap-2"
                >
                    <Pencil className="size-4" aria-hidden />
                    {t('admin.games.show.edit.open')}
                </Button>
            </Panel>
        );
    }

    return (
        <Panel title={t('admin.games.show.edit.heading')}>
            <div className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="edit-name">
                        {t('admin.games.show.edit.name')}
                    </Label>
                    <Input
                        id="edit-name"
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        maxLength={255}
                        disabled={processing}
                    />
                    <InputError message={errors.name} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="edit-description">
                        {t('admin.games.show.edit.description_field')}
                    </Label>
                    <Textarea
                        id="edit-description"
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        rows={4}
                        maxLength={5000}
                        disabled={processing}
                    />
                    <InputError message={errors.description} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-embed-url">
                            {t('admin.games.show.edit.embed_url')}
                        </Label>
                        <Input
                            id="edit-embed-url"
                            type="url"
                            value={data.embed_url}
                            onChange={(e) =>
                                setData('embed_url', e.target.value)
                            }
                            disabled={processing}
                            className="font-mono text-sm"
                        />
                        <InputError message={errors.embed_url} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-cover-image">
                            {t('admin.games.show.edit.cover_image')}
                        </Label>
                        <Input
                            id="edit-cover-image"
                            type="url"
                            value={data.cover_image}
                            onChange={(e) =>
                                setData('cover_image', e.target.value)
                            }
                            disabled={processing}
                            className="font-mono text-sm"
                        />
                        <InputError message={errors.cover_image} />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-release-date">
                            {t('admin.games.show.edit.release_date')}
                        </Label>
                        <Input
                            id="edit-release-date"
                            type="date"
                            value={data.release_date}
                            onChange={(e) =>
                                setData('release_date', e.target.value)
                            }
                            disabled={processing}
                        />
                        <InputError message={errors.release_date} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-repo-url">
                            {t('admin.games.show.edit.repo_url')}
                        </Label>
                        <Input
                            id="edit-repo-url"
                            type="url"
                            value={data.repo_url}
                            onChange={(e) =>
                                setData('repo_url', e.target.value)
                            }
                            disabled={processing}
                            className="font-mono text-sm"
                        />
                        <InputError message={errors.repo_url} />
                    </div>
                </div>

                {categories.length > 0 && (
                    <ChipGroup
                        legend={t('admin.games.show.edit.categories')}
                        hint={t('admin.games.show.edit.categories_hint', {
                            max: String(MAX_CATEGORIES),
                        })}
                        counter={`${data.category_ids.length}/${MAX_CATEGORIES}`}
                        options={categories}
                        selected={data.category_ids}
                        onToggle={toggleCategory}
                        fieldPrefix="edit-cat"
                        disabled={processing}
                        error={errors.category_ids}
                    />
                )}

                {developers.length > 0 && (
                    <ChipGroup
                        legend={t('admin.games.show.edit.developers')}
                        hint={t('admin.games.show.edit.developers_hint', {
                            max: String(MAX_DEVELOPERS),
                        })}
                        counter={`${data.developer_ids.length}/${MAX_DEVELOPERS}`}
                        options={developers}
                        selected={data.developer_ids}
                        onToggle={toggleDeveloper}
                        fieldPrefix="edit-dev"
                        disabled={processing}
                        error={errors.developer_ids}
                    />
                )}

                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={processing}
                        className="gap-2"
                    >
                        <Pencil className="size-4" aria-hidden />
                        {t('admin.games.show.edit.save')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        disabled={processing}
                    >
                        {t('admin.games.show.actions.cancel')}
                    </Button>
                </div>
            </div>
        </Panel>
    );
}

// ── ChipGroup ────────────────────────────────────────────────────────

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
                                    onCheckedChange={() => onToggle(option.id)}
                                    className="size-3.5"
                                />
                                {option.name}
                            </label>
                        </li>
                    );
                })}
            </ul>
            <InputError message={error} />
        </fieldset>
    );
}
