---
version: "1.0.0"
last_updated: "2026-04-18"
---

# Política de Privacidad

> **En corto:** recogemos lo mínimo para que el portal funcione, no vendemos tus datos, no usamos rastreadores publicitarios y **nunca enviamos al servidor las imágenes de tu cámara**. Tienes derecho a descargar tus datos y a borrar tu cuenta desde `Ajustes → Privacidad` cuando quieras.

## 1. Quién es el responsable del tratamiento

- **Responsable:** {{holder_name}}, persona física, {{domain}}.
- **Contacto de privacidad:** {{contact_email}}
- **Delegado de Protección de Datos (DPO):** no aplica. Este proyecto no alcanza los umbrales del artículo 37 del RGPD y del artículo 34 de la LOPDGDD para nombrar DPO.

Si tienes cualquier duda sobre tus datos, escribe a {{contact_email}}. No hay formularios burocráticos — un email vale.

## 2. Qué datos recogemos y por qué

Sólo guardamos lo que realmente usamos. Esta es la tabla completa, derivada de la propia base de datos de Vout:

### 2.1. Datos de tu cuenta

| Dato | Cuándo lo recogemos | Por qué lo necesitamos | Base legal |
|---|---|---|---|
| **Nombre**, **nombre de usuario**, **email**, **contraseña** | Al registrarte con email | Identificarte, autenticarte y contactarte si hay algo importante con tu cuenta | Ejecución del contrato (art. 6.1.b RGPD) |
| **Email**, **nombre**, **avatar** (URL de Google), **Google ID** | Al registrarte con Google (Socialite) | Crear tu cuenta con un clic; evitarte recordar otra contraseña | Consentimiento (art. 6.1.a RGPD) |
| **`vout_id`** (UUID único) | Automático al crear la cuenta | Es el identificador que otras apps del ecosistema ven de ti — así no tenemos que exponer tu ID interno | Ejecución del contrato |
| **Biografía** (hasta 500 caracteres), **avatar** propio (imagen hasta 2 MB) | Si tú los rellenas en tu perfil | Personalizar tu presencia en el portal | Consentimiento |
| **Email verificado**, **tokens 2FA** (cifrados), **token "recuérdame"** | Automático al verificar el email / activar 2FA / marcar "recuérdame" | Seguridad de tu cuenta | Ejecución del contrato |

Las **contraseñas** se guardan cifradas con bcrypt. Los **secretos de 2FA** se cifran en base de datos. Nadie, ni siquiera el administrador del portal, puede leerlos en claro.

### 2.2. Preferencias y actividad dentro del portal

| Dato | Por qué lo guardamos |
|---|---|
| Tema claro/oscuro, estado del sidebar, mascota activada, idioma preferido | Recordar tus preferencias entre sesiones |
| Juegos favoritos, juegos guardados, partidas jugadas, mejor puntuación por juego, última vez que jugaste | Personalizar tu dashboard y mostrarte "Continuar jugando" |
| Configuraciones de gestos (nombre del perfil, sensibilidad 1-10, mapeo tecla↔gesto) | Guardar tu calibración de control facial para que no tengas que repetirla en cada sesión |

**Base legal:** ejecución del contrato (art. 6.1.b) o interés legítimo (art. 6.1.f) para mejorar tu experiencia. Puedes revocar estas preferencias borrando tu cuenta o cambiándolas desde `Ajustes`.

### 2.3. Datos técnicos de la sesión

Cuando navegas por el portal, el servidor registra:

- Tu **dirección IP** (v4 o v6) y **user agent** (navegador + sistema operativo), dentro de la tabla `sessions`, para mantener tu sesión iniciada.
- Eventos de acceso a `/auth/*` en los **logs del servidor**, durante 14 días, para detectar abusos y problemas.

Estos datos son los mínimos necesarios para operar un servicio web seguro. **Base legal:** interés legítimo (art. 6.1.f RGPD) en mantener la seguridad e integridad del sistema.

### 2.4. Datos que **NO** recogemos

