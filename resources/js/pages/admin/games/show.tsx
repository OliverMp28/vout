import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ExternalLink,
    Sparkles,
    User,
    XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { EditPanel } from '@/components/admin/games/edit-panel';
import {
    ApproveAction,
    DeleteAction,
    FeaturedAction,
    RejectAction,
} from '@/components/admin/games/game-actions';
import { MetaRow, Panel } from '@/components/admin/panel';
import { GameStatusBadge } from '@/components/developers/games/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type { AdminGameCategory, AdminGameDetail } from '@/types';

const { games: gamesRoutes } = admin;

type Props = {
    game: AdminGameDetail;
    categories: AdminGameCategory[];
    developers: AdminGameCategory[];
};

export default function AdminGamesShow({
    game,
    categories,
    developers,
}: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={game.name} />

            <div className="space-y-6">
                <header className="space-y-4">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={gamesRoutes.index().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('admin.games.show.back')}
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                                    {game.name}
                                </h1>
                                <GameStatusBadge status={game.status} />
                                {game.is_featured && (
                                    <Sparkles
                                        className="size-4 text-amber-500"
                                        aria-label={t(
                                            'admin.games.badge.featured',
                                        )}
                                    />
                                )}
                            </div>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                                {game.slug}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                            {game.categories.map((cat) => (
                                <Badge
                                    key={cat.id}
                                    variant="secondary"
                                    className="text-[10px]"
                                >
                                    {cat.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </header>

                {game.status === 'rejected' && game.rejection_reason && (
                    <Alert variant="destructive" className="border-destructive/40">
                        <XCircle className="size-4" />
                        <AlertTitle>
                            {t('admin.games.show.rejected_banner.title')}
                        </AlertTitle>
                        <AlertDescription>
                            {game.rejection_reason}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <DetailsPanel game={game} />
                        <EditPanel
                            game={game}
                            categories={categories}
                            developers={developers}
                        />
                        {game.embed_url && <PreviewPanel game={game} />}
                    </div>
                    <div className="space-y-6">
                        <SubmitterPanel game={game} />
                        <ReviewPanel game={game} />
                        <ActionsPanel game={game} />
                    </div>
                </div>
            </div>
        </>
    );
}

AdminGamesShow.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);

// ── Info Panels ──────────────────────────────────────────────────────

function DetailsPanel({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.games.show.details.heading')}>
            <dl className="grid gap-4 sm:grid-cols-2">
                <MetaRow
                    label={t('admin.games.show.details.name')}
                    value={game.name}
                />
                <MetaRow
                    label={t('admin.games.show.details.slug')}
                    value={game.slug}
                    monospace
                />
                <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {t('admin.games.show.details.description')}
                    </dt>
                    <dd className="whitespace-pre-line text-sm">
                        {game.description}
                    </dd>
                </div>
                {game.embed_url && (
                    <div className="space-y-1 sm:col-span-2">
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {t('admin.games.show.details.embed_url')}
                        </dt>
                        <dd className="flex items-center gap-2 font-mono text-xs break-all">
                            {game.embed_url}
                            <a
                                href={game.embed_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <ExternalLink
                                    className="size-3.5"
                                    aria-hidden
                                />
                            </a>
                        </dd>
                    </div>
                )}
                {game.registered_app && (
                    <MetaRow
                        label={t('admin.games.show.details.app')}
                        value={game.registered_app.name}
                    />
                )}
                <MetaRow
                    label={t('admin.games.show.details.play_count')}
                    value={String(game.play_count)}
                />
                {game.release_date && (
                    <MetaRow
                        label={t('admin.games.show.details.release_date')}
                        value={game.release_date}
                    />
                )}
                <MetaRow
                    label={t('admin.games.show.details.created_at')}
                    value={
                        game.created_at
                            ? new Date(game.created_at).toLocaleString()
                            : '-'
                    }
                />
                <MetaRow
                    label={t('admin.games.show.details.updated_at')}
                    value={
                        game.updated_at
                            ? new Date(game.updated_at).toLocaleString()
                            : '-'
                    }
                />
            </dl>
        </Panel>
    );
}

function PreviewPanel({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.games.show.preview.heading')}>
            <div className="overflow-hidden rounded-lg border border-border">
                <iframe
                    src={game.embed_url ?? ''}
                    title={game.name}
                    className="aspect-video w-full"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                {t('admin.games.show.preview.hint')}
            </p>
        </Panel>
    );
}

function SubmitterPanel({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.games.show.submitter.heading')}>
            {game.submitter ? (
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User
                            className="size-5 text-muted-foreground"
                            aria-hidden
                        />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium">
                            {game.submitter.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {game.submitter.email}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                            @{game.submitter.username}
                        </p>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground italic">
                    {t('admin.games.show.submitter.seeded')}
                </p>
            )}
        </Panel>
    );
}

// ── Action Panels ────────────────────────────────────────────────────

function ReviewPanel({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();

    if (game.status !== 'pending_review') {
        return null;
    }

    return (
        <Panel title={t('admin.games.show.review.heading')} tone="primary">
            <p className="text-sm text-muted-foreground">
                {t('admin.games.show.review.description')}
            </p>
            <div className="flex flex-col gap-2">
                <ApproveAction game={game} />
                <RejectAction game={game} />
            </div>
        </Panel>
    );
}

function ActionsPanel({ game }: { game: AdminGameDetail }) {
    const { t } = useTranslation();

    return (
        <Panel title={t('admin.games.show.actions.heading')} tone="danger">
            <FeaturedAction game={game} />
            <DeleteAction game={game} />
        </Panel>
    );
}
