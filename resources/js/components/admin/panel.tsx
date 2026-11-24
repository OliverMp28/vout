import type { ReactNode } from 'react';
import { SectionPanel } from '@/components/section-panel';
import { cn } from '@/lib/utils';

// ── Panel ────────────────────────────────────────────────────────────

type PanelProps = {
    title: string;
    children: ReactNode;
    tone?: 'default' | 'danger' | 'primary';
};

/**
 * Bandeja de las fichas del admin. `primary` marca lo que espera una decisión
 * y `danger`, lo que no se puede deshacer.
 */
export function Panel({ title, children, tone = 'default' }: PanelProps) {
    return (
        <SectionPanel
            title={title}
            tone={tone === 'primary' ? 'attention' : tone}
        >
            <div className="space-y-4">{children}</div>
        </SectionPanel>
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
        <div className="flex flex-col gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">{action}</div>
        </div>
    );
}
