# Contexto Maestro: Ecosistema Vout (Identity & Gaming)

## 1. ¿Qué es Vout? (La Visión General)

Vout (evolución del proyecto anterior "Tout") es el corazón de un ecosistema digital unificado de proyectos personales. No es simplemente un sitio web; es una plataforma híbrida que combina tres pilares fundamentales:

- **Proveedor de Identidad (Identity Provider - IdP):** Actúa como el "cerebro" central que gestiona las cuentas de los usuarios. El objetivo es que un usuario cree su cuenta en Vout y pueda usarla automáticamente para identificarse en cualquier otro proyecto relacionado (como el juego Dino), eliminando la necesidad de crear múltiples cuentas para diferentes juegos.
- **Portal de Minijuegos (Estilo Friv):** Es un catálogo organizado donde los usuarios pueden descubrir y jugar diversos títulos directamente desde el navegador.
- **Innovación en Jugabilidad (Visión Artificial):** Vout integra tecnología de vanguardia para permitir que los usuarios controlen los juegos mediante gestos faciales, convirtiendo la cámara web en un mando de juego.

## 2. El Concepto de "Ecosistema de Usuarios" y Fricción Cero

El problema principal que resuelve Vout es la fragmentación de identidad. En lugar de que cada juego sea una isla aislada, Vout ofrece un "Pasaporte Universal" soportado por estándares de la industria.

La interfaz de Vout (Inertia/React) tiene un diseño premium (Glassmorfismo) para transmitir confianza como Proveedor de Identidad. La transición entre el portal y los juegos debe ser fluida, eliminando la sensación de que son sitios web distintos.

- **Autenticación Centralizada:** Si el usuario usa Google (Socialite) o registro nativo, lo hace una sola vez en el portal central, y esa identidad (su "Llave Maestra") le da acceso a todo el catálogo.
- **Vout como Servidor OAuth2:** El ecosistema utiliza **Laravel Passport** para gestionar la emisión de tokens de acceso seguros.
- **Vinculación (Account Linking):** El campo `Vout_id` (UUID) es el único identificador que otras apps deben usar para reconocer al usuario. Si un usuario tiene un progreso antiguo en un juego como Dino y entra con su nueva cuenta de Vout, se le mostrará una única vez una pantalla amigable para unir su historial previo con su nueva identidad global.

### 2.1. Escenario Standalone (Web Independiente, ej. Dino)
- **Login Externo:** En la web de Dino, el usuario solo verá botones de "Entrar con Vout" y "Entrar con Google".
- **Redirección:** Al pulsar, es redirigido a Vout (OAuth2 Authorize). Vout procesa el login y lo devuelve a Dino ya identificado, logrando una experiencia transparente.

### 2.2. Escenario Embebido (Portal Vout + iFrame)
- **Sincronización Silenciosa:** El usuario que navega por Vout ya tiene su sesión iniciada. Al abrir un minijuego (iFrame), el juego reconoce al usuario automáticamente sin mostrar pantallas de carga o login; simplemente muestra su nombre y progreso desde el primer segundo.

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

## 5. El "Apretón de Manos" Técnico y la Identidad OAuth2

Para lograr esto, Vout utiliza **Laravel 13** como motor principal de identidad para el ecosistema.

- **Motor Dual de Sesión/Tokens:**
    - **Sesión Web Interna:** Gestionada por Laravel Sanctum (Cookies) para la navegación de la propia SPA del portal Vout.
    - **Servidor OAuth2:** Configurado con `php artisan install:api --passport`. Emite tokens JWT (RS256) mediante flujos de **Authorization Code con PKCE** para aplicaciones externas standalone y **Personal Access Tokens** para pruebas.
- **Modelo de Usuario:** El modelo User debe implementar la interfaz `OAuthenticatable` para ser compatible con Passport 13 (`class User extends Authenticatable implements OAuthenticatable { use HasApiTokens; }`).
- **Validación Stateless (Apátrida):** Clientes externos (como Dino) **no consultarán la base de datos de Vout**. Usarán bibliotecas como `lcobucci/jwt` para validar la firma RS256 de los tokens utilizando la clave pública de Vout. Criterios rigurosos de validación: Firma, Emisor (`iss`), Audiencia (`aud`) y Expiración (`exp`).
- **TTL de Tokens:** Los Access Tokens de Passport deben tener un TTL (Time-To-Live) configurado de 60 minutos para asegurar las sesiones de juego activas.

### 5.1. Seguridad en la Integración de iFrames (Handshake READY)

Para comunicar Vout con los minijuegos insertados en su portal web (iFrames), la comunicación y paso de tokens será **sólo por `postMessage`**. Está estrictamente **prohibido el paso de tokens por la URL** (parámetros GET).

1. El iFrame del juego cargará mediante una URL limpia (ej. `https://dino.vout.com/play`).
2. Una vez que el minijuego esté preparado, enviará un mensaje de tipo `{ type: "READY" }` vía `postMessage` hacia Vout (parent).
3. Sólo al recibir la confirmación de "READY", Vout comprobará la fuente y responderá con el Access Token de Passport (y/u otras credenciales necesarias) al iFrame mediante un `postMessage` cifrado y/o con **validación estricta de origen** basada en `allowed_origins`.

## 6. Intención del Proyecto Actual

Actualmente, el trabajo se centra exclusivamente en Vout. El objetivo es:
1. Dejar listo el sistema de identidad usando Passport (SSO).
2. Preparar el motor de visión antes de conectar juegos externos.

**Instrucción para Agentes de IA:**
Cualquier IA o desarrollador que lea esto debe entender que Vout no solo emite tokens, sino que es un servidor OAuth2 completo que garantiza una seguridad de nivel empresarial. Al implementar features, asegúrate de mantener a Dino/Otras Apps como Resource Servers externos sin conexión a la base de datos de Vout, integrando los Handshakes por `postMessage` correctamente según la última directiva, y cuidando la configuración de dominios CORS en Laravel (Fase 1).

## 7. Notas de Entorno y Ejecución para Agentes de IA (CRÍTICO)

1. **Entorno WSL y Navegador:** El proyecto se ejecuta en Ubuntu bajo WSL2 en Windows. Las dependencias del SO y el binario de Chromium para el "Agente Navegador" (Playwright) **ya están instaladas**. El navegador ya funciona localmente en `http://localhost`.
2. **Laravel Sail:** Todo comando back-end se debe ejecutar a través de Sail (`./vendor/bin/sail ...`), nunca llamando a `php` o `artisan` localmente.
3. **Gestor de Paquetes (Bun):** El proyecto usa `bun` para el Front-end. Usa `./vendor/bin/sail bun dev` y `./vendor/bin/sail bun add ...`. Nunca uses `npm`.
