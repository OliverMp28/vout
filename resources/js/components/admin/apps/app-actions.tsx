import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Ban,
    CheckCircle2,
    Crown,
    Play,
    Trash2,
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
import type { AdminAppDetail } from '@/types';

const { apps: appsRoutes } = admin;

// ── First Party ──────────────────────────────────────────────────────

export function FirstPartyAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const { post, processing } = useForm({});

    const handleToggle = (): void => {
        post(appsRoutes.firstParty(app.slug).url, {
            preserveScroll: true,
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.first_party.title')}
            description={t('admin.apps.show.actions.first_party.description')}
            action={
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={processing}
                    className="gap-2"
                >
                    <Crown
                        className={cn(
                            'size-4',
                            app.is_first_party && 'text-amber-500',
                        )}
                        aria-hidden
                    />
                    {app.is_first_party
                        ? t('admin.apps.show.actions.first_party.remove')
                        : t('admin.apps.show.actions.first_party.mark')}
                </Button>
            }
        />
    );
}

// ── Suspend ──────────────────────────────────────────────────────────

export function SuspendAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        remark: '',
    });

    const handleSuspend = (): void => {
        post(appsRoutes.suspend(app.slug).url, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.suspend.title')}
            description={t('admin.apps.show.actions.suspend.description')}
            action={
                <>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            reset();
                            setOpen(true);
                        }}
                        className="gap-2"
                    >
                        <Ban className="size-4" aria-hidden />
                        {t('admin.apps.show.actions.suspend.cta')}
                    </Button>

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
                                        'admin.apps.show.actions.suspend.confirm_title',
                                        { name: app.name },
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.apps.show.actions.suspend.confirm_body',
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
                                        'admin.apps.show.actions.suspend.warning_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.apps.show.actions.suspend.warning_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="suspend-remark">
                                    {t(
                                        'admin.apps.show.actions.suspend.remark_label',
                                    )}
                                </Label>
                                <Textarea
                                    id="suspend-remark"
                                    value={data.remark}
                                    onChange={(e) =>
                                        setData('remark', e.target.value)
                                    }
                                    placeholder={t(
                                        'admin.apps.show.actions.suspend.remark_placeholder',
                                    )}
                                    rows={3}
                                    disabled={processing}
                                />
                                <InputError message={errors.remark} />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    disabled={processing}
                                >
                                    {t('admin.apps.show.actions.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleSuspend}
                                    disabled={
                                        processing || data.remark.length < 10
                                    }
                                    className="gap-2"
                                >
                                    <Ban className="size-4" aria-hidden />
                                    {t('admin.apps.show.actions.suspend.cta')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            }
        />
    );
}

// ── Reactivate ───────────────────────────────────────────────────────

export function ReactivateAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const { post, processing } = useForm({});

    const handleReactivate = (): void => {
        post(appsRoutes.reactivate(app.slug).url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.reactivate.title')}
            description={t('admin.apps.show.actions.reactivate.description')}
            action={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(true)}
                        className="gap-2"
                    >
                        <Play className="size-4" aria-hidden />
                        {t('admin.apps.show.actions.reactivate.cta')}
                    </Button>

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
                                        'admin.apps.show.actions.reactivate.confirm_title',
                                        { name: app.name },
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.apps.show.actions.reactivate.confirm_body',
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <Alert
                                variant="default"
                                className="border-amber-500/40"
                            >
                                <CheckCircle2 className="size-4 text-amber-500" />
                                <AlertTitle>
                                    {t(
                                        'admin.apps.show.actions.reactivate.note_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.apps.show.actions.reactivate.note_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    disabled={processing}
                                >
                                    {t('admin.apps.show.actions.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleReactivate}
                                    disabled={processing}
                                    className="gap-2"
                                >
                                    <Play className="size-4" aria-hidden />
                                    {t(
                                        'admin.apps.show.actions.reactivate.cta',
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            }
        />
    );
}

// ── Delete ───────────────────────────────────────────────────────────

export function DeleteAction({ app }: { app: AdminAppDetail }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');

    const { delete: destroy, processing } = useForm({});

    const canDelete = confirmation === app.slug;

    const handleDelete = (): void => {
        if (!canDelete) return;

        destroy(appsRoutes.destroy(app.slug).url, {
            preserveScroll: false,
        });
    };

    return (
        <ActionRow
            title={t('admin.apps.show.actions.delete.title')}
            description={t('admin.apps.show.actions.delete.description')}
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
                        {t('admin.apps.show.actions.delete.cta')}
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
                                        'admin.apps.show.actions.delete.confirm_title',
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {t(
                                        'admin.apps.show.actions.delete.confirm_body',
                                        { slug: app.slug },
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
                                        'admin.apps.show.actions.delete.warning_title',
                                    )}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'admin.apps.show.actions.delete.warning_body',
                                    )}
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="delete-confirm">
                                    {t(
                                        'admin.apps.show.actions.delete.confirm_label',
                                        { slug: app.slug },
                                    )}
                                </Label>
                                <Input
                                    id="delete-confirm"
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
                                                  'admin.apps.show.actions.delete.mismatch',
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
                                    {t('admin.apps.show.actions.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={!canDelete || processing}
                                    className="gap-2"
                                >
                                    <Trash2 className="size-4" aria-hidden />
                                    {t('admin.apps.show.actions.delete.cta')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            }
        />
    );
}
