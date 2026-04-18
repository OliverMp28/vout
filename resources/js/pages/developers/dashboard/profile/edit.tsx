import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    ExternalLink,
    Gamepad2,
    Image as ImageIcon,
    Link2,
    Sparkles,
    UserRoundPlus,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { MetaRow, Panel } from '@/components/admin/panel';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import DevelopersLayout from '@/layouts/developers-layout';
import { cn } from '@/lib/utils';
import developers from '@/routes/developers';
import type {
    DeveloperProfileFormData,
    DevelopersProfileEditProps,
} from '@/types';

const { profile: profileRoutes } = developers;

const BIO_MAX = 500;

/**
 * Ficha pública del dev (Fase 4.2, S4.5).
 *
 * La misma pantalla sirve para claim inicial y para edición posterior.
 * Si `profile === null`, el submit dispara POST (alta); si existe, PUT.
 */
export default function DevelopersProfileEdit({
    profile,
}: DevelopersProfileEditProps) {
    const { t } = useTranslation();
    const isClaimed = profile !== null;

    const { data, setData, post, put, processing, errors } =
        useForm<DeveloperProfileFormData>({
            name: profile?.name ?? '',
            website_url: profile?.website_url ?? '',
            bio: profile?.bio ?? '',
            logo_url: profile?.logo_url ?? '',
        });

    const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        if (isClaimed) {
            put(profileRoutes.update().url, { preserveScroll: true });
        } else {
            post(profileRoutes.store().url, { preserveScroll: true });
        }
    };

    const bioLength = data.bio.length;
    const bioOver = bioLength > BIO_MAX;

    return (
        <>
            <Head title={t('developers.profile.edit.title')} />

            <div className="space-y-8">
                <header className="space-y-3">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Link href={developers.dashboard().url} prefetch>
                            <ArrowLeft className="size-4" aria-hidden />
                            {t('developers.profile.edit.back')}
                        </Link>
                    </Button>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                                    {isClaimed
                                        ? t('developers.profile.edit.title')
                                        : t('developers.profile.claim.title')}
                                </h1>
                                {isClaimed && (
                                    <Badge
                                        variant="secondary"
                                        className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                                    >
                                        <BadgeCheck
                                            className="size-3"
                                            aria-hidden
                                        />
                                        {t('developers.profile.claimed_badge')}
                                    </Badge>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {isClaimed
                                    ? t('developers.profile.edit.description')
                                    : t('developers.profile.claim.description')}
                            </p>
                        </div>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        className="space-y-6"
                    >
                        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
                            <div className="space-y-1">
                                <h2 className="text-base font-semibold tracking-tight">
                                    {t(
                                        'developers.profile.form.section.identity.title',
                                    )}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {t(
                                        'developers.profile.form.section.identity.description',
                                    )}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="profile-name">
                                    {t('developers.profile.form.name.label')}
                                </Label>
                                <Input
                                    id="profile-name"
                                    type="text"
                                    value={data.name}
                                    onChange={(event) =>
                                        setData('name', event.target.value)
                                    }
                                    autoComplete="off"
                                    maxLength={150}
                                    required
                                    disabled={processing}
                                    autoFocus={!isClaimed}
                                    placeholder={t(
                                        'developers.profile.form.name.placeholder',
                                    )}
                                    aria-invalid={
                                        errors.name !== undefined || undefined
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('developers.profile.form.name.hint')}
                                </p>
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="profile-bio">
                                    {t('developers.profile.form.bio.label')}
                                </Label>
                                <Textarea
                                    id="profile-bio"
                                    value={data.bio}
                                    onChange={(event) =>
                                        setData('bio', event.target.value)
                                    }
                                    rows={4}
                                    maxLength={BIO_MAX}
                                    disabled={processing}
                                    placeholder={t(
                                        'developers.profile.form.bio.placeholder',
                                    )}
                                    aria-invalid={
                                        errors.bio !== undefined || undefined
                                    }
                                    aria-describedby="profile-bio-counter"
                                />
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        {t('developers.profile.form.bio.hint')}
                                    </span>
                                    <span
                                        id="profile-bio-counter"
                                        className={cn(
                                            'tabular-nums',
                                            bioOver
                                                ? 'text-destructive'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {bioLength}/{BIO_MAX}
                                    </span>
                                </div>
                                <InputError message={errors.bio} />
                            </div>
                        </section>

                        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
                            <div className="space-y-1">
                                <h2 className="text-base font-semibold tracking-tight">
                                    {t(
                                        'developers.profile.form.section.links.title',
                                    )}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {t(
                                        'developers.profile.form.section.links.description',
                                    )}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="profile-website">
                                    {t(
                                        'developers.profile.form.website_url.label',
                                    )}
                                </Label>
                                <Input
                                    id="profile-website"
                                    type="url"
                                    inputMode="url"
                                    value={data.website_url}
                                    onChange={(event) =>
                                        setData(
                                            'website_url',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    maxLength={500}
                                    disabled={processing}
                                    placeholder="https://mi-estudio.com"
                                    className="font-mono text-sm"
                                    aria-invalid={
                                        errors.website_url !== undefined ||
                                        undefined
                                    }
                                />
                                <InputError message={errors.website_url} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="profile-logo">
                                    {t(
                                        'developers.profile.form.logo_url.label',
                                    )}
                                </Label>
                                <Input
                                    id="profile-logo"
                                    type="url"
                                    inputMode="url"
                                    value={data.logo_url}
                                    onChange={(event) =>
                                        setData('logo_url', event.target.value)
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    maxLength={500}
                                    disabled={processing}
                                    placeholder="https://cdn.mi-estudio.com/logo.png"
                                    className="font-mono text-sm"
                                    aria-invalid={
                                        errors.logo_url !== undefined ||
                                        undefined
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('developers.profile.form.logo_url.hint')}
                                </p>
                                <InputError message={errors.logo_url} />
                            </div>
                        </section>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={processing}>
                                {processing
                                    ? t('developers.form.submitting')
                                    : isClaimed
                                      ? t(
                                            'developers.profile.form.submit_update',
                                        )
                                      : t(
                                            'developers.profile.form.submit_claim',
                                        )}
                            </Button>
                        </div>
                    </form>

                    <aside className="h-fit space-y-6">
                        <PreviewCard
                            name={data.name}
                            bio={data.bio}
                            website={data.website_url}
                            logo={data.logo_url}
                        />

                        {isClaimed && profile && (
                            <Panel title={t('developers.profile.meta.title')}>
                                <dl className="grid gap-4">
                                    <MetaRow
                                        label={t(
                                            'developers.profile.meta.slug',
                                        )}
                                        value={profile.slug}
                                        monospace
                                    />
                                    <MetaRow
                                        label={t(
                                            'developers.profile.meta.games_count',
                                        )}
                                        value={String(profile.games_count)}
                                    />
                                    {profile.updated_at && (
                                        <MetaRow
                                            label={t(
                                                'developers.profile.meta.updated_at',
                                            )}
                                            value={new Date(
                                                profile.updated_at,
                                            ).toLocaleString()}
                                        />
                                    )}
                                </dl>
                                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                                    <p className="text-xs font-medium">
                                        {t(
                                            'developers.profile.admin_hint.title',
                                        )}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {t(
                                            'developers.profile.admin_hint.description',
                                        )}
                                    </p>
                                </div>
                            </Panel>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

DevelopersProfileEdit.layout = (page: ReactNode) => (
    <DevelopersLayout>{page}</DevelopersLayout>
);

// ── Preview card ────────────────────────────────────────────────────

type PreviewCardProps = {
    name: string;
    bio: string;
    website: string;
    logo: string;
};

function PreviewCard({ name, bio, website, logo }: PreviewCardProps) {
    const { t } = useTranslation();
    const displayName =
        name.trim() || t('developers.profile.preview.placeholder_name');
    const displayBio =
        bio.trim() || t('developers.profile.preview.placeholder_bio');
    const hostname = safeHostname(website);

    return (
        <Panel title={t('developers.profile.preview.title')} tone="primary">
            <p className="text-xs text-muted-foreground">
                {t('developers.profile.preview.description')}
            </p>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {logo ? (
                        <img
                            src={logo}
                            alt=""
                            className="size-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : (
                        <ImageIcon
                            className="size-5 text-muted-foreground/60"
                            aria-hidden
                        />
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-semibold tracking-tight">
                        {displayName}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                        {displayBio}
                    </p>
                    {hostname && (
                        <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                            <Link2 className="size-3" aria-hidden />
                            {hostname}
                            <ExternalLink className="size-3" aria-hidden />
                        </a>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" aria-hidden />
                <span>{t('developers.profile.preview.auto_attach')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gamepad2 className="size-3.5" aria-hidden />
                <span>{t('developers.profile.preview.catalog_hint')}</span>
            </div>
            {!name && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRoundPlus className="size-3.5" aria-hidden />
                    <span>{t('developers.profile.preview.claim_hint')}</span>
                </div>
            )}
        </Panel>
    );
}

function safeHostname(url: string): string | null {
    if (url.trim() === '') {
        return null;
    }
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}
