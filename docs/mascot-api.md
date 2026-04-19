# Mascota Vou — Guía de funcionalidades para integradores

Este archivo documenta **qué puede hacer la mascota Vou y cómo cualquier componente del portal puede interactuar con ella**. Está pensado para que, cuando un desarrollador (o una IA asistente) necesite activar un efecto de la mascota desde una feature — p. ej. "que celebre al guardar el perfil" —, sepa exactamente qué API usar sin tener que leer toda la implementación.

La implementación vive en `resources/js/components/mascot/` y `resources/js/hooks/use-mascot.ts`. Este documento describe **la superficie pública estable**, no los detalles internos.

---

## 1. Dónde vive y cuándo aparece

- `MascotProvider` envuelve todo el `PortalLayout` ([resources/js/layouts/portal-layout.tsx](../resources/js/layouts/portal-layout.tsx)). Está disponible en cualquier página renderizada bajo el portal autenticado.
- `MascotRoot` es la puerta de entrada visual: decide si **montar** la mascota según dos condiciones acumulativas:
  1. `auth.user.settings.show_mascot === true` (preferencia del usuario).
  2. La ruta actual **no** empieza por `/settings` (la pantalla de settings muestra su propio preview estático vía `VouPreview`).
- Si cualquiera falla, el chunk de Vou **no se descarga** (lazy import). El usuario no paga coste de bundle.
- La mascota no aparece en rutas públicas (welcome, legales, login) porque ahí no hay `auth.user`.

## 2. API pública: `useMascot()`

Cualquier componente React dentro del `PortalLayout` puede leer el estado y disparar eventos:

```tsx
import { useMascot } from '@/hooks/use-mascot';

function MyFeature() {
    const { state, celebrate, sleep, wake, setState } = useMascot();
    // ...
}
```

### `state: MascotState`
El estado actual (readonly). Valores posibles: `'entering' | 'idle' | 'hovering' | 'tapped' | 'celebrating' | 'sleeping'`. Ver sección 3.

### `celebrate(): void`
Dispara el estado `celebrating` durante 600 ms: el cuerpo salta, aparecen sparkles de colores y vuelve a `idle` automáticamente.
**Uso típico**: tras un logro del usuario — guardar perfil, completar calibración de gestos, primer login, ganar una partida, etc.

### `sleep(): void`
Fuerza el estado `sleeping` inmediatamente (ojos cerrados + "z" flotante). Sin llamar a esto, el provider ya duerme a Vou tras 2 minutos de inactividad. Úsalo solo si quieres adelantarlo (p. ej. pantallas largas de lectura).

### `wake(): void`
Despierta a Vou desde `sleeping`. El provider también lo hace solo al detectar actividad del usuario.

### `setState(state: MascotState): void`
Escape hatch para forzar un estado concreto. Evítalo salvo en tests o herramientas de depuración.

## 3. Estados y qué significan visualmente

| Estado | Cómo se entra | Duración | Efecto visual |
|---|---|---|---|
| `entering` | Auto al montar | 600 ms | Fade-in + translate desde abajo |
| `idle` | Por defecto | ∞ | Respira + parpadea cada ~5.3 s |
| `hovering` | Mouse sobre Vou / foco por teclado | Mientras dure el hover | Aparece una sonrisa |
| `tapped` | Click o Enter sobre Vou | 200 ms | Flash breve + tooltip con saludo i18n aleatorio |
| `celebrating` | `celebrate()` | 600 ms | Salto del cuerpo + sparkles cian/rosa |
| `sleeping` | 120 s de inactividad o `sleep()` | Hasta actividad o `wake()` | Ojos cerrados + "z" flotante |

Todos los estados respetan `prefers-reduced-motion`: las animaciones de loop se desactivan, pero los cambios informativos (opacity, fade) se conservan.

## 4. Patrones recomendados

### 4.1. Celebrar al guardar algo con éxito

