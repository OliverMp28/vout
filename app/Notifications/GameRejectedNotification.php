<?php

namespace App\Notifications;

use App\Models\Game;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación enviada al dev cuando un admin rechaza su juego.
 *
 * Canales: mail + database. Incluye el motivo del rechazo.
 */
class GameRejectedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Game $game,
        public readonly string $reason,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('notifications.game_rejected.subject', ['game' => $this->game->name]))
            ->greeting(__('notifications.game_rejected.greeting', ['name' => $notifiable->name]))
            ->line(__('notifications.game_rejected.line1', ['game' => $this->game->name]))
            ->line(__('notifications.game_rejected.reason', ['reason' => $this->reason]))
            ->line(__('notifications.game_rejected.line2'))
            ->action(__('notifications.game_rejected.action'), url('/developers/dashboard/games/'.$this->game->slug));
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'game_id' => $this->game->id,
            'game_name' => $this->game->name,
            'reason' => $this->reason,
            'type' => 'game_rejected',
        ];
    }
}
