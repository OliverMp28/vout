import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Sparkles,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { ActionRow } from '@/components/admin/panel';
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
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import admin from '@/routes/admin';
import type { AdminGameDetail } from '@/types';

const { games: gamesRoutes } = admin;

// ── Approve ──────────────────────────────────────────────────────────

export function ApproveAction({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { post, processing } = useForm({});

    const handleApprove = (): void => {
        post(gamesRoutes.approve(game.slug).url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <>
            <Button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full gap-2"
            >
                <CheckCircle2 className="size-4" aria-hidden />
                {t('admin.games.show.review.approve_cta')}
            </Button>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!processing) setOpen(next);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('admin.games.show.review.approve_title', {
                                name: game.name,
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {t('admin.games.show.review.approve_body')}
                        </DialogDescription>
                    </DialogHeader>
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
                            onClick={handleApprove}
                            disabled={processing}
                            className="gap-2"
                        >
                            <CheckCircle2 className="size-4" aria-hidden />
                            {t('admin.games.show.review.approve_cta')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Reject ───────────────────────────────────────────────────────────

export function RejectAction({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        reason: '',
    });

    const handleReject = (): void => {
        post(gamesRoutes.reject(game.slug).url, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <>
            <Button
                type="button"
                variant="destructive"
                onClick={() => {
                    reset();
                    setOpen(true);
                }}
                className="w-full gap-2"
            >
                <XCircle className="size-4" aria-hidden />
                {t('admin.games.show.review.reject_cta')}
            </Button>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!processing) setOpen(next);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('admin.games.show.review.reject_title', {
                                name: game.name,
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {t('admin.games.show.review.reject_body')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="reject-reason">
                            {t('admin.games.show.review.reason_label')}
                        </Label>
                        <Textarea
                            id="reject-reason"
                            value={data.reason}
                            onChange={(e) => setData('reason', e.target.value)}
                            placeholder={t(
                                'admin.games.show.review.reason_placeholder',
                            )}
                            rows={3}
                            disabled={processing}
                        />
                        <InputError message={errors.reason} />
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
                            onClick={handleReject}
                            disabled={processing || data.reason.length < 10}
                            className="gap-2"
                        >
                            <XCircle className="size-4" aria-hidden />
                            {t('admin.games.show.review.reject_cta')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Featured ─────────────────────────────────────────────────────────

export function FeaturedAction({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();
    const { post, processing } = useForm({});

    const handleToggle = (): void => {
        post(gamesRoutes.featured(game.slug).url, {
            preserveScroll: true,
        });
    };

    return (
        <ActionRow
            title={t('admin.games.show.actions.featured.title')}
            description={t('admin.games.show.actions.featured.description')}
            action={
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={processing}
                    className="gap-2"
                >
                    <Sparkles
                        className={cn(
                            'size-4',
                            game.is_featured && 'text-amber-500',
                        )}
                        aria-hidden
                    />
                    {game.is_featured
                        ? t('admin.games.show.actions.featured.remove')
                        : t('admin.games.show.actions.featured.mark')}
                </Button>
            }
        />
    );
}

// ── Delete ───────────────────────────────────────────────────────────

export function DeleteAction({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const { delete: destroy, processing } = useForm({});

    const canDelete = confirmation === game.slug;

    const handleDelete = (): void => {
        if (!canDelete) return;
        destroy(gamesRoutes.destroy(game.slug).url, {
            preserveScroll: false,
        });
    };

    return (
        <ActionRow
            title={t('admin.games.show.actions.delete.title')}
            description={t('admin.games.show.actions.delete.description')}
            action={
                <>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            setConfirmation('');
                            setOpen(true);
                        }}
                        disabled={processing}
                        className="gap-2"
                    >
                        <Trash2 className="size-4" aria-hidden />
                        {t('admin.games.show.actions.delete.cta')}
                    </Button>

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
                                        'admin.games.show.actions.delete.confirm_title',
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.games.show.actions.delete.confirm_body',
                                        { slug: game.slug },
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
                                        'admin.games.show.actions.delete.warning_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.games.show.actions.delete.warning_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="game-delete-confirm">
                                    {t(
                                        'admin.games.show.actions.delete.confirm_label',
                                        { slug: game.slug },
                                    )}
                                </Label>
                                <Input
                                    id="game-delete-confirm"
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
                                                  'admin.games.show.actions.delete.mismatch',
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
                                    {t('admin.games.show.actions.delete.cta')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            }
        />
    );
}