Para que quede claro, aquí tienes una lista de cosas que otros portales piden y nosotros **no**:

- ❌ **Fecha de nacimiento** o edad exacta. Sólo te pedimos que declares ser mayor de 14 años (consentimiento digital en España).
- ❌ **Género**, **ubicación geográfica**, **teléfono**.
- ❌ **Datos bancarios, tarjetas, compras**. Vout no cobra por nada.
- ❌ **Analíticas de terceros**: no usamos Google Analytics, ni Meta Pixel, ni Hotjar, ni Mixpanel, ni GTM, ni nada parecido.
- ❌ **Datos biométricos**. La visión artificial procesa los frames en tu navegador (ver §6).

## 3. Datos que compartimos con terceros

Sí hay transferencias, y queremos que las conozcas todas:

| Destinatario | Qué recibe | Para qué | Base legal |
|---|---|---|---|
| **Google** (cuando entras con "Entrar con Google") | Google sabe que te has autenticado en Vout. Vout recibe de Google: `google_id`, email, nombre y URL del avatar. Usamos los scopes `openid profile email` (los que vienen por defecto, no pedimos más). | Iniciar sesión con SSO | Tu consentimiento al pulsar el botón |
| **Proveedor de email transaccional** | Tu email y nombre | Enviarte verificación de cuenta, reset de contraseña, notificaciones de moderación | Ejecución del contrato |
| **Aplicaciones del ecosistema OAuth** que tú autorizas | Sólo lo que el scope que apruebes permite: `user:read` → `vout_id`, nombre, username, avatar. `user:email` → además el email. `games:read`/`games:write` → tu historial y puntuaciones. **Nunca se comparte** tu email con apps que no tengan `user:email`, ni tu password, ni tu `google_id`, ni tu IP, ni tus secretos 2FA. | Que puedas usar tu identidad Vout en otras apps (p. ej. un juego publicado por un tercero) | Tu consentimiento explícito en la pantalla de "Autorizar aplicación" |
| **Proveedor de hosting** | Todos los datos anteriores, como encargado del tratamiento | Alojar la base de datos y los servidores | Contrato de encargo (art. 28 RGPD) |

Nunca vendemos ni cedemos tus datos para marketing o publicidad a terceros.

### 3.1. Transferencias internacionales

Google LLC opera en Estados Unidos, pero cumple con las cláusulas contractuales tipo de la Comisión Europea y con el marco de adecuación UE-EE.UU. (DPF). Esto permite la transferencia dentro de la legalidad.

Nuestro proveedor de hosting se ubica en la UE o en países con decisión de adecuación. Si alguna vez cambiamos de proveedor fuera de esas zonas, actualizaremos esta sección y te avisaremos.

## 4. Cuánto tiempo guardamos tus datos

| Dato | Retención |
|---|---|
| Datos de tu cuenta mientras esté activa | Indefinida, hasta que la borres o la cerremos por uso indebido |
| Datos de tu cuenta tras eliminarla | Se purgan inmediatamente. Los juegos que hubieras enviado como desarrollador permanecen publicados pero sin asociarte (se anonimizan) |
| Cookies de sesión | 120 minutos de inactividad |
| Cookie "recuérdame" | 5 años si marcas la opción |
| Logs del servidor | 14 días |
| Registros de auditoría (acciones de administración) | 180 días |

## 5. Tus derechos — y cómo ejercerlos

El RGPD te da **derechos fuertes** sobre tus datos. Con Vout puedes ejercerlos así:

