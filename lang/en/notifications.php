<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Notification Language Lines
    |--------------------------------------------------------------------------
    |
    | Used by mail and database notifications sent from the admin panel.
    |
    */

    'app_suspended' => [
        'subject' => 'Your app ":app" has been suspended',
        'greeting' => 'Hello :name,',
        'line1' => 'Your app ":app" has been suspended by a Vout administrator.',
        'reason' => 'Reason: :reason',
        'line2' => 'If you believe this is a mistake, please contact support. After reactivation, you will need to regenerate your OAuth credentials.',
        'action' => 'Go to Developer Dashboard',
    ],

    'game_approved' => [
        'subject' => 'Your game ":game" has been approved',
        'greeting' => 'Hello :name,',
        'line1' => 'Your game ":game" has been reviewed and approved by the Vout team.',
        'line2' => 'It is now published and visible in the public catalog. Congratulations!',
        'action' => 'View your game',
    ],

    'game_rejected' => [
        'subject' => 'Your game ":game" needs changes',
        'greeting' => 'Hello :name,',
        'line1' => 'Your game ":game" has been reviewed but was not approved at this time.',
        'reason' => 'Reason: :reason',
        'line2' => 'You can edit your game and resubmit it for another review from your Developer Dashboard.',
        'action' => 'Edit and resubmit',
    ],

    'oauth_grant_created' => [
        'subject' => '":app" now has access to your Vout account',
        'greeting' => 'Hello :name,',
        'line1' => 'You authorized ":app" to access your Vout account.',
        'line2' => 'We will remember this authorization for future sign-ins, so you will not have to approve it again every time you return.',
        'line3' => 'If this was not you, you can revoke access from your account settings.',
        'action' => 'Manage connected apps',
    ],

    'oauth_grant_revoked' => [
        'subject' => 'You revoked access for ":app"',
        'greeting' => 'Hello :name,',
        'line1' => 'You revoked ":app" access to your Vout account.',
        'line2' => 'Its active tokens have been invalidated; it will need to ask for permission again the next time you sign in.',
        'action' => 'View connected apps',
    ],

];
