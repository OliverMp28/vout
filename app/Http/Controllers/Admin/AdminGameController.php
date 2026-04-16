<?php

namespace App\Http\Controllers\Admin;

use App\Enums\GameStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectGameRequest;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use App\Notifications\GameApprovedNotification;
use App\Notifications\GameRejectedNotification;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel de Administración — revisión y gestión de juegos (Fase 4.2, S3).
 *
 * Cola de revisión de juegos enviados por devs, aprobación/rechazo,
 * toggle featured, edición administrativa y eliminación.
 * Cada acción crítica genera un audit log y notifica al dev propietario.
 */
class AdminGameController extends Controller
{
    /**
     * Listado paginado de todos los juegos con filtros opcionales.
     */
    public function index(Request $request): Response
    {
        $query = Game::query()
            ->with([
                'submittedBy:id,name,email',
                'registeredApp:id,slug,name',
                'categories:id,name,slug',
            ]);

        // Filtro por status
        if ($request->filled('status')) {
            $status = GameStatus::tryFrom($request->input('status'));
            if ($status) {
                $query->where('status', $status->value);
            }
        }

        // Filtro por featured
        if ($request->filled('featured')) {
            $query->where('is_featured', $request->boolean('featured'));
        }

        // Búsqueda por nombre de juego o email/nombre del submitter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('submittedBy', function ($u) use ($search): void {
                        $u->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $games = $query->orderByDesc('created_at')->paginate(20)->withQueryString();

        return Inertia::render('admin/games/index', [
            'games' => $games,
            'filters' => $request->only(['status', 'featured', 'search']),
            'pendingCount' => Game::query()->pendingReview()->count(),
        ]);
    }

    /**
     * Detalle de un juego con info del submitter y app vinculada.
     */
    public function show(Game $game): Response
    {
        $game->load([
            'submittedBy:id,name,email,username',
            'registeredApp:id,slug,name,allowed_origins',
            'categories:id,name,slug',
            'developers:id,name,slug',
        ]);

        return Inertia::render('admin/games/show', [
            'game' => $this->serializeGameDetail($game),
            'categories' => $this->categoryOptions(),
            'developers' => $this->developerOptions(),
        ]);
    }

    /**
     * Aprueba un juego: status=Published, is_active=true.
     * Notifica al dev propietario.
     */
    public function approve(Request $request, Game $game): RedirectResponse
    {
        abort_unless(
            $game->status === GameStatus::PendingReview,
            422,
            __('admin.games.not_pending'),
        );

        $game->update([
            'status' => GameStatus::Published,
            'is_active' => true,
            'rejection_reason' => null,
        ]);

        Audit::record($request->user(), 'game.approved', $game);

        $game->submittedBy?->notify(new GameApprovedNotification($game));

        return back()->with('status', 'admin.games.approved');
    }

    /**
     * Rechaza un juego: status=Rejected + remark guardado en rejection_reason.
     * El dev puede editar y reenviar (vuelve a pending_review automáticamente).
     */
    public function reject(RejectGameRequest $request, Game $game): RedirectResponse
    {
        abort_unless(
            $game->status === GameStatus::PendingReview,
            422,
            __('admin.games.not_pending'),
        );

        $reason = $request->validated('reason');

        $game->update([
            'status' => GameStatus::Rejected,
            'rejection_reason' => $reason,
        ]);

        Audit::record($request->user(), 'game.rejected', $game, [
            'reason' => $reason,
        ]);

        $game->submittedBy?->notify(new GameRejectedNotification($game, $reason));

        return back()->with('status', 'admin.games.rejected');
    }

    /**
     * Alterna is_featured (destacado en portada).
     */
    public function toggleFeatured(Request $request, Game $game): RedirectResponse
    {
        $game->update(['is_featured' => ! $game->is_featured]);

        Audit::record(
            $request->user(),
            $game->is_featured ? 'game.featured' : 'game.unfeatured',
            $game,
        );

        return back()->with('status', 'admin.games.featured_toggled');
    }

