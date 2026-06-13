/**
 * NamAsta Diagnostics brand mark — a glossy gem tile with a bold "N" whose diagonal is a
 * glowing DNA/pulse strand carrying signal nodes (diagnostics). Layered gloss + a sheen sweep
 * + a breathing glow make it feel alive. Used across the app chrome and the window icon.
 * (Each customer lab brands its own printed REPORT separately.)
 */
export function NamAstaMark({ size = 44, className, animated = false }: { size?: number; className?: string; animated?: boolean }) {
  const u = "nm";
  return (
    <span
      className={(animated ? "logo-glow " : "") + (className ?? "")}
      style={{ position: "relative", display: "inline-flex", width: size, height: size, borderRadius: size * 0.27, overflow: "hidden" }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="NamAsta Diagnostics">
        <defs>
          <linearGradient id={`${u}-bg`} x1="3" y1="2" x2="45" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7c83ff" />
            <stop offset="0.52" stopColor="#6d28d9" />
            <stop offset="1" stopColor="#0e7490" />
          </linearGradient>
          <linearGradient id={`${u}-strand`} x1="15" y1="15" x2="33" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a5f3fc" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id={`${u}-gloss`} cx="0.28" cy="0.16" r="0.9">
            <stop stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* tile + gloss */}
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-bg)`} />
        <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${u}-gloss)`} />
        <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="12.4" stroke="#ffffff" strokeOpacity="0.22" />

        {/* monogram N — white uprights + glowing cyan signal diagonal with nodes */}
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M15.5 33.5 V 14.5" stroke="#ffffff" strokeWidth="4.4" />
          <path d="M32.5 33.5 V 14.5" stroke="#ffffff" strokeWidth="4.4" />
          <path d="M15.5 14.5 L 32.5 33.5" stroke="#0e1230" strokeOpacity="0.25" strokeWidth="6.2" />
          <path d="M15.5 14.5 L 32.5 33.5" stroke={`url(#${u}-strand)`} strokeWidth="4.2" />
        </g>
        <circle cx="20.2" cy="19.8" r="1.9" fill="#ffffff" />
        <circle cx="27.8" cy="28.2" r="1.9" fill="#ffffff" />
      </svg>

      {/* sheen sweep (animated only) */}
      {animated && (
        <span
          aria-hidden
          style={{
            position: "absolute", top: 0, bottom: 0, width: "55%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
            animation: "logo-sheen 4.5s ease-in-out infinite",
          }}
        />
      )}
    </span>
  );
}

/** Horizontal lockup: mark + "NamAsta Diagnostics" wordmark (login / onboarding headers). */
export function NamAstaWordmark({ size = 40, light = false, className }: { size?: number; light?: boolean; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <NamAstaMark size={size} animated={light} />
      <span style={{ lineHeight: 1.05 }}>
        <span style={{ display: "block", fontWeight: 800, letterSpacing: "-0.01em", fontSize: size * 0.46, color: light ? "#ffffff" : "#14151c" }}>
          Nam<span style={{ color: light ? "#67e8f9" : "#0891b2" }}>A</span>sta
        </span>
        <span style={{ display: "block", fontSize: size * 0.235, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: light ? "rgba(255,255,255,0.55)" : "#8a8b97" }}>
          Diagnostics
        </span>
      </span>
    </span>
  );
}
