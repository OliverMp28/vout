import { router } from '@inertiajs/react';
import { Check, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { CameraPreview } from '@/components/vision/camera-preview';
import { GestureStatusIndicator } from '@/components/vision/gesture-status-indicator';
import { useCamera } from '@/hooks/use-camera';
import { useGestureEngine } from '@/hooks/use-gesture-engine';
import { useTranslation } from '@/hooks/use-translation';
import { PRESET_PLATFORMER } from '@/lib/mediapipe/action-presets';
import { GestureType } from '@/lib/mediapipe/types';
import type { GestureEvent } from '@/lib/mediapipe/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CalibrationWizardProps = {
    /** URL base para guardar la configuración de gestos. */
    saveUrl: string;
    /** Método HTTP para guardar. */
    saveMethod?: 'post' | 'put';
    /** Si ya existe un perfil de gestos activo. */
    hasExistingProfile?: boolean;
    /** Nombre del perfil existente. */
    existingProfileName?: string;
    /** Valor de sensibilidad preconfigurado. */
    initialSensitivity?: number;
};

type WizardStep = 'camera' | 'baseline' | 'test';

const GESTURE_TESTS = [
    { gesture: GestureType.BrowRaise, i18nKey: 'vision.calibration.step3.test_brow' },
    { gesture: GestureType.MouthOpen, i18nKey: 'vision.calibration.step3.test_mouth' },
    { gesture: GestureType.BlinkLeft, i18nKey: 'vision.calibration.step3.test_blink_l' },
    { gesture: GestureType.BlinkRight, i18nKey: 'vision.calibration.step3.test_blink_r' },
    { gesture: GestureType.Smile, i18nKey: 'vision.calibration.step3.test_smile' },
    { gesture: GestureType.BrowFrown, i18nKey: 'vision.calibration.step3.test_brow_frown' },
    { gesture: GestureType.MouthPucker, i18nKey: 'vision.calibration.step3.test_mouth_pucker' },
] as const;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

