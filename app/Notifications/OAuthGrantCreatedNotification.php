<?php

namespace App\Notifications;

use App\Models\OAuthUserGrant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Aviso al usuario cuando una aplicación third-party obtiene acceso
 * persistente a su cuenta Vout (primer grant o reactivación tras revoke).
 *
 * Canales: mail + database. La fila en `notifications` queda como
 * histórico aunque el usuario no llegue a abrir el correo.
 */
class OAuthGrantCreatedNotification extends Notification implements ShouldQueue
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
            ->subject(__('notifications.oauth_grant_created.subject', ['app' => $appName]))
            ->greeting(__('notifications.oauth_grant_created.greeting', ['name' => $notifiable->name]))
            ->line(__('notifications.oauth_grant_created.line1', ['app' => $appName]))
            ->line(__('notifications.oauth_grant_created.line2'))
            ->action(
                __('notifications.oauth_grant_created.action'),
                url('/settings/connected-apps'),
            )
            ->line(__('notifications.oauth_grant_created.line3'));
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
            'scopes' => $this->grant->scopes,
            'type' => 'oauth_grant_created',
        ];
    }
}
