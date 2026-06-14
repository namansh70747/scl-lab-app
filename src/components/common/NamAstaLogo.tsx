/**
 * NamAsta Diagnostics brand mark.
 *
 * Concept: a laboratory test-tube / sample vial — white glass, bright cyan sample liquid,
 * and a glowing ECG heartbeat "reading" in the empty upper glass. Reads unmistakably as a
 * diagnostics lab. Deep clinical navy→teal tile. The "A" in the wordmark is gold so the
 * brand name pops. Designed to stay legible from 28 px favicon up to full size.
 */
export function NamAstaMark({
  size = 44,
  className,
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const u = "nm";
  return (
    <span
      className={(animated ? "logo-glow " : "") + (className ?? "")}
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: size * 0.27,
        overflow: "hidden",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="NamAsta Diagnostics">
        <defs>
          {/* Clinical deep navy → teal tile */}
          <linearGradient id={`${u}-bg`} x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0c1a3e" />
            <stop offset="0.5" stopColor="#0f2f5e" />
            <stop offset="1" stopColor="#0a3d52" />
          </linearGradient>

          {/* Bright sample liquid */}
          <linearGradient id={`${u}-liquid`} x1="24" y1="24" x2="24" y2="37" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d9f0" />
            <stop offset="1" stopColor="#0891b2" />
          </linearGradient>

          {/* Top-left gloss */}
          <radialGradient id={`${u}-gloss`} cx="0.22" cy="0.1" r="0.85">
            <stop stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Bottom depth glow */}
          <linearGradient id={`${u}-depth`} x1="24" y1="4" x2="24" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="1" stopColor="#0ea5e9" stopOpacity="0.2" />
          </linearGradient>

          {/* Glow for the ECG trace */}
          <filter id={`${u}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Clip the liquid to the inside of the tube so it never spills past the glass */}
          <clipPath id={`${u}-tube`}>
            <path d="M 16.4,12 L 16.4,30 Q 16.4,36.6 24,36.6 Q 31.6,36.6 31.6,30 L 31.6,12 Z" />
          </clipPath>
        </defs>

        {/* ── Tile ── */}
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-bg)`} />
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-depth)`} />
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-gloss)`} />
        <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="12.5" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />

        {/* ── Sample liquid (lower ~45% of the tube), clipped to the glass interior ── */}
        <g clipPath={`url(#${u}-tube)`}>
          <rect x="15" y="25.5" width="18" height="13" fill={`url(#${u}-liquid)`} />
          {/* surface shine */}
          <ellipse cx="24" cy="25.7" rx="7.6" ry="1.5" fill="#bff5ff" opacity="0.55" />
          {/* bubbles */}
          <circle cx="20.3" cy="31" r="1.25" fill="#ffffff" opacity="0.4" />
          <circle cx="27.2" cy="33.2" r="1.6" fill="#ffffff" opacity="0.3" />
          <circle cx="23.4" cy="34.4" r="0.9" fill="#ffffff" opacity="0.35" />
        </g>

        {/* ── Glass tube outline (open top, rounded bottom) ── */}
        <path
          d="M 15,12 L 15,30 Q 15,38 24,38 Q 33,38 33,30 L 33,12"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* mouth rim */}
        <ellipse cx="24" cy="12" rx="9" ry="2.2" stroke="#ffffff" strokeWidth="2.1" fill="none" />

        {/* ── ECG heartbeat reading in the empty upper glass ── */}
        {/* shadow for depth */}
        <path
          d="M 16,19 L 19,19 L 20.8,13.5 L 23,23 L 24.8,19 L 32,19"
          stroke="#000000"
          strokeOpacity="0.28"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* glowing trace */}
        <path
          d="M 16,19 L 19,19 L 20.8,13.5 L 23,23 L 24.8,19 L 32,19"
          stroke="#7df0ff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${u}-glow)`}
        />
        {/* peak node */}
        <circle cx="20.8" cy="13.5" r="1.7" fill="#ffffff" />
        <circle cx="20.8" cy="13.5" r="0.9" fill="#22d3ee" />
      </svg>

      {/* Sheen sweep (animated only) */}
      {animated && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "55%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            animation: "logo-sheen 4.5s ease-in-out infinite",
          }}
        />
      )}
    </span>
  );
}

/** Horizontal lockup: mark + "NamAsta / Diagnostics" wordmark. */
export function NamAstaWordmark({
  size = 40,
  light = false,
  className,
}: {
  size?: number;
  light?: boolean;
  className?: string;
}) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <NamAstaMark size={size} animated={light} />
      <span style={{ lineHeight: 1.05 }}>
        <span
          style={{
            display: "block",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            fontSize: size * 0.46,
            color: light ? "#ffffff" : "#14151c",
          }}
        >
          Nam<span style={{ color: "#f59e0b" }}>A</span>sta
        </span>
        <span
          style={{
            display: "block",
            fontSize: size * 0.235,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: light ? "rgba(255,255,255,0.5)" : "#8a8b97",
          }}
        >
          Diagnostics
        </span>
      </span>
    </span>
  );
}
