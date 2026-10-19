# Imagen de producción de Vout: nginx + PHP-FPM + worker de colas (s6-overlay).
# Construye desde el repositorio sin nada del host: ni .env, ni vendor, ni node_modules.

FROM serversideup/php:8.5-fpm-nginx-alpine AS base

# ---------------------------------------------------------------------------
# Dependencias PHP (sin dev)
# ---------------------------------------------------------------------------
FROM base AS vendor

USER root
WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress

COPY . .
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/public storage/app/private bootstrap/cache \
    && composer dump-autoload --optimize --classmap-authoritative --no-dev --no-interaction

# ---------------------------------------------------------------------------
# Assets (Vite). Wayfinder necesita PHP + vendor para generar las rutas TS.
# ---------------------------------------------------------------------------
FROM vendor AS assets

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
RUN apk add --no-cache libstdc++ libgcc

ARG VITE_APP_NAME=Vout
ARG VITE_MEDIAPIPE_MODEL_PATH=/models/face_landmarker.task
ENV VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_MEDIAPIPE_MODEL_PATH=${VITE_MEDIAPIPE_MODEL_PATH}

RUN bun install --frozen-lockfile && bun run build

# ---------------------------------------------------------------------------
# Imagen final
# ---------------------------------------------------------------------------
FROM base AS production

USER root

# Worker de colas como servicio s6: arranca tras las automatizaciones de
# Laravel (migraciones, caches) y s6 lo relanza si termina (--max-time).
RUN mkdir -p /etc/s6-overlay/s6-rc.d/laravel-queue/dependencies.d \
    && echo "longrun" > /etc/s6-overlay/s6-rc.d/laravel-queue/type \
    && touch /etc/s6-overlay/s6-rc.d/laravel-queue/dependencies.d/base \
             /etc/s6-overlay/s6-rc.d/laravel-queue/dependencies.d/php-fpm \
             /etc/s6-overlay/user-bundles.d/user/contents.d/laravel-queue \
    && printf '%s\n' \
        '#!/command/with-contenv sh' \
        'cd /var/www/html' \
        'exec php artisan queue:work --sleep=5 --tries=3 --max-time=3600 --memory=128' \
        > /etc/s6-overlay/s6-rc.d/laravel-queue/run \
    && chmod +x /etc/s6-overlay/s6-rc.d/laravel-queue/run

ENV PHP_OPCACHE_ENABLE=1 \
    PHP_OPCACHE_MEMORY_CONSUMPTION=128 \
    PHP_FPM_PM_CONTROL=ondemand \
    PHP_FPM_PM_MAX_CHILDREN=8 \
    PHP_MEMORY_LIMIT=256M \
    PHP_UPLOAD_MAX_FILE_SIZE=8M \
    PHP_POST_MAX_SIZE=8M \
    NGINX_CLIENT_MAX_BODY_SIZE=8M \
    AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60 \
    LOG_CHANNEL=stderr

COPY --chown=www-data:www-data --from=vendor /var/www/html /var/www/html
COPY --chown=www-data:www-data --from=assets /var/www/html/public/build /var/www/html/public/build

USER www-data

EXPOSE 8080
