import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { ActionRow, MetaRow, Panel } from '@/components/admin/panel';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type { AdminCategoryDetail } from '@/types';

const { categories: catRoutes } = admin;

type Props = {
    category: AdminCategoryDetail;
};

export default function AdminCategoriesEdit({ category }: Props) {
    const { t } = useTranslation();

    const {
        data,
        setData,
        put,
        processing: saving,
        errors,
    } = useForm({ name: category.name });

    const handleSubmit = (e: FormEvent): void => {
        e.preventDefault();
        put(catRoutes.update(category.slug).url);
    };

    return (
        <>
            <Head title={t('admin.categories.edit.title')} />

            <div className="space-y-6">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <Link href={catRoutes.index().url} prefetch>
                        <ArrowLeft className="size-4" aria-hidden />
                        {t('admin.categories.edit.back')}
                    </Link>
                </Button>

                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('admin.categories.edit.title')}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('admin.categories.edit.description')}
                    </p>
                </header>

                <div className="grid gap-6 lg:grid-cols-3">
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                {t('admin.categories.form.name')}
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder={t(
                                    'admin.categories.form.name_placeholder',
                                )}
                                disabled={saving}
                            />
                            <InputError message={errors.name} />
                        </div>

                        <Button type="submit" disabled={saving}>
                            {t('admin.categories.form.submit_update')}
                        </Button>
                    </form>

                    <div className="space-y-6">
                        <Panel title={t('admin.categories.edit.title')}>
                            <dl className="grid gap-4">
                                <MetaRow
                                    label={t(
                                        'admin.categories.edit.meta.slug',
                                    )}
                                    value={category.slug}
                                    monospace
                                />
                                <MetaRow
                                    label={t(
                                        'admin.categories.edit.meta.games_count',
                                    )}
                                    value={String(category.games_count)}
                                />
                                <MetaRow
                                    label={t(
                                        'admin.categories.edit.meta.created_at',
                                    )}
                                    value={
                                        category.created_at
                                            ? new Date(
                                                  category.created_at,
                                              ).toLocaleString()
                                            : '-'
                                    }
                                />
                                <MetaRow
                                    label={t(
                                        'admin.categories.edit.meta.updated_at',
                                    )}
                                    value={
                                        category.updated_at
                                            ? new Date(
                                                  category.updated_at,
                                              ).toLocaleString()
                                            : '-'
                                    }
                                />
                            </dl>
                        </Panel>

                        <DangerZone category={category} />
                    </div>
                </div>
            </div>
        </>
    );
}

AdminCategoriesEdit.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);

// ── Delete action ───────────────────────────────────────────────────

function DangerZone({ category }: { category: AdminCategoryDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const { delete: destroy, processing } = useForm({});

    const hasGames = category.games_count > 0;
    const canDelete = confirmation === category.slug;

    const handleDelete = (): void => {
        if (!canDelete) return;
        destroy(catRoutes.destroy(category.slug).url, {
            preserveScroll: false,
        });
    };

    return (
        <Panel title={t('admin.categories.edit.danger.title')} tone="danger">
            <ActionRow
                title={t('admin.categories.edit.danger.delete.title')}
                description={t(
                    'admin.categories.edit.danger.delete.description',
                )}
                action={
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            setConfirmation('');
                            setOpen(true);
                        }}
                        disabled={processing || hasGames}
                        className="gap-2"
                    >
                        <Trash2 className="size-4" aria-hidden />
                        {t('admin.categories.edit.danger.delete.cta')}
                    </Button>
                }
            />

            {hasGames && (
                <Alert variant="default" className="border-destructive/40">
                    <AlertTriangle className="size-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                        {t('admin.categories.edit.danger.delete.has_games', {
                            count: String(category.games_count),
                        })}
                    </AlertDescription>
                </Alert>
            )}

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!processing) setOpen(next);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'admin.categories.edit.danger.delete.confirm_title',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'admin.categories.edit.danger.delete.confirm_body',
                                { slug: category.slug },
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <Alert
                        variant="destructive"
                        className="border-destructive/40"
                    >
                        <AlertTriangle className="size-4" />
                        <AlertTitle>
                            {t(
                                'admin.categories.edit.danger.delete.warning_title',
                            )}
                        </AlertTitle>
                        <AlertDescription>
                            {t(
                                'admin.categories.edit.danger.delete.warning_body',
                            )}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="cat-delete-confirm">
                            {t(
                                'admin.categories.edit.danger.delete.confirm_label',
                                { slug: category.slug },
                            )}
                        </Label>
                        <Input
                            id="cat-delete-confirm"
                            type="text"
                            value={confirmation}
                            onChange={(e) =>
                                setConfirmation(e.target.value)
                            }
                            autoComplete="off"
                            spellCheck={false}
                            className="font-mono text-sm"
                            disabled={processing}
                        />
                        <InputError
                            message={
                                confirmation.length > 0 && !canDelete
                                    ? t(
                                          'admin.categories.edit.danger.delete.mismatch',
                                      )
                                    : undefined
                            }
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={processing}
                        >
                            {t('admin.games.show.actions.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!canDelete || processing}
                            className="gap-2"
                        >
                            <Trash2 className="size-4" aria-hidden />
                            {t('admin.categories.edit.danger.delete.cta')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Panel>
    );
}
