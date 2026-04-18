import { cn } from '@/lib/utils';

type Props = {
    className?: string;
};

export default function AppLogo({ className }: Props) {
    return (
        <img
            src="/logos/vout-wordmark.png"
            alt="Vout"
            draggable={false}
            className={cn('h-6 w-auto max-w-full select-none', className)}
        />
    );
}
