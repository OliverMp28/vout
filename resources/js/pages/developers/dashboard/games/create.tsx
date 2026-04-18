import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode, SubmitEvent } from 'react';
import { GameForm } from '@/components/developers/games/game-form';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import developers from '@/routes/developers';
import type { DevelopersGameCreateProps, GameFormData } from '@/types';

const { games: gamesRoutes } = developers;

const DEFAULT_FORM: GameFormData = {
    name: '',
    description: '',
    registered_app_id: null,
    embed_url: '',
    cover_image: '',
    release_date: '',
    repo_url: '',
    category_ids: [],
    developer_ids: [],
};

/**
 * Pantalla de envío de juegos (Fase 4.2, S1).
 *
 * El juego nace con `status = pending_review`. Si el dev no tiene apps
 * activas, el form advierte y deshabilita el submit para obligar a crear
 * una primero — el embed_url debe estar bajo sus allowed_origins.
 */
export default function DevelopersGamesCreate({
    apps,
    categories,
    developers: developerOptions,
    own_profile,
}: DevelopersGameCreateProps) {
    const { t } = useTranslation();

    const { data, setData, post, processing, errors, reset } =
        useForm<GameFormData>(DEFAULT_FORM);

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        post(gamesRoutes.store().url, { preserveScroll: true });
    };

    return (
        <>
            <Head title={t('developers.games.create.title')} />

            <div className="space-y-8">
                <header className="space-y-3">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={gamesRoutes.index().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.games.create.back')}
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            {t('developers.games.create.heading')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('developers.games.create.subheading')}
                        </p>
                    </div>
                </header>

                <GameForm
                    mode="create"
                    data={data}
                    errors={errors as Record<string, string>}
                    processing={processing}
                    apps={apps}
                    categories={categories}
                    developers={developerOptions}
                    ownProfile={own_profile}
                    onChange={(key, value) =>
                        setData((prev) => ({ ...prev, [key]: value }))
                    }
                    onSubmit={handleSubmit}
                    onReset={() => reset()}
                    submitLabel={t('developers.games.form.submit_create')}
                />
            </div>
        </>
    );
}

DevelopersGamesCreate.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);
