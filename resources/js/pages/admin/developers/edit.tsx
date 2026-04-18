import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    BadgeCheck,
    Trash2,
    UserCog,
    UserRound,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { ActionRow, MetaRow, Panel } from '@/components/admin/panel';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type {
    AdminDeveloperDetail,
    AdminDeveloperReassignUserOption,
} from '@/types';

const { developers: devRoutes } = admin;

type Props = {
    developer: AdminDeveloperDetail;
    reassign_candidates: AdminDeveloperReassignUserOption[];
};

export default function AdminDevelopersEdit({
    developer,
    reassign_candidates,
}: Props) {
    const { t } = useTranslation();

    const {
        data,
        setData,
        put,
        processing: saving,
        errors,
    } = useForm({
        name: developer.name,
        website_url: developer.website_url ?? '',
        bio: developer.bio ?? '',
        logo_url: developer.logo_url ?? '',
    });

    const handleSubmit = (e: FormEvent): void => {
        e.preventDefault();
        put(devRoutes.update(developer.slug).url);
    };

    return (
        <>
            <Head title={t('admin.developers.edit.title')} />

            <div className="space-y-6">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <Link href={devRoutes.index().url} prefetch>
                        <ArrowLeft className="size-4" aria-hidden />
                        {t('admin.developers.edit.back')}
                    </Link>
                </Button>

                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('admin.developers.edit.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.developers.edit.description')}
                        </p>
                    </div>
                    {developer.owner ? (
                        <Badge
                            variant="default"
                            className="h-fit w-fit gap-1 text-xs"
                        >
                            <BadgeCheck className="size-3.5" aria-hidden />
                            {t('admin.developers.badges.claimed')}
                        </Badge>
                    ) : (
                        <Badge
                            variant="secondary"
                            className="h-fit w-fit gap-1 text-xs"
                        >
                            <UserRound className="size-3.5" aria-hidden />
                            {t('admin.developers.badges.manual')}
                        </Badge>
                    )}
                </header>

                <div className="grid gap-6 lg:grid-cols-3">
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                {t('admin.developers.form.name')}
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder={t(
                                    'admin.developers.form.name_placeholder',
                                )}
                                disabled={saving}
                                aria-invalid={!!errors.name}
                                aria-describedby={
                                    errors.name ? 'name-error' : undefined
                                }
                            />
                            <InputError id="name-error" message={errors.name} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="website_url">
                                {t('admin.developers.form.website_url')}
                            </Label>
                            <Input
                                id="website_url"
                                type="url"
                                value={data.website_url}
                                onChange={(e) =>
                                    setData('website_url', e.target.value)
                                }
                                placeholder={t(
                                    'admin.developers.form.website_url_placeholder',
                                )}
                                disabled={saving}
                                aria-invalid={!!errors.website_url}
                                aria-describedby={
                                    errors.website_url
                                        ? 'website-url-error'
                                        : undefined
                                }
                            />
                            <InputError
                                id="website-url-error"
                                message={errors.website_url}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio">
                                {t('admin.developers.form.bio')}
                            </Label>
                            <Textarea
                                id="bio"
                                value={data.bio}
                                onChange={(e) => setData('bio', e.target.value)}
                                placeholder={t(
                                    'admin.developers.form.bio_placeholder',
                                )}
                                rows={3}
                                disabled={saving}
                                aria-invalid={!!errors.bio}
                                aria-describedby={
                                    errors.bio ? 'bio-error' : undefined
                                }
                            />
                            <InputError id="bio-error" message={errors.bio} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logo_url">
                                {t('admin.developers.form.logo_url')}
                            </Label>
                            <Input
                                id="logo_url"
                                type="url"
                                value={data.logo_url}
                                onChange={(e) =>
                                    setData('logo_url', e.target.value)
                                }
                                placeholder={t(
                                    'admin.developers.form.logo_url_placeholder',
                                )}
                                disabled={saving}
                                aria-invalid={!!errors.logo_url}
                                aria-describedby={
                                    errors.logo_url
                                        ? 'logo-url-error'
                                        : undefined
                                }
                            />
                            <InputError
                                id="logo-url-error"
                                message={errors.logo_url}
                            />
                        </div>

                        <Button type="submit" disabled={saving}>
                            {t('admin.developers.form.submit_update')}
                        </Button>
                    </form>

                    <div className="space-y-6">
                        <Panel title={t('admin.developers.edit.title')}>
                            <dl className="grid gap-4">
                                <MetaRow
                                    label={t('admin.developers.edit.meta.slug')}
                                    value={developer.slug}
                                    monospace
                                />
                                <MetaRow
                                    label={t(
                                        'admin.developers.edit.meta.games_count',
                                    )}
                                    value={String(developer.games_count)}
                                />
                                <MetaRow
                                    label={t(
                                        'admin.developers.edit.meta.created_at',
                                    )}
                                    value={
                                        developer.created_at
                                            ? new Date(
                                                  developer.created_at,
                                              ).toLocaleString()
                                            : '-'
                                    }
                                />
                                <MetaRow
                                    label={t(
                                        'admin.developers.edit.meta.updated_at',
                                    )}
                                    value={
                                        developer.updated_at
                                            ? new Date(
                                                  developer.updated_at,
                                              ).toLocaleString()
                                            : '-'
                                    }
                                />
                            </dl>
                        </Panel>

                        <OwnershipPanel
                            developer={developer}
                            candidates={reassign_candidates}
                        />

                        <DangerZone developer={developer} />
                    </div>
                </div>
            </div>
        </>
    );
}

