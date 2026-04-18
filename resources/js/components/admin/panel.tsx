import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Panel ────────────────────────────────────────────────────────────

type PanelProps = {
    title: string;
    children: ReactNode;
    tone?: 'default' | 'danger' | 'primary';
};

export function Panel({ title, children, tone = 'default' }: PanelProps) {
    return (
        <section
            className={cn(
                'space-y-4 rounded-2xl border bg-card p-6 shadow-sm',
                tone === 'danger'
                    ? 'border-destructive/30'
                    : tone === 'primary'
                      ? 'border-primary/30'
                      : 'border-border',
            )}
        >
            <h2
                className={cn(
                    'text-base font-semibold tracking-tight',
                    tone === 'danger' && 'text-destructive',
                    tone === 'primary' && 'text-primary',
                )}
            >
                {title}
            </h2>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

// ── MetaRow ──────────────────────────────────────────────────────────

type MetaRowProps = {
    label: string;
    value: string;
    monospace?: boolean;
};

export function MetaRow({ label, value, monospace }: MetaRowProps) {
    return (
        <div className="space-y-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className={cn(
                    'text-sm break-all',
                    monospace && 'font-mono text-xs',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

// ── ActionRow ────────────────────────────────────────────────────────

type ActionRowProps = {
    title: string;
    description: string;
    action: ReactNode;
};

export function ActionRow({ title, description, action }: ActionRowProps) {
    return (
        <div className="flex flex-col gap-3 border-b border-border/60 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">{action}</div>
        </div>
    );
}
