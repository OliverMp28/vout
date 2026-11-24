import { Link } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Props = ComponentProps<typeof Link>;

export default function TextLink({
    className = '',
    children,
    ...props
}: Props) {
    return (
        <Link
            className={cn(
                'rounded-xs font-semibold text-foreground underline decoration-border-strong decoration-[1.5px] underline-offset-4 transition-colors hover:decoration-signal-strong',
                className,
            )}
            {...props}
        >
            {children}
        </Link>
    );
}
