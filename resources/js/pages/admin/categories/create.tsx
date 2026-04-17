import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';

const { categories: catRoutes } = admin;

export default function AdminCategoriesCreate() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({ name: '' });

    const handleSubmit = (e: FormEvent): void => {
        e.preventDefault();
        post(catRoutes.store().url);
    };

    return (
        <>
            <Head title={t('admin.categories.create.title')} />

            <div className="space-y-6">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-8 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                >
                    <Link href={catRoutes.index().url} prefetch>
                        <ArrowLeft className="size-4" aria-hidden />
                        {t('admin.categories.create.back')}
                    </Link>
                </Button>

                <header>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('admin.categories.create.title')}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('admin.categories.create.description')}
                    </p>
                </header>

                <form
                    onSubmit={handleSubmit}
                    className="max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            {t('admin.categories.form.name')}
                        </Label>
                        <Input
                            id="name"
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder={t(
                                'admin.categories.form.name_placeholder',
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

                    <Button type="submit" disabled={processing}>
                        {t('admin.categories.form.submit_create')}
                    </Button>
                </form>
            </div>
        </>
    );
}

AdminCategoriesCreate.layout = (page: ReactNode) => (
    <AdminLayout>{page}</AdminLayout>
);
