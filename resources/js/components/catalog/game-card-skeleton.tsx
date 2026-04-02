import { Skeleton } from '@/components/ui/skeleton';

export function GameCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-14" />
                </div>
                <Skeleton className="mt-1 h-3 w-1/3" />
            </div>
        </div>
    );
}
