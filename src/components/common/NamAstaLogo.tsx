/**
 * NamAsta Diagnostics — the product brand mark. A lotus (for "namaste") whose petals double
 * as upward growth, sitting on a faint heartbeat pulse, in a premium indigo→violet→cyan gem
 * tile. Used across the app chrome (login, sidebar, activation) and the window icon.
 * (Each customer lab still brands its own printed REPORT separately.)
 */
export function NamAstaMark({ size = 44, className, glow = false }: { size?: number; className?: string; glow?: boolean }) {
  const id = "namasta";
  const petals = [-58, -29, 0, 29, 58];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="NamAsta Diagnostics"
      style={glow ? { filter: "drop-shadow(0 8px 20px rgba(99,102,241,0.55))" } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c83ff" />
          <stop offset="0.5" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={`${id}-petal`} x1="24" y1="13" x2="24" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe3ff" />
        </linearGradient>
      </defs>

      {/* gem tile */}
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill={`url(#${id}-bg)`} />
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#ffffff" fillOpacity="0.05" />
      <rect x="2" y="2" width="44" height="44" rx="12.5" stroke="#ffffff" strokeOpacity="0.18" />

      {/* lotus — 5 petals fanning up from the base */}
      <g>
        {petals.map((deg, i) => (
          <path
            key={deg}
            d="M24 32 C 21 26.5 21 20.5 24 15 C 27 20.5 27 26.5 24 32 Z"
            fill={`url(#${id}-petal)`}
            fillOpacity={i === 2 ? 1 : 0.82}
            transform={`rotate(${deg} 24 32)`}
          />
        ))}
        {/* heartbeat pulse across the base */}
        <path
          d="M11 35.5h6l2-4 3 8 2.5-5.5H35"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/** Horizontal lockup: mark + "NamAsta Diagnostics" wordmark (for login / activation headers). */
export function NamAstaWordmark({ size = 40, light = false, className }: { size?: number; light?: boolean; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <NamAstaMark size={size} glow={light} />
      <span style={{ lineHeight: 1.05 }}>
        <span style={{ display: "block", fontWeight: 800, letterSpacing: "-0.01em", fontSize: size * 0.46, color: light ? "#ffffff" : "#14151c" }}>
          Nam<span style={{ color: light ? "#c7cbff" : "#6366f1" }}>A</span>sta
        </span>
        <span style={{ display: "block", fontSize: size * 0.235, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: light ? "rgba(255,255,255,0.55)" : "#8a8b97" }}>
          Diagnostics
        </span>
      </span>
    </span>
  );
}
