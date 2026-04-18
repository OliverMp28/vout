<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
            // Fase 5 — Consentimiento explícito en registro.
            // Ambos checkboxes son obligatorios y deben venir marcados (true).
            // Validar `accepted` rechaza false, "false", null y "0" — el frontend
            // envía el booleano nativo del checkbox shadcn.
            'accept_terms' => ['required', Rule::in([true, 'true', 1, '1', 'on'])],
            'confirm_age' => ['required', Rule::in([true, 'true', 1, '1', 'on'])],
        ], [
            'accept_terms.required' => __('auth.consent.terms.required'),
            'accept_terms.in' => __('auth.consent.terms.required'),
            'confirm_age.required' => __('auth.consent.age.required'),
            'confirm_age.in' => __('auth.consent.age.required'),
        ])->validate();

        return User::create([
            'name' => $input['name'],
            'username' => $input['username'],
            'email' => $input['email'],
            'password' => $input['password'],
            'terms_accepted_at' => now(),
            'privacy_version_accepted' => config('vout.legal.current_privacy_version'),
        ]);
    }
}
