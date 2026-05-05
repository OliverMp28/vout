<?php

namespace App\Notifications;

use App\Models\OAuthUserGrant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Aviso al usuario cuando revoca un grant desde
 * /settings/connected-apps. Confirma la acción y aporta paper trail.
 */
class OAuthGrantRevokedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly OAuthUserGrant $grant,
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
        $appName = $this->grant->registeredApp?->name ?? 'OAuth client';

        return (new MailMessage)
            ->subject(__('notifications.oauth_grant_revoked.subject', ['app' => $appName]))
            ->greeting(__('notifications.oauth_grant_revoked.greeting', ['name' => $notifiable->name]))
            ->line(__('notifications.oauth_grant_revoked.line1', ['app' => $appName]))
            ->line(__('notifications.oauth_grant_revoked.line2'))
            ->action(
                __('notifications.oauth_grant_revoked.action'),
                url('/settings/connected-apps'),
            );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'grant_id' => $this->grant->id,
            'client_id' => $this->grant->client_id,
            'app_name' => $this->grant->registeredApp?->name,
            'type' => 'oauth_grant_revoked',
        ];
    }
}