AdminDevelopersEdit.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);

// ── Ownership (reassign / clear) ────────────────────────────────────

function OwnershipPanel({
    developer,
    candidates,
}: {
    developer: AdminDeveloperDetail;
    candidates: AdminDeveloperReassignUserOption[];
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [selected, setSelected] = useState<string>(
        developer.owner?.id ? String(developer.owner.id) : 'none',
    );

    const processing = submitting;

    const hasChange = useMemo(() => {
        const currentId = developer.owner?.id ?? null;
        const nextId = selected === 'none' ? null : Number(selected);
        return currentId !== nextId;
    }, [developer.owner, selected]);

    const handleSubmit = (): void => {
        const nextId = selected === 'none' ? null : Number(selected);
        setSubmitting(true);
        setError(undefined);
        router.post(
            devRoutes.reassign(developer.slug).url,
            { user_id: nextId },
            {
                preserveScroll: true,
                onError: (errs) => {
                    setError(errs.user_id);
                },
                onFinish: () => setSubmitting(false),
                onSuccess: () => setOpen(false),
            },
        );
    };

    return (
        <Panel
            title={t('admin.developers.edit.ownership.title')}
            tone="primary"
        >
            {developer.owner ? (
                <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-sm font-medium">
                        {developer.owner.name}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                        {developer.owner.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        @{developer.owner.username}
                    </p>
                </div>
            ) : (
                <p className="rounded-lg border border-dashed border-border bg-muted/10 p-3 text-sm text-muted-foreground">
                    {t('admin.developers.edit.ownership.no_owner')}
                </p>
            )}

            <ActionRow
                title={t('admin.developers.edit.ownership.reassign.title')}
                description={t(
                    'admin.developers.edit.ownership.reassign.description',
                )}
                action={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelected(
                                developer.owner?.id
                                    ? String(developer.owner.id)
                                    : 'none',
                            );
                            setOpen(true);
                        }}
                        className="gap-2"
                        disabled={processing}
                    >
                        <UserCog className="size-4" aria-hidden />
                        {t('admin.developers.edit.ownership.reassign.cta')}
                    </Button>
                }
            />

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
                                'admin.developers.edit.ownership.reassign.dialog_title',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'admin.developers.edit.ownership.reassign.dialog_body',
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="reassign-user">
                            {t(
                                'admin.developers.edit.ownership.reassign.owner_label',
                            )}
                        </Label>
                        <Select value={selected} onValueChange={setSelected}>
                            <SelectTrigger id="reassign-user">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    {t(
                                        'admin.developers.edit.ownership.reassign.none_option',
                                    )}
                                </SelectItem>
                                {candidates.map((user) => (
                                    <SelectItem
                                        key={user.id}
                                        value={String(user.id)}
                                    >
                                        {user.name}{' '}
                                        <span className="text-muted-foreground">
                                            ({user.email})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={error} />
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
                            onClick={handleSubmit}
                            disabled={!hasChange || processing}
                        >
                            {t(
                                'admin.developers.edit.ownership.reassign.confirm',
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Panel>
    );
}

// ── Delete action ───────────────────────────────────────────────────

function DangerZone({ developer }: { developer: AdminDeveloperDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const { delete: destroy, processing } = useForm({});

    const hasGames = developer.games_count > 0;
    const canDelete = confirmation === developer.slug;

    const handleDelete = (): void => {
        if (!canDelete) return;
        destroy(devRoutes.destroy(developer.slug).url, {
            preserveScroll: false,
        });
    };

    return (
        <Panel title={t('admin.developers.edit.danger.title')} tone="danger">
            <ActionRow
                title={t('admin.developers.edit.danger.delete.title')}
                description={t(
                    'admin.developers.edit.danger.delete.description',
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
                        {t('admin.developers.edit.danger.delete.cta')}
                    </Button>
                }
            />

            {hasGames && (
                <Alert variant="default" className="border-destructive/40">
                    <AlertTriangle className="size-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                        {t('admin.developers.edit.danger.delete.has_games', {
                            count: String(developer.games_count),
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
                                'admin.developers.edit.danger.delete.confirm_title',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'admin.developers.edit.danger.delete.confirm_body',
                                { slug: developer.slug },
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
                                'admin.developers.edit.danger.delete.warning_title',
                            )}
                        </AlertTitle>
                        <AlertDescription>
                            {t(
                                'admin.developers.edit.danger.delete.warning_body',
                            )}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="dev-delete-confirm">
                            {t(
                                'admin.developers.edit.danger.delete.confirm_label',
                                { slug: developer.slug },
                            )}
                        </Label>
                        <Input
                            id="dev-delete-confirm"
                            type="text"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            className="font-mono text-sm"
                            disabled={processing}
                        />
                        <InputError
                            message={
                                confirmation.length > 0 && !canDelete
                                    ? t(
                                          'admin.developers.edit.danger.delete.mismatch',
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
                            {t('admin.developers.edit.danger.delete.cta')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Panel>
    );
}