| Derecho | Qué significa | Cómo ejercerlo |
|---|---|---|
| **Acceso** | Saber qué datos tuyos tenemos | Pídelo a {{contact_email}} o descárgalo desde `Ajustes → Privacidad → Exportar mis datos` (devuelve un JSON con todo) |
| **Portabilidad** | Descargar tus datos en un formato estructurado y reutilizable | El mismo export JSON cumple el art. 20 RGPD |
| **Rectificación** | Corregir datos incorrectos | Actualiza tu perfil desde `Ajustes → Perfil` o escríbenos |
| **Supresión / "derecho al olvido"** | Borrar tus datos | `Ajustes → Privacidad → Eliminar mi cuenta` o a {{contact_email}}. La acción es inmediata e irreversible |
| **Oposición** al tratamiento | Dejar de tratar tus datos en ciertos casos | Escríbenos a {{contact_email}} explicando tu situación |
| **Limitación** del tratamiento | Congelar el uso de tus datos mientras revisamos algo | Lo mismo, por email |
| **Retirar el consentimiento** | Retirar consentimientos dados (p. ej. al conectar Google) | Desvincula tu cuenta desde `Ajustes` o pídelo por email |

Si crees que no estamos respetando estos derechos, puedes reclamar ante la **Agencia Española de Protección de Datos (AEPD)**: [www.aepd.es](https://www.aepd.es/). Pero por favor, avísanos primero — casi seguro que podemos resolverlo.

## 6. Visión artificial (MediaPipe): qué hacemos y qué NO hacemos

Este es uno de los puntos más sensibles y queremos dejarlo **cristalino**.

Cuando activas los controles por gestos faciales:

- Tu **cámara sólo se enciende** si tú pulsas el botón "Activar". Sin ese clic explícito, no tocamos el hardware.
- El análisis de la imagen lo hace **MediaPipe FaceLandmarker en tu navegador**, dentro de un Web Worker aislado. **Los frames de vídeo jamás salen de tu dispositivo.**
- Lo que guardamos en nuestra base de datos es **sólo configuración numérica**: un nombre de perfil, un valor de sensibilidad (1-10) y un JSON con el mapeo "este gesto dispara esta tecla". **No hay vectores biométricos, ni landmarks, ni imágenes, ni plantillas faciales.**
- Cuando cierras la pestaña o sales del juego, el stream de cámara se detiene inmediatamente.

Esto encaja con el **principio de minimización del RGPD (art. 5.1.c)** y con las directrices de la AEPD sobre biometría (**procesamiento local, edge computing**). No tratamos datos biométricos del artículo 9 del RGPD porque no almacenamos ni procesamos centralizadamente ningún rasgo que permita identificar a una persona de forma unívoca.

Puedes desactivar la función en cualquier momento desde `Ajustes → Apariencia → Controles por gestos`. Al hacerlo se deshabilita el worker y no volveremos a pedir acceso a la cámara hasta que la actives de nuevo.

## 7. Menores de edad

Vout requiere tener **al menos 14 años** para crear una cuenta (artículo 7 de la LOPDGDD, edad de consentimiento digital en España). Si descubrimos que una cuenta pertenece a un menor de 14 años, la eliminaremos sin previo aviso.

Los juegos del catálogo son accesibles **sin cuenta** para cualquier edad. La restricción de edad se aplica sólo al registro y a la sincronización de progreso.

## 8. Seguridad

Aplicamos medidas técnicas razonables para un proyecto de este tamaño:

- Contraseñas hasheadas con bcrypt, no en texto plano.
- Cookies `HttpOnly` y `SameSite=lax` para protegerlas del acceso desde JavaScript.
- 2FA opcional con TOTP.
- Protección CSRF en todos los formularios y endpoints.
- Tokens OAuth firmados con RS256 y TTL corto (60 minutos).
- HTTPS en producción.
- Validación estricta de orígenes (CORS) para las APIs del ecosistema.

Ningún sistema es invulnerable al 100%. Si detectas un problema de seguridad, escríbenos antes de hacerlo público a {{contact_email}} — preferimos arreglarlo rápido y agradecerte en los créditos del repo.

## 9. Cambios en esta política

Si cambiamos algo sustancial de esta política (p. ej. añadimos un nuevo tipo de dato, un nuevo destinatario o cambiamos la retención), actualizaremos la fecha de arriba y te pediremos que la vuelvas a aceptar la próxima vez que entres. Los cambios menores (erratas, mejoras de redacción) sólo actualizarán la fecha.

## 10. Contacto

Para cualquier cuestión sobre tus datos: **{{contact_email}}**.
