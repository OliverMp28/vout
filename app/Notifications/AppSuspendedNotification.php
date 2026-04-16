<?php

namespace App\Notifications;

use App\Models\RegisteredApp;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación enviada al owner cuando un admin suspende su app.
 *
 * Canales: mail + database. El owner ve la razón de la suspensión y sabe
 * que debe regenerar credenciales OAuth tras la reactivación.
 */
class AppSuspendedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly RegisteredApp $app,
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
            ->subject(__('notifications.app_suspended.subject', ['app' => $this->app->name]))
            ->greeting(__('notifications.app_suspended.greeting', ['name' => $notifiable->name]))
            ->line(__('notifications.app_suspended.line1', ['app' => $this->app->name]))
            ->line(__('notifications.app_suspended.reason', ['reason' => $this->reason]))
            ->line(__('notifications.app_suspended.line2'))
            ->action(__('notifications.app_suspended.action'), url('/developers/dashboard'));
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'app_id' => $this->app->id,
            'app_name' => $this->app->name,
            'reason' => $this->reason,
            'type' => 'app_suspended',
        ];
    }
}