    /**
     * Actualización administrativa (corregir typos, metadatos, categorías).
     * El admin puede editar cualquier juego en cualquier estado.
     */
    public function update(Request $request, Game $game): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'description' => ['sometimes', 'string', 'min:20', 'max:5000'],
            'embed_url' => ['sometimes', 'url:https'],
            'cover_image' => ['nullable', 'url:https', 'max:500'],
            'release_date' => ['nullable', 'date'],
            'repo_url' => ['nullable', 'url', 'max:500'],
            'category_ids' => ['sometimes', 'array', 'min:1', 'max:5'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'developer_ids' => ['sometimes', 'array', 'max:10'],
            'developer_ids.*' => ['integer', 'exists:developers,id'],
        ]);

        $game->fill(collect($data)->only([
            'name', 'description', 'embed_url', 'cover_image',
            'release_date', 'repo_url',
        ])->all())->save();

        if (array_key_exists('category_ids', $data)) {
            $game->categories()->sync($data['category_ids']);
        }

        if (array_key_exists('developer_ids', $data)) {
            $game->developers()->sync($data['developer_ids'] ?? []);
        }

        Audit::record($request->user(), 'game.updated', $game);

        return back()->with('status', 'admin.games.updated');
    }

    /**
     * Eliminación permanente del juego.
     */
    public function destroy(Request $request, Game $game): RedirectResponse
    {
        Audit::record($request->user(), 'game.destroyed', $game, [
            'name' => $game->name,
            'submitter_email' => $game->submittedBy?->email,
        ]);

        $game->categories()->detach();
        $game->developers()->detach();
        $game->delete();

        return to_route('admin.games.index')
            ->with('status', 'admin.games.destroyed');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeGameDetail(Game $game): array
    {
        return [
            'id' => $game->id,
            'name' => $game->name,
            'slug' => $game->slug,
            'description' => $game->description,
            'cover_image' => $game->cover_image,
            'embed_url' => $game->embed_url,
            'repo_url' => $game->repo_url,
            'release_date' => $game->release_date?->toDateString(),
            'status' => $game->status->value,
            'is_active' => (bool) $game->is_active,
            'is_featured' => (bool) $game->is_featured,
            'play_count' => (int) $game->play_count,
            'rejection_reason' => $game->rejection_reason,
            'created_at' => $game->created_at?->toIso8601String(),
            'updated_at' => $game->updated_at?->toIso8601String(),
            'submitter' => $game->submittedBy ? [
                'id' => $game->submittedBy->id,
                'name' => $game->submittedBy->name,
                'email' => $game->submittedBy->email,
                'username' => $game->submittedBy->username,
            ] : null,
            'registered_app' => $game->registeredApp ? [
                'id' => $game->registeredApp->id,
                'name' => $game->registeredApp->name,
                'slug' => $game->registeredApp->slug,
                'allowed_origins' => array_values($game->registeredApp->allowed_origins ?? []),
            ] : null,
            'categories' => $game->categories->map(fn ($c): array => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->all(),
            'developers' => $game->developers->map(fn ($d): array => [
                'id' => $d->id,
                'name' => $d->name,
                'slug' => $d->slug,
            ])->all(),
            'category_ids' => $game->categories->pluck('id')->values()->all(),
            'developer_ids' => $game->developers->pluck('id')->values()->all(),
        ];
    }

    /**
     * @return list<array{id:int,name:string,slug:string}>
     */
    private function categoryOptions(): array
    {
        return Category::query()
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Category $c): array => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])
            ->all();
    }

    /**
     * @return list<array{id:int,name:string,slug:string}>
     */
    private function developerOptions(): array
    {
        return Developer::query()
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Developer $d): array => [
                'id' => $d->id,
                'name' => $d->name,
                'slug' => $d->slug,
            ])
            ->all();
    }
}
