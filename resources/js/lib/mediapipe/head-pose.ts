/**
 * Head pose extraction from MediaPipe facial transformation matrices.
 *
 * Worker-safe — no DOM or React imports.
 */

import type { HeadPose } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract Euler angles (yaw, pitch, roll) from a 4×4 column-major
 * transformation matrix provided by FaceLandmarker.
 *
 * The returned values are **normalised to the range [-1, 1]** where:
 * - yaw   = left(-1) / right(+1)   — horizontal head rotation
 * - pitch  = down(-1) / up(+1)      — vertical head tilt
 * - roll   = left(-1) / right(+1)   — head lean/tilt
 *
 * @param matrix    - Flat 16-element array (column-major order).
 * @param timestamp - Frame timestamp in ms.
 */
export function extractHeadPose(
    matrix: ArrayLike<number>,
    timestamp: number,
): HeadPose | null {
    if (!matrix || matrix.length < 16) return null;

    // MediaPipe provides a column-major 4×4 matrix. Extract the rotation
    // sub-matrix elements (indices follow column-major layout):
    //
    //  | m0  m4  m8  m12 |
    //  | m1  m5  m9  m13 |
    //  | m2  m6  m10 m14 |
    //  | m3  m7  m11 m15 |

    const m0 = matrix[0];
    const m1 = matrix[1];
    const m2 = matrix[2];
    const m5 = matrix[5];
    const m6 = matrix[6];
    const m9 = matrix[9];
    const m10 = matrix[10];

    // Extract Euler angles (ZYX convention).
    const sy = Math.sqrt(m0 * m0 + m1 * m1);
    const singular = sy < 1e-6;

    let yawRad: number;
    let pitchRad: number;
    let rollRad: number;

    if (!singular) {
        yawRad = Math.atan2(m1, m0);
        pitchRad = Math.atan2(-m2, sy);
        rollRad = Math.atan2(m6, m10);
    } else {
        yawRad = Math.atan2(-m9, m5);
        pitchRad = Math.atan2(-m2, sy);
        rollRad = 0;
    }

    // Convert radians → degrees, then normalise to [-1, 1].
    // Typical comfortable head rotation is ±45° for yaw/pitch, ±30° for roll.
    const yaw = clampNorm(radToDeg(yawRad), 45);
    const pitch = clampNorm(radToDeg(pitchRad), 45);
    const roll = clampNorm(radToDeg(rollRad), 30);

    return { yaw, pitch, roll, timestamp };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
}

/** Normalise a degree value to [-1, 1] given a ± range. */
function clampNorm(degrees: number, maxDeg: number): number {
    return Math.max(-1, Math.min(1, degrees / maxDeg));
}
