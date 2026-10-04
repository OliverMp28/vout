import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from '@/hooks/use-translation';

type ConsentIdentityProps = {
    name: string;
    email: string;
    avatar: string | null;
};

/**
 * Cuenta de Vout con la que el usuario va a conceder acceso a una app.
 *
 * Compartido por las dos pantallas de consentimiento: la del flujo OAuth
 * (`oauth/authorize`) y la de juegos embebidos (`play/consent`).
 */
export function ConsentIdentity({ name, email, avatar }: ConsentIdentityProps) {
    const { t } = useTranslation();

    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');

    return (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Avatar className="size-10 shrink-0">
                <AvatarImage src={avatar ?? undefined} alt={name} />
                <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                    {initials || '?'}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {email}
                </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {t('oauth.authorize.signed_in_badge')}
            </span>
        </div>
    );
}
