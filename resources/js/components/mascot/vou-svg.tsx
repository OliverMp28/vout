export function VouSvg() {
    return (
        <svg
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="vou-svg block h-full w-full overflow-visible"
            aria-hidden="true"
            focusable="false"
        >
            {/* Sparkles — solo visibles en celebrating */}
            <g className="vou-sparkles" aria-hidden>
                <circle cx="14" cy="36" r="1.6" fill="var(--vou-cyan)" />
                <circle cx="88" cy="38" r="2" fill="var(--vou-pink)" />
                <circle cx="22" cy="14" r="1.3" fill="var(--vou-pink)" />
                <circle cx="82" cy="16" r="1.6" fill="var(--vou-cyan)" />
            </g>

            {/* "Zzz" flotante — solo visible en sleeping */}
            <g className="vou-zzz" aria-hidden>
                <text
                    x="80"
                    y="22"
                    fontSize="11"
                    fontWeight="700"
                    fill="var(--vou-stroke)"
                >
                    z
                </text>
            </g>

            {/* Offset shadows behind body — glitch retro-tech feel.
                Misma altura y tamaño en ambas: simétricas, solo difiere la dirección del offset. */}
            <g className="vou-offsets" aria-hidden>
                <rect
                    x="26"
                    y="24"
                    width="58"
                    height="38"
                    rx="2"
                    fill="var(--vou-cyan)"
                />
                <rect
                    x="14"
                    y="28"
                    width="58"
                    height="38"
                    rx="2"
                    fill="var(--vou-pink)"
                />
            </g>

            {/* Main character — breathes as a single group */}
            <g className="vou-body-group">
                {/* Pop-up flash / viewfinder */}
                <rect
                    x="30"
                    y="20"
                    width="12"
                    height="8"
                    rx="1"
                    fill="var(--vou-body)"
                    stroke="var(--vou-stroke)"
                    strokeWidth="2"
                />

                {/* Camera body */}
                <rect
                    x="20"
                    y="28"
                    width="60"
                    height="34"
                    rx="3"
                    fill="var(--vou-body)"
                    stroke="var(--vou-stroke)"
                    strokeWidth="2.5"
                />

                {/* Small secondary lens (left button) */}
                <circle
                    cx="32"
                    cy="45"
                    r="4.5"
                    fill="var(--vou-body)"
                    stroke="var(--vou-stroke)"
                    strokeWidth="2"
                />

                {/* Main lens — blinks. Reflejo tipo luna para evitar look "ojeroso".
                    La lente exterior se escala verticalmente para simular el cierre del ojo,
                    mientras que la pupila+reflejo se ocultan sincronizadamente para evitar
                    el look "tres líneas apiladas" que parecía un glitch. */}
                <g className="vou-lens">
                    <circle
                        cx="59"
                        cy="45"
                        r="13"
                        fill="var(--vou-body)"
                        stroke="var(--vou-stroke)"
                        strokeWidth="2.5"
                    />
                    <g className="vou-pupil">
                        <circle
                            cx="58"
                            cy="44"
                            r="7"
                            fill="var(--vou-stroke)"
                        />
                        <circle
                            cx="61.5"
                            cy="41.5"
                            r="6.3"
                            fill="var(--vou-body)"
                        />
                    </g>
                </g>

                {/* Cuellito / plataforma — ancla visual para las patitas */}
                <rect
                    x="36"
                    y="62"
                    width="28"
                    height="7"
                    rx="1.5"
                    fill="var(--vou-body)"
                    stroke="var(--vou-stroke)"
                    strokeWidth="2.5"
                />

                {/* Pennants / feet — cuelgan desde la plataforma */}
                <g className="vou-feet">
                    <polygon
                        points="38,69 50,69 44,77"
                        fill="var(--vou-body)"
                        stroke="var(--vou-stroke)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                    />
                    <polygon
                        points="50,69 62,69 56,77"
                        fill="var(--vou-body)"
                        stroke="var(--vou-stroke)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                    />
                </g>

                {/* Smile — hidden in idle, revealed on hover (S3).
                    Posicionada debajo del contorno inferior de la lente (y=58)
                    para que se lea como boca y no como un ojo entornado. Curva
                    más pronunciada (depth=3 sobre width=14) para distinguirla
                    del arco circular del ojo. */}
                <path
                    className="vou-smile"
                    d="M 52 60 Q 59 63 66 60"
                    stroke="var(--vou-stroke)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0"
                />
            </g>
        </svg>
    );
}