```tsx
import { useMascot } from '@/hooks/use-mascot';
import { useEffect } from 'react';

function ProfileForm({ recentlySuccessful }: { recentlySuccessful: boolean }) {
    const { celebrate } = useMascot();

    useEffect(() => {
        if (recentlySuccessful) {
            celebrate();
        }
    }, [recentlySuccessful, celebrate]);

    // ...
}
```

### 4.2. Celebrar al recibir un evento externo (p. ej. iFrame de juego)

```tsx
useEffect(() => {
    function handleMessage(e: MessageEvent) {
        if (e.data?.type === 'GAME_WON') {
            celebrate();
        }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}, [celebrate]);
```

### 4.3. Leer el estado para adaptar UI propia

```tsx
const { state } = useMascot();
const isSleeping = state === 'sleeping';
// p. ej. atenuar notificaciones si Vou duerme
```

## 5. Lo que NO debes hacer

- **No envuelvas tus páginas en otro `MascotProvider`.** Ya hay uno en el `PortalLayout`. Un segundo provider crearía una máquina de estados paralela desincronizada.
- **No llames a `useMascot()` fuera del `PortalLayout`** (p. ej. en páginas de auth o legales). Lanzará un error porque no hay contexto.
- **No toques `useMascotDispatch()`** desde features externas. Es interno del componente `<Vou />` y adaptadores futuros (MediaPipe). Usa siempre `useMascot()`.
- **No intentes renderizar otra instancia de `<Vou />`**. El componente se monta una sola vez vía portal a `document.body`.
- **No asumas que Vou siempre está visible.** El usuario puede desactivarla en `/settings/appearance`. Tu feature debe funcionar igual con o sin mascota — la celebración es decorativa, no funcional.

## 6. Contratos con el backend

- La prop `auth.user.settings.show_mascot` (boolean) se comparte desde `HandleInertiaRequests::share()`. Es la **única** fuente de verdad para la visibilidad.
- El usuario la cambia desde `/settings/appearance` (columna `show_mascot` en `user_settings`, default `true`).
- Si `auth.user.settings` es `null` (usuario legacy sin fila), `MascotRoot` lo trata como "no mostrar" vía `?? false`.

Los tests que protegen este contrato:
- [tests/Feature/Mascot/MascotVisibilityTest.php](../tests/Feature/Mascot/MascotVisibilityTest.php) — la prop Inertia se comparte correctamente en todos los escenarios.
- [tests/Browser/MascotTest.php](../tests/Browser/MascotTest.php) — Vou se monta/no se monta en el DOM real según `show_mascot`.

## 7. i18n y accesibilidad

Textos centralizados en `lang/es.json` y `lang/en.json` bajo el prefijo `mascot.*`:

- `mascot.aria_label` — etiqueta del botón cuando está despierto.
- `mascot.sleeping_aria` — etiqueta cuando duerme.
- `mascot.greetings.0` / `.1` / `.2` — los 3 saludos que rotan aleatoriamente al hacer tap.

Si añades un nuevo saludo o mensaje contextual, créalo como clave `mascot.*` en **ambos** locales — existe verificación de paridad de claves.

## 8. Debug en desarrollo

En modo DEV, el provider expone `window.__vou` con la API completa. Desde la consola del navegador:

```js
__vou.state         // estado actual
__vou.celebrate()   // probar la animación de celebración
__vou.sleep()       // dormir a Vou al instante
__vou.wake()        // despertar
```

Esta handle no existe en producción (`import.meta.env.DEV` es `false`).

---

## 9. Extensiones futuras (aún no cableadas)

Estas integraciones están **pensadas pero no implementadas** — agregarlas es simplemente llamar `celebrate()` desde el sitio correcto, no requiere tocar la mascota en sí:

- Primer login tras registro (flag en sesión).
- Activar gestos y completar calibración por primera vez.
- Guardar perfil / avatar con éxito.
- Recibir `postMessage({ type: 'GAME_WON' })` desde un iframe de juego.
- Primer "pasaporte" OAuth emitido a una app externa.

Si añades una de estas integraciones, considera documentarla brevemente aquí para que otras IAs o devs sepan que el punto ya está ocupado.
