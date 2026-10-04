/*!
 * Vout Game SDK v1
 *
 * Conecta un juego embebido con el portal Vout: identidad del jugador,
 * renovación del token y control por gestos.
 *
 *   <script src="https://TU-VOUT/sdk/vout-game.js"></script>
 *   <script>
 *     const vout = VoutGame.connect({
 *       portalOrigin: 'https://TU-VOUT',
 *       onAuth(session) { ... },   // { token, expiresAt, voutId, username }
 *     });
 *   </script>
 *
 * Con `simulateInput` (activo por defecto) las teclas y clics que el jugador
 * hace con la cara llegan a tu página como eventos de teclado y ratón
 * normales: tu código de controles de siempre funciona sin cambios.
 *
 * Fuera del portal (`window.parent === window`) no hace nada y
 * `vout.embedded` vale `false`, así que puedes llamarlo siempre.
 *
 * Sin dependencias. Puedes copiar este archivo a tu proyecto si prefieres
 * no cargar código desde otro dominio.
 *
 * Guía: /developers/docs/integration-guide ("Identidad dentro del iFrame").
 */
(function (global) {
    'use strict';

    var VERSION = '1.0.0';

    /** Cada cuánto se repite READY hasta que el portal responde. */
    var READY_INTERVAL_MS = 500;

    /** Tras este tiempo sin respuesta se deja de insistir. */
    var READY_GIVE_UP_MS = 60000;

    /**
     * Duración mínima de una pulsación simulada. Un gesto en modo "toque"
     * llega como tecla abajo y arriba seguidas; sin este mínimo, un juego
     * que consulta el estado de las teclas una vez por fotograma no la vería.
     */
    var MIN_KEY_PRESS_MS = 80;

    /** `KeyboardEvent.keyCode` para los motores que aún lo usan (Phaser, etc.). */
    var LEGACY_KEY_CODES = {
        Backspace: 8,
        Tab: 9,
        Enter: 13,
        ShiftLeft: 16,
        ShiftRight: 16,
        ControlLeft: 17,
        ControlRight: 17,
        AltLeft: 18,
        AltRight: 18,
        Escape: 27,
        Space: 32,
        ArrowLeft: 37,
        ArrowUp: 38,
        ArrowRight: 39,
        ArrowDown: 40,
    };

    function legacyKeyCode(code) {
        if (LEGACY_KEY_CODES[code] !== undefined) {
            return LEGACY_KEY_CODES[code];
        }
        if (/^Key[A-Z]$/.test(code)) {
            return code.charCodeAt(3);
        }
        if (/^Digit[0-9]$/.test(code)) {
            return code.charCodeAt(5);
        }

        return 0;
    }

    function noop() {}

    function normalizeOrigin(value) {
        if (typeof value !== 'string' || value === '' || value === '*') {
            throw new Error(
                'VoutGame.connect: "portalOrigin" es obligatorio y debe ser el origen exacto del portal Vout (nunca "*").',
            );
        }

        return new URL(value).origin;
    }

    /** Ejecuta un callback del juego sin dejar que un fallo suyo rompa el SDK. */
    function call(callback) {
        if (typeof callback !== 'function') {
            return;
        }

        try {
            callback.apply(null, Array.prototype.slice.call(arguments, 1));
        } catch (error) {
            console.error('[VoutGame] Error en un callback del juego:', error);
        }
    }

    function connect(options) {
        options = options || {};

        var portalOrigin = normalizeOrigin(options.portalOrigin);
        var simulateInput = options.simulateInput !== false;

        if (global.parent === global) {
            return {
                embedded: false,
                version: VERSION,
                session: null,
                exit: noop,
                disconnect: noop,
            };
        }

        var session = null;
        var authenticated = false;
        var disconnected = false;
        var startedAt = Date.now();
        var readyTimer = null;
        var cursor = null;
        var heldKeys = {};
        var pendingReleases = {};

        function post(message) {
            global.parent.postMessage(message, portalOrigin);
        }

        // ── Saludo ───────────────────────────────────────────────────────
        // READY se repite hasta el primer VOUT_AUTH: si el portal aún no
        // estaba escuchando cuando arrancó el juego, el primero se pierde.
        function announce() {
            if (authenticated || disconnected) {
                return;
            }
            if (Date.now() - startedAt > READY_GIVE_UP_MS) {
                return;
            }

            var ready = { type: 'READY' };
            if (typeof options.suggestedPreset === 'string') {
                ready.suggestedPreset = options.suggestedPreset;
            }
            post(ready);

            readyTimer = setTimeout(announce, READY_INTERVAL_MS);
        }

        // ── Teclado simulado ─────────────────────────────────────────────
        function inputTarget() {
            return (
                document.activeElement ||
                document.body ||
                document.documentElement
            );
        }

        function dispatchKey(type, code, key) {
            var event = new KeyboardEvent(type, {
                key: key,
                code: code,
                bubbles: true,
                cancelable: true,
                composed: true,
            });
            var legacy = legacyKeyCode(code);

            try {
                Object.defineProperty(event, 'keyCode', {
                    get: function () {
                        return legacy;
                    },
                });
                Object.defineProperty(event, 'which', {
                    get: function () {
                        return legacy;
                    },
                });
            } catch (error) {
                // Navegador que no deja redefinirlos: `key` y `code` bastan.
            }

            inputTarget().dispatchEvent(event);
        }

        function releaseKey(code) {
            var held = heldKeys[code];
            if (!held) {
                return;
            }

            clearTimeout(pendingReleases[code]);
            delete pendingReleases[code];
            delete heldKeys[code];
            dispatchKey('keyup', code, held.key);
        }

        function handleKey(message) {
            var code = message.code;
            var key = message.key;
            var state = message.state;

            if (
                typeof code !== 'string' ||
                typeof key !== 'string' ||
                (state !== 'down' && state !== 'up')
            ) {
                return;
            }

            call(options.onKey, {
                code: code,
                key: key,
                state: state,
                at: message.at,
            });

            if (!simulateInput) {
                return;
            }

            if (state === 'down') {
                // Nueva pulsación con la anterior aún por soltar: se suelta
                // ya, para que el juego vea dos toques y no uno largo.
                if (pendingReleases[code] !== undefined) {
                    releaseKey(code);
                }
                if (heldKeys[code]) {
                    return;
                }

                heldKeys[code] = { key: key, downAt: Date.now() };
                dispatchKey('keydown', code, key);

                return;
            }

            if (!heldKeys[code] || pendingReleases[code] !== undefined) {
                return;
            }

            var remaining =
                MIN_KEY_PRESS_MS - (Date.now() - heldKeys[code].downAt);

            if (remaining <= 0) {
                releaseKey(code);
            } else {
                pendingReleases[code] = setTimeout(function () {
                    releaseKey(code);
                }, remaining);
            }
        }

        function releaseAllKeys() {
            Object.keys(heldKeys).forEach(releaseKey);
        }

        // ── Ratón simulado ───────────────────────────────────────────────
        // El cursor llega normalizado (0 a 1) respecto a la ventana del juego.
        function pointerPosition() {
            var position = cursor || { x: 0.5, y: 0.5 };
            var clientX = position.x * global.innerWidth;
            var clientY = position.y * global.innerHeight;

            return {
                clientX: clientX,
                clientY: clientY,
                target:
                    document.elementFromPoint(clientX, clientY) ||
                    document.body ||
                    document.documentElement,
            };
        }

        function dispatchPointer(type, position, button, pressed) {
            var init = {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: global,
                clientX: position.clientX,
                clientY: position.clientY,
                button: button,
                buttons: pressed ? (button === 2 ? 2 : 1) : 0,
            };
            var isPointerEvent = type.indexOf('pointer') === 0;

            if (isPointerEvent && typeof PointerEvent !== 'function') {
                return;
            }

            if (isPointerEvent) {
                init.pointerId = 1;
                init.pointerType = 'mouse';
                init.isPrimary = true;
            }

            position.target.dispatchEvent(
                isPointerEvent
                    ? new PointerEvent(type, init)
                    : new MouseEvent(type, init),
            );
        }

        function handleCursor(message) {
            if (
                typeof message.x !== 'number' ||
                typeof message.y !== 'number'
            ) {
                return;
            }

            cursor = {
                x: Math.min(1, Math.max(0, message.x)),
                y: Math.min(1, Math.max(0, message.y)),
            };
            call(options.onCursor, cursor.x, cursor.y);

            if (simulateInput) {
                var position = pointerPosition();
                dispatchPointer('pointermove', position, 0, false);
                dispatchPointer('mousemove', position, 0, false);
            }
        }

        function handleClick(message) {
            var button = message.button === 'right' ? 2 : 0;
            var position = pointerPosition();

            call(options.onClick, {
                button: button === 2 ? 'right' : 'left',
                x: position.clientX,
                y: position.clientY,
                at: message.at,
            });

            if (!simulateInput) {
                return;
            }

            dispatchPointer('pointerdown', position, button, true);
            dispatchPointer('mousedown', position, button, true);
            dispatchPointer('pointerup', position, button, false);
            dispatchPointer('mouseup', position, button, false);
            dispatchPointer(
                button === 2 ? 'contextmenu' : 'click',
                position,
                button,
                false,
            );
        }

        // ── Mensajes del portal ──────────────────────────────────────────
        function onMessage(event) {
            if (
                event.origin !== portalOrigin ||
                event.source !== global.parent
            ) {
                return;
            }

            var message = event.data;
            if (!message || typeof message.type !== 'string') {
                return;
            }

            switch (message.type) {
                case 'VOUT_AUTH':
                    if (typeof message.token !== 'string') {
                        return;
                    }
                    authenticated = true;
                    clearTimeout(readyTimer);
                    session = {
                        token: message.token,
                        expiresAt: message.expiresAt,
                        voutId: message.voutId,
                        username: message.username,
                    };
                    call(options.onAuth, session);
                    break;
                case 'VOUT_SESSION_END':
                    session = null;
                    call(options.onSessionEnd, message.reason);
                    break;
                case 'VOUT_ACTION':
                    call(options.onAction, message.event, message.at);
                    break;
                case 'VOUT_ACTION_END':
                    call(options.onActionEnd, message.event, message.at);
                    break;
                case 'VOUT_KEY':
                    handleKey(message);
                    break;
                case 'VOUT_CLICK':
                    handleClick(message);
                    break;
                case 'VOUT_CURSOR':
                    handleCursor(message);
                    break;
                // Cualquier otro tipo se ignora: el protocolo puede crecer.
            }
        }

        global.addEventListener('message', onMessage);
        announce();

        return {
            embedded: true,
            version: VERSION,
            /** Última sesión recibida, o null. Úsala para leer el token vigente. */
            get session() {
                return session;
            },
            /** Pide al portal cerrar el juego y volver al catálogo. */
            exit: function () {
                post({ type: 'EXIT' });
            },
            /** Deja de escuchar al portal y suelta las teclas simuladas. */
            disconnect: function () {
                disconnected = true;
                clearTimeout(readyTimer);
                global.removeEventListener('message', onMessage);
                releaseAllKeys();
            },
        };
    }

    var VoutGame = { connect: connect, version: VERSION };

    global.VoutGame = VoutGame;

    if (typeof module === 'object' && module.exports) {
        module.exports = VoutGame;
    }
})(window);
