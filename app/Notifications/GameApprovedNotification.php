<?php

namespace App\Notifications;

use App\Models\Game;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación enviada al dev cuando un admin aprueba su juego.
 *
 * Canales: mail + database.
 */
class GameApprovedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Game $game,
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
            ->subject(__('notifications.game_approved.subject', ['game' => $this->game->name]))
            ->greeting(__('notifications.game_approved.greeting', ['name' => $notifiable->name]))
            ->line(__('notifications.game_approved.line1', ['game' => $this->game->name]))
            ->line(__('notifications.game_approved.line2'))
            ->action(__('notifications.game_approved.action'), url('/developers/dashboard/games/'.$this->game->slug));
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'game_id' => $this->game->id,
            'game_name' => $this->game->name,
            'type' => 'game_approved',
        ];
    }
}
