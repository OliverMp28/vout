import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { GameForm } from '@/components/developers/games/game-form';
import { GameStatusBadge } from '@/components/developers/games/status-badge';
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
import DevelopersLayout from '@/layouts/developers-layout';
import developers from '@/routes/developers';
import type {
    DeveloperGameDetailResource,
    DevelopersGameShowProps,
    GameFormData,
} from '@/types';

const { games: gamesRoutes } = developers;

/**
 * Detalle del juego desde el punto de vista del dev (Fase 4.2, S1).
 *
 * Sin pestañas: el formulario de edición vive en la misma página porque
 * un dev sólo realiza dos operaciones sobre su juego — actualizar campos
 * y eliminarlo. Si el estado es `Published`, el form queda deshabilitado
 * (policy `update` ya devuelve 403) pero la UI lo comunica antes.
 */
export default function DevelopersGamesShow({
    game,
    apps,
    categories,
    developers: developerOptions,
}: DevelopersGameShowProps) {
    const { t } = useTranslation();

    const { data, setData, put, processing, errors, reset } =
        useForm<GameFormData>(toFormData(game));

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        put(gamesRoutes.update(game.slug).url, { preserveScroll: true });
    };

    return (
        <>
            <Head title={game.name} />

            <div className="space-y-8">
                <header className="space-y-4">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={gamesRoutes.index().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.games.show.back')}
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                                    {game.name}
                                </h1>
                                <GameStatusBadge status={game.status} />
                            </div>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                                {game.slug}
                            </p>
                        </div>
                    </div>
                </header>

                {game.status === 'rejected' && (
                    <Alert variant="default" className="border-destructive/40">
                        <AlertTriangle className="size-4 text-destructive" />
                        <AlertTitle>
                            {t('developers.games.show.rejected.title')}
                        </AlertTitle>
                        <AlertDescription className="space-y-1">
                            {game.rejection_reason && (
                                <p className="font-medium">
                                    {game.rejection_reason}
                                </p>
                            )}
                            <p>{t('developers.games.show.rejected.body')}</p>
                        </AlertDescription>
                    </Alert>
                )}

                <GameForm
                    mode="edit"
                    data={data}
                    errors={errors as Record<string, string>}
                    processing={processing}
                    apps={apps}
                    categories={categories}
                    developers={developerOptions}
                    onChange={(key, value) =>
                        setData((prev) => ({ ...prev, [key]: value }))
                    }
                    onSubmit={handleSubmit}
                    onReset={() => reset()}
                    submitLabel={t('developers.games.form.submit_update')}
                    disabled={!game.is_editable}
                />

                <DangerZone game={game} />
            </div>
        </>
    );
}

DevelopersGamesShow.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);

function toFormData(game: DeveloperGameDetailResource): GameFormData {
    return {
        name: game.name,
        description: game.description,
        registered_app_id: game.registered_app_id,
        embed_url: game.embed_url ?? '',
        cover_image: game.cover_image ?? '',
        release_date: game.release_date ?? '',
        repo_url: game.repo_url ?? '',
        category_ids: [...game.category_ids],
        developer_ids: [...game.developer_ids],
    };
}

type DangerZoneProps = {
    game: DeveloperGameDetailResource;
};

function DangerZone({ game }: DangerZoneProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');

    const { delete: destroy, processing } = useForm({});

    const canDelete = confirmation === game.slug && game.is_deletable;

    const handleDelete = (): void => {
        if (!canDelete) {
            return;
        }
        destroy(gamesRoutes.destroy(game.slug).url, { preserveScroll: false });
    };

    return (
        <section className="space-y-4 rounded-2xl border border-destructive/30 bg-card p-6 shadow-sm">
            <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-destructive">
                    {t('developers.games.show.danger.heading')}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t('developers.games.show.danger.description')}
                </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-semibold tracking-tight">
                        {t('developers.games.show.danger.delete.title')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {game.is_deletable
                            ? t(
                                  'developers.games.show.danger.delete.description',
                              )
                            : t(
                                  'developers.games.show.danger.not_deletable',
                              )}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                        setConfirmation('');
                        setOpen(true);
                    }}
                    disabled={!game.is_deletable || processing}
                    className="gap-2"
                >
                    <Trash2 className="size-4" aria-hidden />
                    {t('developers.games.show.danger.delete.cta')}
                </Button>
            </div>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!processing) {
                        setOpen(next);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'developers.games.show.danger.delete.confirm_title',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'developers.games.show.danger.delete.confirm_body',
                                { slug: game.slug },
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <Alert variant="default" className="border-destructive/40">
                        <AlertTriangle className="size-4 text-destructive" />
                        <AlertTitle>
                            {t(
                                'developers.games.show.danger.delete.warning_title',
                            )}
                        </AlertTitle>
                        <AlertDescription>
                            {t(
                                'developers.games.show.danger.delete.warning_body',
                            )}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="game-delete-confirm">
                            {t(
                                'developers.games.show.danger.delete.confirm_label',
                                { slug: game.slug },
                            )}
                        </Label>
                        <Input
                            id="game-delete-confirm"
                            type="text"
                            value={confirmation}
                            onChange={(event) =>
                                setConfirmation(event.target.value)
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
                                          'developers.games.show.danger.delete.mismatch',
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
                            {t('developers.form.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!canDelete || processing}
                            className="gap-2"
                        >
                            <Trash2 className="size-4" aria-hidden />
                            {t(
                                'developers.games.show.danger.delete.cta',
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