function CalibrationWizard({
    saveUrl,
    saveMethod = 'post',
    hasExistingProfile = false,
    existingProfileName,
    initialSensitivity = 5,
}: CalibrationWizardProps) {
    const { t } = useTranslation();

    // Modo resumen: si ya existe un perfil, mostrar un resumen en lugar del
    // wizard completo. El usuario puede hacer clic en "Reconfigurar" para
    // entrar en el flujo de wizard.
    const [reconfiguring, setReconfiguring] = useState(false);

    // Estado del wizard — solo el mínimo necesario que no se pueda derivar.
    const [step, setStep] = useState<WizardStep>('camera');
    const [sensitivity, setSensitivity] = useState(initialSensitivity);
    const [detectedGestures, setDetectedGestures] = useState<Set<GestureType>>(new Set());
    const [saving, setSaving] = useState(false);
    // 'idle' | 'capturing' | 'done' — reemplaza los booleans calibrating/calibrated.
    const [calibrationState, setCalibrationState] = useState<'idle' | 'capturing' | 'done'>('idle');

    // El videoRef es propiedad de este componente — se comparte con useCamera y CameraPreview.
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const camera = useCamera({ videoRef });

    const handleGesture = useCallback((event: GestureEvent) => {
        setDetectedGestures((prev) => new Set(prev).add(event.gesture));
    }, []);

    // Callback directo cuando la calibración se completa — evita useEffect con setState.
    const handleCalibrated = useCallback(() => {
        setCalibrationState('done');
        setTimeout(() => setStep('test'), 800);
    }, []);

    const engine = useGestureEngine({
        sensitivity,
        videoRef,
        onGesture: handleGesture,
        onCalibrated: handleCalibrated,
    });

    // Refs para cleanup al desmontar. Se capturan en variable local dentro del effect.
    const engineRef = useRef(engine);
    const cameraRef = useRef(camera);

    useEffect(() => {
        engineRef.current = engine;
        cameraRef.current = camera;
    });

    // -----------------------------------------------------------------------
    // Paso 1: Permiso de cámara
    // -----------------------------------------------------------------------

    const handleEnableCamera = useCallback(async () => {
        const stream = await camera.requestCamera();
        if (stream) {
            // Con perfil existente, saltar directamente a test (la baseline ya
            // fue calibrada previamente). Sin perfil, ir al paso de baseline.
            setStep(hasExistingProfile ? 'test' : 'baseline');
        }
    }, [camera, hasExistingProfile]);

    // -----------------------------------------------------------------------
    // Paso 2: Línea base neutral
    // -----------------------------------------------------------------------

    // Re-conectar el stream al <video> cuando cambia de paso.
    // Cada paso renderiza un CameraPreview nuevo (= <video> nuevo), pero el
    // stream se obtuvo con el <video> del paso anterior, que ya se destruyó.
    useEffect(() => {
        if (camera.status === 'active') {
            camera.reattachStream();
        }
    }, [step, camera]);

    // Auto-iniciar el motor de detección al entrar en el paso baseline o test,
    // siempre que la cámara esté activa y el motor no esté corriendo.
    useEffect(() => {
        if ((step === 'baseline' || step === 'test') && camera.status === 'active' && engine.status === 'idle' && videoRef.current) {
            engine.startDetection(videoRef.current);
        }
    }, [step, camera.status, engine]);

    const handleCaptureBaseline = useCallback(() => {
        // Solo capturar si el motor ya está corriendo — el botón está deshabilitado
        // mientras carga, pero este guard previene race conditions.
        if (engine.status !== 'running') return;

        setCalibrationState('capturing');
        engine.calibrateNeutral();
    }, [engine]);

    // -----------------------------------------------------------------------
    // Paso 3: Guardar
    // -----------------------------------------------------------------------

    const handleSave = useCallback(() => {
        setSaving(true);

        // Usar el preset de plataformas como mapeo por defecto.
        // El usuario puede personalizarlo después en el GestureMappingEditor.
        const data = {
            profile_name: existingProfileName ?? 'Default',
            detection_mode: 'face_landmarks',
            sensitivity,
            gesture_mapping: PRESET_PLATFORMER.mapping,
            head_tracking_mode: PRESET_PLATFORMER.headTrackingMode,
            is_active: true,
        };

        router[saveMethod](saveUrl, data, {
            preserveScroll: true,
            onSuccess: () => {
                // Liberar cámara y motor — en modo resumen ya no hacen falta.
                engineRef.current.stopDetection();
                cameraRef.current.stopCamera();
                setReconfiguring(false);
            },
            onFinish: () => setSaving(false),
        });
    }, [saveUrl, saveMethod, sensitivity, existingProfileName]);

    // Cleanup al desmontar — capturar valor actual de la ref en variable local
    // para que el cleanup detenga el objeto correcto incluso si la ref cambia.
    useEffect(() => {
        const currentEngine = engineRef.current;
        const currentCamera = cameraRef.current;
        return () => {
            currentEngine.stopDetection();
            currentCamera.stopCamera();
        };
    }, []);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Modo resumen: perfil existente sin estar reconfigurando
    // -----------------------------------------------------------------------

    if (hasExistingProfile && !reconfiguring) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <h3 className="text-base font-medium">{t('vision.calibration.title')}</h3>

                <div className="flex items-center gap-4 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                            {existingProfileName ?? 'Default'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {t('vision.calibration.summary_sensitivity')}: {initialSensitivity}/10
                        </p>
                    </div>
                </div>

                <Button
                    variant="secondary"
                    onClick={() => setReconfiguring(true)}
                >
                    <RotateCcw className="size-4" />
                    {t('vision.calibration.reconfigure')}
                </Button>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Modo wizard: flujo de 3 pasos
    // -----------------------------------------------------------------------

    const stepIndex = step === 'camera' ? 0 : step === 'baseline' ? 1 : 2;
    const progressPercent = ((stepIndex + 1) / 3) * 100;

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-medium">{t('vision.calibration.title')}</h3>
                    {hasExistingProfile && existingProfileName && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {t('vision.calibration.active_profile')}: {existingProfileName}
                        </p>
                    )}
                </div>
                <GestureStatusIndicator status={engine.status} />
            </div>

            <Progress value={progressPercent} className="h-1.5" />

            {/* Paso 1: Cámara */}
            {step === 'camera' && (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">{t('vision.calibration.step1.title')}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('vision.calibration.step1.desc')}
                        </p>
                    </div>

                    <CameraPreview ref={videoRef} active={camera.status === 'active'} compact />

                    {camera.status === 'denied' && (
                        <p className="text-sm text-destructive">{t('vision.calibration.step1.denied')}</p>
                    )}

                    <Button onClick={handleEnableCamera} disabled={camera.status === 'requesting'}>
                        {camera.status === 'requesting' && <Loader2 className="size-4 animate-spin" />}
                        {t('vision.calibration.step1.button')}
                    </Button>
                </div>
            )}

            {/* Paso 2: Baseline */}
            {step === 'baseline' && (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">{t('vision.calibration.step2.title')}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('vision.calibration.step2.desc')}
                        </p>
                    </div>

                    <CameraPreview ref={videoRef} active={camera.status === 'active'} compact />

                    <Button
                        onClick={handleCaptureBaseline}
                        disabled={calibrationState !== 'idle' || engine.status !== 'running'}
                    >
                        {(calibrationState === 'capturing' || engine.status === 'loading') && (
                            <Loader2 className="size-4 animate-spin" />
                        )}
                        {calibrationState === 'done' && <Check className="size-4" />}
                        {engine.status === 'loading'
                            ? t('vision.status.loading')
                            : calibrationState === 'capturing'
                                ? t('vision.calibration.step2.capturing')
                                : calibrationState === 'done'
                                    ? t('vision.calibration.step2.done')
                                    : t('vision.calibration.step2.button')}
                    </Button>
                </div>
            )}

            {/* Paso 3: Test de gestos */}
            {step === 'test' && (
                <div className="space-y-5">
                    <div>
                        <p className="text-sm font-medium">{t('vision.calibration.step3.title')}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('vision.calibration.step3.desc')}
                        </p>
                    </div>

                    <div className="flex flex-col items-start gap-5 sm:flex-row">
                        <CameraPreview ref={videoRef} active={camera.status === 'active'} compact />

                        <div className="w-full space-y-3 sm:max-h-48 sm:overflow-y-auto sm:pr-1">
                            {GESTURE_TESTS.map(({ gesture, i18nKey }) => {
                                const detected = detectedGestures.has(gesture);
                                return (
                                    <div
                                        key={gesture}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200',
                                            detected
                                                ? 'border-green-500/50 bg-green-500/5'
                                                : 'border-border/50 bg-background/50',
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'flex size-5 items-center justify-center rounded-full transition-colors',
                                                detected ? 'bg-green-500 text-white' : 'bg-muted',
                                            )}
                                        >
                                            {detected && <Check className="size-3" />}
                                        </div>
                                        <span className="text-sm">{t(i18nKey)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>{t('vision.calibration.step3.sensitivity')}</Label>
                            <span className="text-sm tabular-nums text-muted-foreground">
                                {sensitivity}/10
                            </span>
                        </div>
                        <Slider
                            value={[sensitivity]}
                            onValueChange={([v]) => setSensitivity(v)}
                            min={1}
                            max={10}
                            step={1}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            {saving ? t('vision.calibration.saving') : t('vision.calibration.save')}
                            {!saving && <ChevronRight className="size-4" />}
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => {
                                // Detener motor y cámara para un reinicio limpio.
                                engine.stopDetection();
                                camera.stopCamera();
                                setDetectedGestures(new Set());
                                setCalibrationState('idle');
                                setStep('camera');
                            }}
                        >
                            <RotateCcw className="size-4" />
                            {t('vision.calibration.reconfigure')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export { CalibrationWizard };
