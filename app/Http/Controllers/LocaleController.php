<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class LocaleController extends Controller
{
    /**
     * Update the application's active locale.
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'locale' => ['required', 'string', 'in:en,es'],
        ]);

        $request->session()->put('locale', $validated['locale']);

        if ($request->user() && $request->user()->settings) {
            $request->user()->settings()->update(['locale' => $validated['locale']]);
        }

        return redirect()->back();
    }
}
