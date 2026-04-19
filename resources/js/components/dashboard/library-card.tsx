import { Link } from '@inertiajs/react';
import { ArrowRight, Bookmark, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import {
    favorites as libraryFavorites,
    saved as librarySaved,
} from '@/routes/library';

export type DashboardLibrary = {
    favorites: number;
    saved: number;
};

type Props = {
    library: DashboardLibrary;
};

export function LibraryCard({ library }: Props) {
    const { t, locale } = useTranslation();

    return (
        <section
            id="dashboard-library"
            aria-labelledby="dashboard-library-title"
            className="rounded-xl border bg-card p-5 shadow-sm"
        >
            <div className="space-y-1">
                <h2
                    id="dashboard-library-title"
                    className="text-sm font-semibold text-muted-foreground"
                >
                    {t('dashboard.library.title')}
                </h2>
                <p className="text-xs text-muted-foreground/80">
                    {t('dashboard.library.subtitle')}
                </p>
            </div>

            <div className="mt-4 space-y-2">
                <LibraryLink
                    icon={Heart}
                    label={t('library.favorites.title')}
                    count={library.favorites}
                    href={libraryFavorites.url()}
                    emptyHint={t('dashboard.library.favorites.empty')}
                    locale={locale}
                />
                <LibraryLink
                    icon={Bookmark}
                    label={t('library.saved.title')}
                    count={library.saved}
                    href={librarySaved.url()}
                    emptyHint={t('dashboard.library.saved.empty')}
                    locale={locale}
                />
            </div>
        </section>
    );
}

type LibraryLinkProps = {
    icon: LucideIcon;
    label: string;
    count: number;
    href: string;
    emptyHint: string;
    locale: string;
};

function LibraryLink({
    icon: Icon,
    label,
    count,
    href,
    emptyHint,
    locale,
}: LibraryLinkProps) {
    return (
        <Button
            asChild
            variant="ghost"
            className="h-auto w-full justify-start gap-3 px-3 py-3 text-left whitespace-normal"
        >
            <Link href={href} prefetch>
                <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                    aria-hidden="true"
                >
                    <Icon className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                            {count.toLocaleString(locale)}
                        </span>
                    </div>
                    {count === 0 && (
                        <p className="text-xs text-muted-foreground">
                            {emptyHint}
                        </p>
                    )}
                </div>
                <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
            </Link>
        </Button>
    );
}
