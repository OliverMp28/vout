import { usePage } from '@inertiajs/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from '@/hooks/use-translation';

type Props = {
    name: string;
    hourOfDay: number;
};

function getGreetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
    if (hour < 12) {
        return 'morning';
    }
    if (hour < 19) {
        return 'afternoon';
    }
    return 'evening';
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

export function DashboardHeader({ name, hourOfDay }: Props) {
    const { t, locale } = useTranslation();
    const { auth } = usePage().props;
    const greetingKey = getGreetingKey(hourOfDay);

    const subtitle = new Date().toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <section
            id="dashboard-greeting"
            aria-labelledby="dashboard-greeting-title"
            className="flex items-center gap-4"
        >
            <Avatar className="size-14 ring-2 ring-primary/20 transition-all duration-200">
                {auth.user.avatar && (
                    <AvatarImage src={auth.user.avatar} alt={name} />
                )}
                <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                    {getInitials(name)}
                </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-0.5">
                <h1
                    id="dashboard-greeting-title"
                    className="text-2xl font-semibold tracking-tight"
                >
                    {t(`dashboard.greeting.${greetingKey}`, { name })}
                </h1>
                <p className="text-sm text-muted-foreground capitalize">
                    {subtitle}
                </p>
            </div>
        </section>
    );
}
