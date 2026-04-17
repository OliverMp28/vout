<?php

namespace App\Http\Controllers\Developers;

use App\Enums\GameStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Developers\StoreDeveloperGameRequest;
use App\Http\Requests\Developers\UpdateDeveloperGameRequest;
use App\Models\Category;
use App\Models\Developer;
use App\Models\Game;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Developer Portal — Envío y gestión de juegos al catálogo (Fase 4.2, S1).
 *
 * Flujo:
 *   1. El dev envía un juego vinculándolo a una de sus `RegisteredApp` activas.
 *   2. El juego nace en estado `pending_review`, `is_active = false` — no es
 *      visible en el catálogo público hasta aprobación admin (Sesión 3).
 *   3. Mientras el estado sea editable (draft/pending/rejected), el dev puede
 *      modificarlo o eliminarlo. Tras `Published`, la ruta queda estable.
 *
 * Autorización: `GamePolicy` — el propietario se identifica por
 * `submitted_by_user_id`. El admin hereda acceso vía `before()`.
 */
class DeveloperGameController extends Controller
{
    use AuthorizesRequests;

    /**
     * Listado de juegos enviados por el usuario autenticado.
     */
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Game::class);

        $user = $request->user();

        $games = Game::query()
            ->submittedBy($user)
            ->with(['registeredApp:id,slug,name', 'categories:id,name,slug'])
            ->orderByDesc('created_at')
            ->get([
                'id', 'submitted_by_user_id', 'registered_app_id',
                'name', 'slug', 'cover_image', 'embed_url',
                'status', 'is_active', 'play_count',
                'created_at', 'updated_at',
            ]);

        return Inertia::render('developers/dashboard/games/index', [
            'games' => $games->map(fn (Game $game): array => $this->serializeGameCard($game))->all(),
        ]);
    }

    /**
     * Formulario de creación.
     */
    public function create(Request $request): Response
    {
        $this->authorize('create', Game::class);

        return Inertia::render('developers/dashboard/games/create', [
            'apps' => $this->availableApps($request),
            'categories' => $this->categoryOptions(),
            'developers' => $this->developerOptions($request),
            'own_profile' => $this->ownProfileSummary($request),
        ]);
    }

    /**
     * Persiste un juego con `status = pending_review` y relaciones N:N.
     */
    public function store(StoreDeveloperGameRequest $request): RedirectResponse
    {
        $this->authorize('create', Game::class);

        $data = $request->validated();
        $user = $request->user();

        $game = DB::transaction(function () use ($data, $user): Game {
            $game = Game::create([
                'submitted_by_user_id' => $user->id,
                'registered_app_id' => $data['registered_app_id'],
                'name' => $data['name'],
                'slug' => $this->uniqueSlug($data['name']),
                'description' => $data['description'],
                'embed_url' => $data['embed_url'],
                'cover_image' => $data['cover_image'] ?? null,
                'release_date' => $data['release_date'] ?? null,
                'repo_url' => $data['repo_url'] ?? null,
                'is_active' => false,
                'is_featured' => false,
                'status' => GameStatus::PendingReview,
            ]);

            $game->categories()->sync($data['category_ids']);

            $developerIds = $data['developer_ids'] ?? [];

            // Auto-adjunto: si el dev ya reclamó su ficha pública, se añade
            // silenciosamente al juego — así el catálogo público lo acredita
            // aunque el dev no marcase su propio chip en el formulario.
            // (Fase 4.2, S4.5 — Developer Profile self-registration.)
            $ownProfileId = $user->developerProfile?->id;
            if ($ownProfileId !== null && ! in_array($ownProfileId, $developerIds, true)) {
                $developerIds[] = $ownProfileId;
            }

            if (! empty($developerIds)) {
                $game->developers()->sync($developerIds);
            }

            return $game;
        });

        return to_route('developers.games.show', $game)
            ->with('status', 'developers.games.submitted');
    }

    /**
     * Detalle del juego desde el punto de vista del dev.
     */
    public function show(Request $request, Game $game): Response
    {
        $this->authorize('view', $game);

        $game->load([
            'registeredApp:id,slug,name,allowed_origins,is_active,suspended_at',
            'categories:id,name,slug',
            'developers:id,name,slug',
        ]);

        return Inertia::render('developers/dashboard/games/show', [
            'game' => $this->serializeGameDetail($game, $request->user()->developerProfile?->id),
            'apps' => $this->availableApps($request, includeId: $game->registered_app_id),
            'categories' => $this->categoryOptions(),
            'developers' => $this->developerOptions($request),
            'own_profile' => $this->ownProfileSummary($request),
        ]);
    }

    /**
     * Actualiza los campos editables. Rechazado por la policy si el estado
     * ya no permite cambios (`Published`).
     */
    public function update(UpdateDeveloperGameRequest $request, Game $game): RedirectResponse
    {
        $this->authorize('update', $game);

        $data = $request->validated();
        $user = $request->user();

        DB::transaction(function () use ($game, $data, $user): void {
            $game->fill(collect($data)->only([
                'name', 'description', 'embed_url', 'cover_image',
                'release_date', 'repo_url', 'registered_app_id',
            ])->all())->save();

            // Si se editó tras un rechazo, se vuelve a cola.
            if ($game->status === GameStatus::Rejected) {
                $game->update(['status' => GameStatus::PendingReview]);
            }

            if (array_key_exists('category_ids', $data)) {
                $game->categories()->sync($data['category_ids']);
            }

            if (array_key_exists('developer_ids', $data)) {
                $developerIds = $data['developer_ids'] ?? [];

                // Mantener siempre vinculada la ficha propia del dev si existe:
                // el formulario la oculta del picker, así que si no la re-inyectamos
                // aquí un simple "guardar" la desvincularía silenciosamente.
                $ownProfileId = $user->developerProfile?->id;
                if ($ownProfileId !== null && ! in_array($ownProfileId, $developerIds, true)) {
                    $developerIds[] = $ownProfileId;
                }

                $game->developers()->sync($developerIds);
            }
        });

        return to_route('developers.games.show', $game)
            ->with('status', 'developers.games.updated');
    }

    /**
     * Elimina un juego mientras su estado lo permita.
     */
    public function destroy(Game $game): RedirectResponse
    {
        $this->authorize('delete', $game);

        $game->delete();

        return to_route('developers.games.index')
            ->with('status', 'developers.games.deleted');
    }

    /**
     * Lista de apps del dev seleccionables como contenedor del juego.
     * Incluye la app ya vinculada al juego aunque esté inactiva, para
     * no romper la edición si el dev pausó su app después de publicar.
     *
     * @return list<array{id:int,name:string,slug:string,is_active:bool,allowed_origins:list<string>}>
     */
    private function availableApps(Request $request, ?int $includeId = null): array
    {
        return $request->user()
            ->registeredApps()
            ->where(function ($query) use ($includeId): void {
                $query->where('is_active', true);
                if ($includeId !== null) {
                    $query->orWhere('id', $includeId);
                }
            })
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'is_active', 'allowed_origins'])
            ->map(fn ($app): array => [
                'id' => $app->id,
                'name' => $app->name,
                'slug' => $app->slug,
                'is_active' => (bool) $app->is_active,
                'allowed_origins' => array_values($app->allowed_origins ?? []),
            ])
            ->all();
    }

    /**
     * @return list<array{id:int,name:string,slug:string}>
     */
    private function categoryOptions(): array
    {
        return Category::query()
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Category $category): array => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
            ])
            ->all();
    }

    /**
     * Lista de developers seleccionables en el picker del formulario.
     * Se excluye la ficha propia del user autenticado: ya se vincula
     * automáticamente en store/update y mostrarla confundiría al dev
     * (aparecería pre-marcada "por sistema" sin poder desmarcarla).
     *
     * @return list<array{id:int,name:string,slug:string}>
     */
    private function developerOptions(Request $request): array
    {
        $ownProfileId = $request->user()->developerProfile?->id;

        return Developer::query()
            ->when($ownProfileId !== null, fn ($query) => $query->where('id', '!=', $ownProfileId))
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Developer $developer): array => [
                'id' => $developer->id,
                'name' => $developer->name,
                'slug' => $developer->slug,
            ])
            ->all();
    }

    /**
     * Resumen de la ficha propia del user para que el UI muestre un aviso
     * "tu ficha se adjuntará automáticamente". `null` si aún no la reclamó.
     *
     * @return array{id:int,name:string,slug:string}|null
     */
    private function ownProfileSummary(Request $request): ?array
    {
        $profile = $request->user()->developerProfile;

        return $profile ? [
            'id' => $profile->id,
            'name' => $profile->name,
            'slug' => $profile->slug,
        ] : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeGameCard(Game $game): array
    {
        return [
            'id' => $game->id,
            'name' => $game->name,
            'slug' => $game->slug,
            'cover_image' => $game->cover_image,
            'embed_url' => $game->embed_url,
            'status' => $game->status->value,
            'is_active' => (bool) $game->is_active,
            'play_count' => (int) $game->play_count,
            'created_at' => $game->created_at?->toIso8601String(),
            'updated_at' => $game->updated_at?->toIso8601String(),
            'registered_app' => $game->registeredApp ? [
                'id' => $game->registeredApp->id,
                'name' => $game->registeredApp->name,
                'slug' => $game->registeredApp->slug,
                'is_active' => (bool) $game->registeredApp->is_active,
                'is_suspended' => $game->registeredApp->isSuspended(),
            ] : null,
            'categories' => $game->categories->map(fn (Category $c): array => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeGameDetail(Game $game, ?int $ownProfileId = null): array
    {
        // Se excluye la ficha propia del dev autenticado del conjunto
        // de `developer_ids` expuesto al formulario — el picker la oculta,
        // así que no debe aparecer pre-marcada. El backend la re-adjunta
        // en store/update para que el catálogo público siga acreditándola.
        return array_merge($this->serializeGameCard($game), [
            'description' => $game->description,
            'release_date' => $game->release_date?->toDateString(),
            'repo_url' => $game->repo_url,
            'rejection_reason' => $game->rejection_reason,
            'is_editable' => true,
            'is_deletable' => $game->status !== GameStatus::Published,
            'category_ids' => $game->categories->pluck('id')->values()->all(),
            'developer_ids' => $game->developers
                ->pluck('id')
                ->filter(fn (int $id): bool => $id !== $ownProfileId)
                ->values()
                ->all(),
            'registered_app_id' => $game->registered_app_id,
        ]);
    }

    /**
     * Genera un slug único dentro de `games`. Reutiliza el patrón aplicado
     * en `DeveloperAppController::uniqueSlug()` para coherencia.
     */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'game-'.Str::lower(Str::random(6));
        }

        $slug = $base;
        $suffix = 2;
        while (Game::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
