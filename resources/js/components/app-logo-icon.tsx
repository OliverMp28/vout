import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* V estilizada con toque gaming/tech */}
            <defs>
                <linearGradient
                    id="vout-grad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >
                    <stop
                        offset="0%"
                        stopColor="var(--vout-gradient-start, #7c3aed)"
                    />
                    <stop
                        offset="100%"
                        stopColor="var(--vout-gradient-end, #a855f7)"
                    />
                </linearGradient>
            </defs>
            <rect rx="8" width="40" height="40" fill="url(#vout-grad)" />
            <path
                d="M12 10L20 30L28 10"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            <circle cx="20" cy="30" r="2" fill="white" />
        </svg>
    );
}
