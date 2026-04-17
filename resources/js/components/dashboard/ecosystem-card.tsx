import { Link } from '@inertiajs/react';
import { ArrowRight, Code2, Fingerprint, Shield } from 'lucide-react';
import { CopyButton } from '@/components/developers/copy-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard as adminDashboard } from '@/routes/admin';
import { dashboard as developersDashboard } from '@/routes/developers';

type Props = {
    voutId: string;
    isDeveloper: boolean;
    isAdmin: boolean;
    developerAppsCount: number | null;
};

function truncateId(id: string): string {
    if (id.length <= 12) {
        return id;
    }
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function EcosystemCard({
    voutId,
    isDeveloper,
    isAdmin,
    developerAppsCount,
}: Props) {
    const { t } = useTranslation();
    const hasRole = isDeveloper || isAdmin;

    return (
        <section
            id="dashboard-ecosystem"
            aria-labelledby="dashboard-ecosystem-title"
            className="rounded-xl border bg-card p-5 shadow-sm"
        >
            <div className="space-y-1">
                <h2
                    id="dashboard-ecosystem-title"
                    className="text-sm font-semibold text-muted-foreground"
                >
                    {t('dashboard.ecosystem.title')}
                </h2>
                <p className="text-xs text-muted-foreground/80">
                    {t('dashboard.ecosystem.subtitle')}
                </p>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                    aria-hidden="true"
                >
                    <Fingerprint className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                        {t('dashboard.ecosystem.vout_id.label')}
                    </div>
                    <div
                        className="truncate font-mono text-sm font-medium"
                        title={voutId}
                    >
                        <span aria-hidden="true">{truncateId(voutId)}</span>
                        <span className="sr-only">{voutId}</span>
                    </div>
                </div>
                <CopyButton
                    value={voutId}
                    variant="ghost"
                    size="icon"
                    ariaLabel={t('dashboard.ecosystem.vout_id.copy')}
                />
            </div>

            {hasRole && (
                <div className="mt-4 space-y-2">
                    {isDeveloper && (
                        <RoleLink
                            icon={
                                <Code2
                                    className="size-4 text-primary"
                                    aria-hidden="true"
                                />
                            }
                            badge={t('dashboard.ecosystem.developer.badge')}
                            label={t('dashboard.ecosystem.developer.cta')}
                            helper={
                                developerAppsCount !== null
                                    ? t(
                                          'dashboard.ecosystem.developer.apps_count',
                                          {
                                              count: developerAppsCount,
                                          },
                                      )
                                    : null
                            }
                            href={developersDashboard.url()}
                        />
                    )}
                    {isAdmin && (
                        <RoleLink
                            icon={
                                <Shield
                                    className="size-4 text-primary"
                                    aria-hidden="true"
                                />
                            }
                            badge={t('dashboard.ecosystem.admin.badge')}
                            label={t('dashboard.ecosystem.admin.cta')}
                            helper={t('dashboard.ecosystem.admin.description')}
                            href={adminDashboard.url()}
                        />
                    )}
                </div>
            )}

            {!hasRole && (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    {t('dashboard.ecosystem.neutral.copy')}
                </p>
            )}
        </section>
    );
}

type RoleLinkProps = {
    icon: React.ReactNode;
    badge: string;
    label: string;
    helper: string | null;
    href: string;
};

function RoleLink({ icon, badge, label, helper, href }: RoleLinkProps) {
    return (
        <Button
            asChild
            variant="ghost"
            className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left"
        >
            <Link href={href}>
                <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                    aria-hidden="true"
                >
                    {icon}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                            {badge}
                        </Badge>
                        <span className="text-sm font-medium">{label}</span>
                    </div>
                    {helper && (
                        <p className="text-xs text-muted-foreground">
                            {helper}
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
