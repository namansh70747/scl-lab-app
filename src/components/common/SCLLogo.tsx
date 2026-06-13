/**
 * The SCL mark, redrawn as vector from the lab's printed letterhead:
 * a navy horizontal oval with bold italic "SCL" and the two accent strokes.
 * Scales crisply everywhere (sidebar, login, report fallback, window icon).
 */
export function SCLLogo({ height = 40, color = "#1e3f8f", className }: {
  height?: number;
  color?: string;
  className?: string;
}) {
  const width = height * 1.75;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 80"
      fill="none"
      className={className}
      role="img"
      aria-label="SCL"
    >
      {/* oval */}
      <ellipse cx="70" cy="40" rx="62" ry="30" stroke={color} strokeWidth="7" />
      {/* accent strokes, echoing the hand-inked swooshes on the original */}
      <path d="M4 18 C 28 8, 56 4, 86 6" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M54 74 C 84 77, 112 72, 136 61" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
      {/* SCL */}
      <text
        x="70"
        y="53"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="800"
        fontSize="40"
        letterSpacing="-1"
        fill={color}
      >
        SCL
      </text>
    </svg>
  );
}

/**
 * Modern app mark — a gradient rounded "gem" tile with a stylised blood-drop carrying a
 * heartbeat pulse: instantly reads "diagnostic lab", looks premium in the dark chrome and
 * on the login. Used for on-screen brand surfaces; the printed report keeps the classic
 * SCLLogo vector for letterhead fidelity.
 */
export function SCLMark({ size = 40, className, glow = false }: { size?: number; className?: string; glow?: boolean }) {
  const id = "sclmark";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="SCL"
      style={glow ? { filter: "drop-shadow(0 6px 16px rgba(99,102,241,0.45))" } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d74f5" />
          <stop offset="0.55" stopColor="#5b4be8" />
          <stop offset="1" stopColor="#7b1b1b" />
        </linearGradient>
        <linearGradient id={`${id}-drop`} x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7ecff" />
        </linearGradient>
      </defs>
      {/* tile */}
      <rect x="1" y="1" width="46" height="46" rx="13" fill={`url(#${id}-bg)`} />
      <rect x="1" y="1" width="46" height="46" rx="13" fill="white" fillOpacity="0.04" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="12.5" stroke="white" strokeOpacity="0.14" />
      {/* blood drop */}
      <path
        d="M24 11c4.6 5.2 8 9.3 8 13.6A8 8 0 0 1 16 24.6C16 20.3 19.4 16.2 24 11Z"
        fill={`url(#${id}-drop)`}
      />
      {/* heartbeat pulse across the drop */}
      <path
        d="M17.5 25.2h3l1.7-3.4 2.4 5.3 1.9-3.1h3.2"
        stroke="#6d34c9"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * The single brand mark used EVERYWHERE — sidebar, login, and the report header —
 * so the logo a patient sees on paper is identical to the one staff see in the app.
 * If a custom logo image has been uploaded in Settings → Branding it is used; otherwise
 * the vector SCLLogo is drawn. `chip` wraps it on a white rounded plate so it stays
 * legible on the dark maroon sidebar.
 */
export function BrandLogo({ src, height = 40, chip = false, className }: {
  src?: string | null;
  height?: number;
  chip?: boolean;
  className?: string;
}) {
  const mark = src
    ? <img src={src} alt="SCL" style={{ height, width: "auto" }} className="object-contain" />
    : <SCLLogo height={height} className={chip ? undefined : className} />;
  if (!chip) return src ? <span className={className}>{mark}</span> : mark;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        borderRadius: 10,
        padding: "4px 7px",
        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
      }}
    >
      {mark}
    </span>
  );
}

/** Compact roundel for tight spots (topbar/sidebar at small sizes). */
export function SCLRoundel({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#24479c 0%,#1e3f8f 60%,#16306e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), 0 1px 3px rgba(22,48,110,.4)",
      }}
    >
      <span
        style={{
          color: "#fff",
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          fontWeight: 800,
          fontSize: size * 0.36,
          letterSpacing: "-0.5px",
        }}
      >
        SCL
      </span>
    </div>
  );
}
