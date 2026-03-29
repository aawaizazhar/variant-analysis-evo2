"use client";

import { useId } from "react";
import { cn } from "~/lib/utils";

export function VariantLogo({ className }: { className?: string }) {
  const backgroundGradientId = useId();
  const borderGradientId = useId();
  const microPatternId = useId();
  const haloGradientId = useId();
  const accentGradientId = useId();
  const textGradientId = useId();
  const displayFace =
    "var(--font-display, 'Space Grotesk', 'Sora', 'IBM Plex Sans', sans-serif)";

  return (
    <div
      className={cn(
        "logo-glow inline-flex items-center rounded-[32px] border border-white/10 bg-card/60 px-6 py-5 shadow-[0_20px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl",
        className,
      )}
    >
      <svg
        role="img"
        aria-label="DNAAnalyzer logo"
        viewBox="0 0 280 86"
        className="text-foreground h-16 w-[17rem] max-w-full"
        xmlns="http://www.w3.org/2000/svg"
        textRendering="geometricPrecision"
      >
        <defs>
          <linearGradient
            id={backgroundGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#080b12" />
            <stop offset="100%" stopColor="#0c121d" />
          </linearGradient>
          <linearGradient
            id={borderGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="rgba(0, 214, 143, 0.4)" />
            <stop offset="55%" stopColor="rgba(139, 92, 246, 0.4)" />
            <stop offset="100%" stopColor="rgba(24, 37, 65, 0.6)" />
          </linearGradient>
          <pattern
            id={microPatternId}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 10H20M10 0V20"
              stroke="rgba(98,107,132,0.15)"
              strokeWidth="0.5"
            />
            <circle cx="10" cy="10" r="1.8" fill="rgba(200,208,222,0.4)" />
          </pattern>
          <radialGradient id={haloGradientId} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="rgba(0, 214, 143, 0.15)" />
            <stop offset="70%" stopColor="rgba(0, 214, 143, 0.05)" />
            <stop offset="100%" stopColor="rgba(0, 214, 143, 0)" />
          </radialGradient>
          <linearGradient id={accentGradientId} x1="18" y1="12" x2="78" y2="72">
            <stop offset="0%" stopColor="#00d68f" />
            <stop offset="60%" stopColor="#b8f0d8" />
            <stop offset="100%" stopColor="#00d68f" />
          </linearGradient>
          <linearGradient id={textGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <filter
            id="glow"
            x="24"
            y="14"
            width="56"
            height="60"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x="2"
          y="2"
          width="276"
          height="82"
          rx="26"
          fill={`url(#${backgroundGradientId})`}
          stroke={`url(#${borderGradientId})`}
          strokeWidth="2"
        />
        <rect
          x="5"
          y="5"
          width="270"
          height="76"
          rx="24"
          fill={`url(#${microPatternId})`}
          opacity="0.25"
        />
        <ellipse
          cx="86"
          cy="43"
          rx="55"
          ry="34"
          fill={`url(#${haloGradientId})`}
          opacity="0.6"
        />

        <g filter="url(#glow)">
          <path
            d="M34 24L52 62L70 24"
            stroke={`url(#${accentGradientId})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M39 32C52 32 62 32 75 32"
            stroke={`url(#${accentGradientId})`}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />
          <circle cx="34" cy="24" r="4" fill="#00d68f" />
          <circle cx="70" cy="24" r="4" fill="#00d68f" />
          <circle cx="52" cy="62" r="4" fill="#8b5cf6" />
        </g>

        <g
          opacity="0.32"
          stroke={`url(#${accentGradientId})`}
          strokeWidth="1.1"
        >
          <path
            d="M26 40C50 20 54 20 78 40"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M26 50C42 68 62 68 78 50"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="52" cy="44" r="12" fill="none" />
          <circle cx="52" cy="44" r="3" fill="#00d68f" fillOpacity="0.8" />
        </g>

        <text
          x="100"
          y="46"
          fill={`url(#${textGradientId})`}
          fontSize="30"
          fontWeight={600}
          style={{ fontFamily: displayFace, letterSpacing: "0.12em" }}
        >
          VARIANT
        </text>
        <text
          x="100"
          y="64"
          fill="#94a3b8"
          fontSize="15"
          fontWeight={500}
          style={{
            fontFamily: displayFace,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
          }}
        >
          ANALYSIS LAB
        </text>
      </svg>
    </div>
  );
}
