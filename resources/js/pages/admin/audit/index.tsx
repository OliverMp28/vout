import { Head, Link, router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RefreshCcw,
    ScrollText,
    UserRound,
    X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import AdminLayout from '@/layouts/admin-layout';
import admin from '@/routes/admin';
import type {
    AdminAuditAdminOption,
    AdminAuditFilters,
    AdminAuditLogEntry,
    AdminAuditLogs,
} from '@/types';

const { audit: auditRoutes } = admin;

type Props = {
    logs: AdminAuditLogs;
    filters: AdminAuditFilters;
    availableActions: string[];
    availableAdmins: AdminAuditAdminOption[];
    availableTypes: string[];
};

const ALL_VALUE = '__all__';

/**
 * Formatea un ISO date string a una representación localizada según el
 * locale activo del portal.
 */
function formatTimestamp(iso: string | null, locale: string): string {
    if (!iso) {
        return '—';
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function AdminAuditIndex({
    logs,
    filters,
    availableActions,
    availableAdmins,
    availableTypes,
}: Props) {
    const { t, locale } = useTranslation();
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const hasFilters = useMemo(
        () =>
            Boolean(
                filters.action ||
                filters.admin_id ||
                filters.auditable_type ||
                filters.from ||
                filters.to,
            ),
        [filters],
    );

    const pushFilters = (
        patch: Partial<Record<keyof AdminAuditFilters, string | number | null>>,
    ): void => {
        const next = { ...filters, ...patch };
        const query: Record<string, string> = {};

        (Object.keys(next) as Array<keyof AdminAuditFilters>).forEach((key) => {
            const value = next[key];
            if (value !== null && value !== undefined && value !== '') {
                query[key] = String(value);
            }
        });

        router.get(auditRoutes.index().url, query, {
            preserveState: true,
            replace: true,
            preserveScroll: true,
        });
    };

    const toggleExpanded = (id: number): void => {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    return (
        <>
            <Head title={t('admin.audit.index.title')} />

            <div className="space-y-6">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('admin.audit.index.title')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('admin.audit.index.description')}
                        </p>
                    </div>
                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                router.get(
                                    auditRoutes.index().url,
                                    {},
                                    {
                                        preserveState: true,
                                        replace: true,
                                    },
                                )
                            }
                        >
                            <X className="mr-2 size-4" aria-hidden />
                            {t('admin.audit.filters.clear')}
                        </Button>
                    )}
                </header>

                <section
                    aria-label={t('admin.audit.filters.heading')}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-card/60 p-4 sm:grid-cols-2 lg:grid-cols-5"
                >
                    <div className="space-y-1">
                        <Label className="text-xs">
                            {t('admin.audit.filters.action')}
                        </Label>
                        <Select
                            value={filters.action ?? ALL_VALUE}
                            onValueChange={(value) =>
                                pushFilters({
                                    action: value === ALL_VALUE ? null : value,
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>
                                    {t('admin.audit.filters.any')}
                                </SelectItem>
                                {availableActions.map((action) => (
                                    <SelectItem key={action} value={action}>
                                        {action}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">
                            {t('admin.audit.filters.admin')}
                        </Label>
                        <Select
                            value={
                                filters.admin_id
                                    ? String(filters.admin_id)
                                    : ALL_VALUE
                            }
                            onValueChange={(value) =>
                                pushFilters({
                                    admin_id:
                                        value === ALL_VALUE ? null : value,
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>
                                    {t('admin.audit.filters.any')}
                                </SelectItem>
                                {availableAdmins.map((adminOption) => (
                                    <SelectItem
                                        key={adminOption.id}
                                        value={String(adminOption.id)}
                                    >
                                        {adminOption.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">
                            {t('admin.audit.filters.type')}
                        </Label>
                        <Select
                            value={filters.auditable_type ?? ALL_VALUE}
                            onValueChange={(value) =>
                                pushFilters({
                                    auditable_type:
                                        value === ALL_VALUE ? null : value,
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>
                                    {t('admin.audit.filters.any')}
                                </SelectItem>
                                {availableTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {t(`admin.audit.types.${type}`, {
                                            count: '1',
                                        }) || type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="audit-from" className="text-xs">
                            {t('admin.audit.filters.from')}
                        </Label>
                        <Input
                            id="audit-from"
                            type="date"
                            defaultValue={filters.from ?? ''}
                            onChange={(e) =>
                                pushFilters({ from: e.target.value || null })
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="audit-to" className="text-xs">
                            {t('admin.audit.filters.to')}
                        </Label>
                        <Input
                            id="audit-to"
                            type="date"
                            defaultValue={filters.to ?? ''}
                            onChange={(e) =>
                                pushFilters({ to: e.target.value || null })
                            }
                        />
                    </div>
                </section>

                {logs.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 py-16">
                        <ScrollText
                            className="size-10 text-muted-foreground/40"
                            aria-hidden
                        />
                        <p className="text-sm text-muted-foreground">
                            {hasFilters
                                ? t('admin.audit.index.empty_filtered')
                                : t('admin.audit.index.empty')}
                        </p>
                        {hasFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.get(auditRoutes.index().url, {})
                                }
                            >
                                <RefreshCcw
                                    className="mr-2 size-4"
                                    aria-hidden
                                />
                                {t('admin.audit.filters.clear')}
                            </Button>
                        )}
                    </div>
                ) : (
                    <ol className="space-y-2">
                        {logs.data.map((entry) => (
                            <AuditEntry
                                key={entry.id}
                                entry={entry}
                                isExpanded={expanded.has(entry.id)}
                                onToggle={() => toggleExpanded(entry.id)}
                                locale={locale}
                            />
                        ))}
                    </ol>
                )}

                {(logs.prev_cursor || logs.next_cursor) && (
                    <nav
                        aria-label={t('admin.audit.pagination')}
                        className="flex items-center justify-between gap-2"
                    >
                        <Button
                            asChild={!!logs.prev_cursor}
                            variant="outline"
                            size="sm"
                            disabled={!logs.prev_cursor}
                        >
                            {logs.prev_cursor ? (
                                <Link
                                    href={
                                        auditRoutes.index({
                                            mergeQuery: {
                                                cursor: logs.prev_cursor,
                                            },
                                        }).url
                                    }
                                    preserveState
                                    preserveScroll
                                >
                                    <ChevronsLeft
                                        className="mr-1 size-4"
                                        aria-hidden
                                    />
                                    {t('admin.audit.pagination.previous')}
                                </Link>
                            ) : (
                                <span>
                                    <ChevronsLeft
                                        className="mr-1 size-4"
                                        aria-hidden
                                    />
                                    {t('admin.audit.pagination.previous')}
                                </span>
                            )}
                        </Button>
                        <Button
                            asChild={!!logs.next_cursor}
                            variant="outline"
                            size="sm"
                            disabled={!logs.next_cursor}
                        >
                            {logs.next_cursor ? (
                                <Link
                                    href={
                                        auditRoutes.index({
                                            mergeQuery: {
                                                cursor: logs.next_cursor,
                                            },
                                        }).url
                                    }
                                    preserveState
                                    preserveScroll
                                >
                                    {t('admin.audit.pagination.next')}
                                    <ChevronsRight
                                        className="ml-1 size-4"
                                        aria-hidden
                                    />
                                </Link>
                            ) : (
                                <span>
                                    {t('admin.audit.pagination.next')}
                                    <ChevronsRight
                                        className="ml-1 size-4"
                                        aria-hidden
                                    />
                                </span>
                            )}
                        </Button>
                    </nav>
                )}
            </div>
        </>
    );
}

AdminAuditIndex.layout = (page: ReactNode) => <AdminLayout>{page}</AdminLayout>;

type AuditEntryProps = {
    entry: AdminAuditLogEntry;
    isExpanded: boolean;
    onToggle: () => void;
    locale: string;
};

function AuditEntry({ entry, isExpanded, onToggle, locale }: AuditEntryProps) {
    const { t } = useTranslation();

    const hasDetails =
        (entry.changes && Object.keys(entry.changes).length > 0) ||
        Boolean(entry.remark);

    const typeLabel = entry.auditable.type
        ? t(`admin.audit.types.${entry.auditable.type}`, { count: '1' }) ||
          entry.auditable.type
        : null;

    return (
        <li className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span
                    className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden
                >
                    <UserRound className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium">
                            {entry.admin?.name ?? t('admin.audit.entry.system')}
                        </span>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                            {entry.action}
                        </code>
                        {typeLabel && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                {typeLabel}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {entry.auditable.label ??
                            t('admin.audit.entry.unknown_target')}
                        {entry.auditable.id && <> · #{entry.auditable.id}</>} ·{' '}
                        {formatTimestamp(entry.created_at, locale)}
                    </p>
                </div>

                {hasDetails && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto shrink-0 px-2 py-1"
                        onClick={onToggle}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? (
                            <ChevronDown className="size-4" aria-hidden />
                        ) : (
                            <ChevronRight className="size-4" aria-hidden />
                        )}
                        <span className="sr-only">
                            {t('admin.audit.entry.toggle_details')}
                        </span>
                    </Button>
                )}
            </div>

            {hasDetails && isExpanded && (
                <div className="space-y-3 border-t border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
                    {entry.remark && (
                        <div className="space-y-1">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                {t('admin.audit.entry.remark')}
                            </p>
                            <p className="text-sm">{entry.remark}</p>
                        </div>
                    )}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                {t('admin.audit.entry.changes')}
                            </p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 text-[11px] leading-relaxed">
                                {JSON.stringify(entry.changes, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}
