---
version: "1.0.0"
last_updated: "2026-04-18"
---

# Política de Cookies

> **En corto:** Vout sólo usa cookies técnicas (para que el portal funcione) y, si navegas como invitado, una única cookie de preferencia para recordar tu tema entre visitas. **Nada de rastreadores publicitarios ni analítica de terceros.** Si tienes la sesión iniciada, tus preferencias viven en tu cuenta y no en cookies. Puedes revisar tu decisión cuando quieras desde el enlace **«Gestionar cookies»** del pie de página.

## 1. Qué es una cookie y qué cuenta como tal

Una cookie es un pequeño archivo que tu navegador guarda para recordar información entre visitas (por ejemplo, que ya iniciaste sesión). Otras tecnologías como `localStorage` o `sessionStorage` se tratan legalmente igual y también las cubre esta página.

## 2. Cookies que usamos

| Nombre | Tipo | Para qué sirve | Duración |
|---|---|---|---|
| `vout-session` | Técnica | Mantener tu sesión iniciada | 120 minutos de inactividad |
| `XSRF-TOKEN` | Técnica | Protección CSRF de los formularios | Sesión |
| `remember_web_*` | Técnica | Mantenerte recordado si marcaste «recuérdame» | 5 años |
| `appearance` | Preferencia (invitados) / Técnica (logueado) | Recordar tu tema (claro / oscuro / sistema). Si tienes la sesión iniciada, espejo de tu preferencia de cuenta. | 1 año |
| `appearance` (localStorage) | Igual que arriba | Copia local del tema para evitar parpadeo al cargar la página | Hasta que limpies el navegador |
| `sidebar_state` | Técnica | Recordar si tu menú lateral del panel admin está abierto o cerrado. Sólo aparece tras iniciar sesión como administrador y es necesaria para que la interfaz vuelva al estado que elegiste. | 7 días |
| `vout-cookie-consent` | Técnica | Recordar tu decisión sobre las cookies de preferencia | 12 meses |

Todas son **propias** (first-party). Las **técnicas** son indispensables para que el portal funcione (o, en el caso de `sidebar_state` y del `appearance` de cuenta, para que la interfaz refleje preferencias que ya guardaste deliberadamente). Están exentas de consentimiento bajo el artículo 22.2 LSSI-CE. La única **cookie de preferencia** propiamente dicha es `appearance` cuando navegas como invitado: sólo se escribe si la aceptas y se borra si la rechazas.

## 3. Cómo gestionarlas en Vout

- **Si navegas como invitado:** la primera vez verás un aviso en la parte inferior con tres botones de igual peso: **Aceptar**, **Rechazar** y **Preferencias**. Tu elección queda guardada durante 12 meses. El cambio de tema (claro / oscuro / sistema) está disponible desde el botón de tema arriba a la derecha en cualquier página: si aceptaste cookies, se recuerda; si no, sólo dura la sesión actual.
- **Si tienes la sesión iniciada:** no mostramos el banner porque no quedan cookies de preferencia que controlar (tu tema vive en tu cuenta y `sidebar_state` es estado funcional del panel admin). Puedes cambiar tu tema en cualquier momento desde **Configuración → Apariencia** y se guardará en tu perfil, no en una cookie.
- **Reabrir el panel:** desde el enlace «Gestionar cookies» del pie de página puedes consultar siempre el inventario y, como invitado, cambiar tu decisión cuando quieras.
- **Cambios de versión:** si actualizamos esta política o añadimos cookies nuevas, te volveremos a preguntar.

También puedes borrarlas o bloquearlas desde la configuración de tu navegador, o navegar en modo privado/incógnito para que no se almacenen.

## 4. Qué pasa si las rechazas

- Las **cookies técnicas** siguen activas porque sin ellas no podrías iniciar sesión ni navegar de forma segura.
- La **cookie de preferencia `appearance`** deja de escribirse y eliminamos la que ya estuviera guardada. Eso significa que, como invitado, podrás cambiar el tema en la sesión actual pero olvidaremos tu elección al cerrar el navegador. No afecta a tu cuenta (si te registras o inicias sesión, el tema pasa a guardarse en tu perfil) ni a tu progreso en juegos.

## 5. Cesiones a terceros

Hoy Vout **no comparte** ninguna cookie ni dato de cookies con terceros. Si en el futuro añadimos servicios que lo requieran (por ejemplo, una analítica auto-hospedada), quedarán bloqueados hasta que des tu consentimiento mediante el banner.

## 6. Cambios en esta política

Si añadimos, eliminamos o cambiamos el uso de alguna cookie, actualizaremos la fecha de esta página y el banner se reabrirá la siguiente vez que entres para que confirmes tu elección.

## 7. Contacto

Para cualquier duda sobre cookies escríbenos a {{contact_email}}.
