/**
 * NamAsta Diagnostics brand mark.
 *
 * Concept: a laboratory blood-sample tube — white glass holding RED BLOOD, with a blood
 * drop above it. Deep maroon tile. Reads instantly as a pathology / blood-test lab, even for
 * non-technical staff. The "A" in the wordmark is gold so the brand name pops on the maroon.
 * Designed to stay legible from a 28 px favicon up to full size.
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
          {/* Rich maroon tile — the brand's red tint */}
          <linearGradient id={`${u}-bg`} x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8e1530" />
            <stop offset="0.5" stopColor="#6a0f22" />
            <stop offset="1" stopColor="#3c0813" />
          </linearGradient>

          {/* Blood — bright scarlet → deep red so it pops against the maroon */}
          <linearGradient id={`${u}-blood`} x1="24" y1="24" x2="24" y2="37" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff5a5f" />
            <stop offset="0.55" stopColor="#ef2b2b" />
            <stop offset="1" stopColor="#b3091a" />
          </linearGradient>

          {/* Drop gradient */}
          <linearGradient id={`${u}-drop`} x1="24" y1="4" x2="24" y2="12" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff6b70" />
            <stop offset="1" stopColor="#d61f2b" />
          </linearGradient>

          {/* Top-left gloss */}
          <radialGradient id={`${u}-gloss`} cx="0.22" cy="0.1" r="0.85">
            <stop stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Clip the blood to the inside of the tube so it never spills past the glass */}
          <clipPath id={`${u}-tube`}>
            <path d="M 16.4,13 L 16.4,30 Q 16.4,36.6 24,36.6 Q 31.6,36.6 31.6,30 L 31.6,13 Z" />
          </clipPath>
        </defs>

        {/* ── Tile ── */}
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-bg)`} />
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-gloss)`} />
        <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="12.5" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />

        {/* ── Blood drop above the tube ── */}
        <path
          d="M 24,4.2 C 25.9,7 27.2,8.6 27.2,10 C 27.2,11.8 25.8,12.9 24,12.9 C 22.2,12.9 20.8,11.8 20.8,10 C 20.8,8.6 22.1,7 24,4.2 Z"
          fill={`url(#${u}-drop)`}
        />
        {/* drop highlight */}
        <ellipse cx="22.9" cy="9.6" rx="0.9" ry="1.4" fill="#ffffff" opacity="0.55" transform="rotate(-20 22.9 9.6)" />

        {/* ── Blood inside the tube (lower ~50%), clipped to the glass interior ── */}
        <g clipPath={`url(#${u}-tube)`}>
          <rect x="15" y="24.5" width="18" height="14" fill={`url(#${u}-blood)`} />
          {/* surface shine */}
          <ellipse cx="24" cy="24.7" rx="7.6" ry="1.5" fill="#ffd0d2" opacity="0.5" />
          {/* darker blood cells / bubbles */}
          <circle cx="20.4" cy="30.5" r="1.3" fill="#7d0512" opacity="0.5" />
          <circle cx="27.1" cy="32.8" r="1.7" fill="#7d0512" opacity="0.45" />
          <circle cx="23.6" cy="34.2" r="0.9" fill="#7d0512" opacity="0.5" />
        </g>

        {/* ── Glass tube outline (open top, rounded bottom) ── */}
        <path
          d="M 15,15 L 15,30 Q 15,38 24,38 Q 33,38 33,30 L 33,15"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* mouth rim */}
        <ellipse cx="24" cy="15" rx="9" ry="2.1" stroke="#ffffff" strokeWidth="2.1" fill="none" />
        {/* soft vertical glass highlight */}
        <path d="M 19,18 L 19,29" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
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
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
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
