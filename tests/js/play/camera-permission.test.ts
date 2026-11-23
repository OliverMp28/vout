import { describe, expect, test } from 'bun:test';

import { watchCameraPermission } from '@/lib/play/camera-permission';
import type {
    CameraPermission,
    PermissionsLike,
} from '@/lib/play/camera-permission';

function fakePermissions(initial: string) {
    const listeners = new Set<() => void>();
    const status = {
        state: initial,
        addEventListener: (_type: 'change', listener: () => void) =>
            listeners.add(listener),
        removeEventListener: (_type: 'change', listener: () => void) =>
            listeners.delete(listener),
    };

    return {
        permissions: { query: async () => status } as PermissionsLike,
        change(next: string) {
            status.state = next;
            listeners.forEach((listener) => listener());
        },
        listeners,
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('watchCameraPermission', () => {
    test('lee el permiso y avisa de los cambios', async () => {
        const fake = fakePermissions('prompt');
        const seen: CameraPermission[] = [];

        const stop = watchCameraPermission(
            (state) => seen.push(state),
            fake.permissions,
        );
        await flush();
        fake.change('granted');

        expect(seen).toEqual(['prompt', 'granted']);

        stop();
        expect(fake.listeners.size).toBe(0);
    });

    test('sin la API, o si no conoce la cámara, no se sabe', async () => {
        const seen: CameraPermission[] = [];

        watchCameraPermission((state) => seen.push(state), undefined);
        watchCameraPermission((state) => seen.push(state), {
            query: () => {
                throw new TypeError('camera is not a valid permission name');
            },
        });
        watchCameraPermission((state) => seen.push(state), {
            query: () => Promise.reject(new TypeError('nope')),
        });
        await flush();

        expect(seen).toEqual(['unknown', 'unknown', 'unknown']);
    });

    test('tras dejar de escuchar no avisa', async () => {
        const fake = fakePermissions('granted');
        const seen: CameraPermission[] = [];

        const stop = watchCameraPermission(
            (state) => seen.push(state),
            fake.permissions,
        );
        stop();
        await flush();

        expect(seen).toEqual([]);
    });
});
