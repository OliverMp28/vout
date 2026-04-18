import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export default function AppLogoIcon({
    className,
    alt = '',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/logos/vout-icon.png"
            alt={alt}
            aria-hidden={alt === '' ? true : undefined}
            draggable={false}
            className={cn('h-auto w-auto select-none', className)}
            {...props}
        />
    );
}
