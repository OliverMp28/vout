import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';

const { developers: devRoutes } = admin;

export default function AdminDevelopersCreate() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        website_url: '',
        bio: '',
        logo_url: '',
    });

    const handleSubmit = (e: FormEvent): void => {
        e.preventDefault();
        post(devRoutes.store().url);
    };

    return (
        <>
            <Head title={t('admin.developers.create.title')} />

            <div className="space-y-6">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <Link href={devRoutes.index().url} prefetch>
                        <ArrowLeft className="size-4" aria-hidden />
                        {t('admin.developers.create.back')}
                    </Link>
                </Button>

                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('admin.developers.create.title')}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('admin.developers.create.description')}
                    </p>
                </header>

                <form
                    onSubmit={handleSubmit}
                    className="max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            {t('admin.developers.form.name')}
                        </Label>
                        <Input
                            id="name"
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder={t(
                                'admin.developers.form.name_placeholder',
                            )}
                            disabled={processing}
                            autoFocus
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
                            disabled={processing}
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
                            disabled={processing}
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
                            disabled={processing}
                            aria-invalid={!!errors.logo_url}
                            aria-describedby={
                                errors.logo_url ? 'logo-url-error' : undefined
                            }
                        />
                        <InputError
                            id="logo-url-error"
                            message={errors.logo_url}
                        />
                    </div>

                    <Button type="submit" disabled={processing}>
                        {t('admin.developers.form.submit_create')}
                    </Button>
                </form>
            </div>
        </>
    );
}

AdminDevelopersCreate.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);
