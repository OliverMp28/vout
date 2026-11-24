import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({
    className,
    ...props
}: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'border-input placeholder:text-muted-foreground selection:bg-signal selection:text-signal-foreground flex min-h-24 w-full min-w-0 rounded-control border bg-surface-2 px-3 py-2 text-base shadow-[inset_0_1px_2px_oklch(0.2_0.01_245/0.07)] transition-[color,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'aria-invalid:border-danger',
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
