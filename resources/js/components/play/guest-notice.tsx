/**
 * Aviso de la página de juego cuando un juego de cuenta opcional no recibe
 * la identidad del jugador: se dice por qué y cómo cambiarlo, sin tapar el
 * juego. Va entre la cabecera y el escenario.
 */

import { Link } from '@inertiajs/react';
import { UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { show as playShow, signIn as playSignIn } from '@/routes/play';
import { notice as verificationNotice } from '@/routes/verification';

/** Por qué el juego no sabe quién juega (ver `PlayController::guestNotice`). */
export type GuestNoticeReason = 'guest' | 'unverified' | 'declined';

type GuestNoticeProps = {
    reason: GuestNoticeReason;
    gameSlug: string;
};

export function GuestNotice({ reason, gameSlug }: GuestNoticeProps) {
    const { t } = useTranslation();

    const href =
        reason === 'guest'
            ? playSignIn.url(gameSlug)
            : reason === 'unverified'
              ? verificationNotice.url()
              : playShow.url(gameSlug);

    return (
        <div
            data-play-guest-notice={reason}
            className="mb-4 flex flex-col gap-3 rounded-surface border bg-card px-4 py-3 shadow-surface sm:flex-row sm:items-center sm:justify-between"
        >
            <p className="flex items-start gap-2.5 text-sm">
                <UserRound
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
                <span>{t(`play.guest.${reason}.text`)}</span>
            </p>
            <Button
                asChild
                variant="secondary"
                size="sm"
                className="w-fit shrink-0"
            >
                <Link href={href}>{t(`play.guest.${reason}.action`)}</Link>
            </Button>
        </div>
    );
}
