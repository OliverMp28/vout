# Contexto Maestro: Ecosistema Vout (Identity & Gaming)

## 1. ¿Qué es Vout? (La Visión General)

Vout (evolución del proyecto anterior "Tout") es el corazón de un ecosistema digital unificado de proyectos personales. No es simplemente un sitio web; es una plataforma híbrida que combina tres pilares fundamentales:

- **Proveedor de Identidad (Identity Provider):** Actúa como el "cerebro" central que gestiona las cuentas de los usuarios. El objetivo es que un usuario cree su cuenta en Vout y pueda usarla automáticamente para identificarse en cualquier otro proyecto relacionado (como el juego Dino), eliminando la necesidad de crear múltiples cuentas para diferentes juegos.
- **Portal de Minijuegos (Estilo Friv):** Es un catálogo organizado donde los usuarios pueden descubrir y jugar diversos títulos directamente desde el navegador.
- **Innovación en Jugabilidad (Visión Artificial):** Vout integra tecnología de vanguardia para permitir que los usuarios controlen los juegos mediante gestos faciales, convirtiendo la cámara web en un mando de juego.

## 2. El Concepto de "Ecosistema de Usuarios"

El problema principal que resuelve Vout es la fragmentación de identidad. En lugar de que cada juego sea una isla aislada, Vout ofrece un "Pasaporte Universal":

- **Autenticación Única (SSO):** Al registrarse en Vout (ya sea de forma nativa o mediante Google, ver campo `google_id` en la tabla `users`), el usuario obtiene una identidad global.
- **Vout como Aval:** Cuando el usuario entra a un proyecto externo como Dino, Vout "le da permiso" al juego para reconocer al usuario, permitiendo que su progreso y rankings se guarden en el lugar correcto de forma automática.
- **Integración con Google:** Vout centraliza la conexión con Google Socialite, de modo que el resto de los juegos no tengan que implementar esta compleja seguridad individualmente.

## 3. La Experiencia de Juego con MediaPipe

Uno de los diferenciadores clave de Vout es el uso de inteligencia artificial para la detección de gestos.

- **Mando Facial:** El sistema detecta movimientos específicos como levantar las cejas, abrir la boca o inclinar la cabeza.
- **Traducción de Acciones:** Vout "traduce" estos gestos en comandos de teclado tradicionales. Por ejemplo, si el usuario levanta las cejas, el sistema envía una señal de "Salto" al juego. Estos controles o lo que ejecuten serán customizables (ver tabla `gesture_configs`).
- **Privacidad y Rendimiento:** Esta detección ocurre directamente en el navegador del usuario y en un hilo de procesamiento separado (Web Worker) para que el juego siempre corra de forma fluida y sin interrupciones.

## 4. Funcionalidades del Portal (Vout Core)

Como proyecto central, Vout se encarga de:

- **Gestión de Perfiles:** Donde los usuarios pueden personalizar su avatar (`avatar` en `users`), ver su historial de juegos y configurar sus preferencias de control facial. Cada usuario tiene su propia configuración de plataforma (tabla `user_settings`: modo oscuro, mascota, gestos habilitados) y su historial de interacción con juegos (tabla pivote `game_user`: favoritos, guardados, puntuación, conteo de partidas).
- **Catálogo y Categorías:** Un sistema robusto para organizar juegos por género, popularidad o desarrollador (creador o creadores del minijuego en cuestión, considerando que no todos los minijuegos web serán desarrollados de manera interna). Un juego puede pertenecer a **múltiples categorías** simultáneamente (relación many-to-many vía tabla pivote `category_game`). Esto se refleja en tablas como `games`, `categories`, `category_game`, `developers`, `developer_game`, etc.
- **Aplicaciones Externas (SSO):** La tabla `registered_apps` almacena las aplicaciones externas del ecosistema autorizadas para usar Vout como proveedor de identidad, incluyendo sus orígenes permitidos para validaciones CORS.
- **Hospedaje de Juegos (iFrames):** Los juegos se ejecutan dentro de Vout de forma segura. Vout actúa como el "anfitrión" que le envía las órdenes de movimiento al juego que el usuario está viendo en pantalla.

## 5. El "Apretón de Manos" Técnico

Para lograr esto, Vout se está construyendo con tecnologías modernas que garantizan seguridad y velocidad:

- **El Motor (Backend):** Laravel 12, que se encarga de la seguridad, la base de datos de usuarios (MariaDB) y la emisión de los "pasaportes" digitales. Laravel Fortify gestiona la autenticación nativa (registro, login, verificación de email, reset de contraseña, 2FA con TOTP).
- **La Interfaz (Frontend):** Una combinación de React e Inertia.js v2 que permite que la navegación por el portal sea instantánea, como si fuera una aplicación móvil, pero con la potencia de una web profesional. Wayfinder genera funciones TypeScript tipadas para las rutas de Laravel.
- **Diseño:** Se utiliza Tailwind CSS v4 para asegurar una interfaz visualmente atractiva, moderna y adaptable a cualquier dispositivo.
- **Testing:** Pest PHP para pruebas de código (unit y feature tests). Pint para formateo automático del código.

## 6. Intención del Proyecto Actual

Actualmente, el trabajo se centra exclusivamente en Vout. El objetivo es:
1. Dejar listo el sistema de identidad.
2. Preparar el motor de visión antes de conectar juegos externos.

**Instrucción para Agentes de IA:**
Cuando trabajes en este proyecto, recuerda que el foco es construir esta base sólida de usuarios (SSO / Proveedor de identidad cruzada) y el sistema de control facial (MediaPipe) que servirá de cimiento para todo el ecosistema futuro. Todo el código desarrollado debe alinearse con esta visión de "Plataforma Central de Identidad y Gaming". No te desvíes creando lógicas para juegos específicos, enfócate en el núcleo (Vout).

## 7. Notas de Entorno y Ejecución para Agentes de IA (CRÍTICO)

1. **Entorno WSL y Navegador:** El proyecto se ejecuta en Ubuntu bajo WSL2 en Windows. Las dependencias del SO y el binario de Chromium para el "Agente Navegador" (Playwright) **ya están instaladas**. El navegador ya funciona localmente en `http://localhost`.
2. **Laravel Sail:** Todo comando back-end se debe ejecutar a través de Sail (`./vendor/bin/sail ...`), nunca llamando a `php` o `artisan` localmente.
3. **Gestor de Paquetes (Bun):** El proyecto usa `bun` para el Front-end. Usa `./vendor/bin/sail bun dev` y `./vendor/bin/sail bun add ...`. Nunca uses `npm`.
