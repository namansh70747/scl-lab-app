/**
 * Renders a single distribution curve (WBC / RBC / PLT) exactly as captured from the
 * ERBA H360 — these are the real channel counts transmitted by the analyzer, not a
 * synthetic approximation. If the machine did not transmit a curve, the parent simply
 * does not render this, so a report never shows a fabricated graph.
 */
export function Histogram({
  data,
  title,
  color = "#7b1b1b",
  width = 168,
  height = 64,
}: {
  data: number[];
  title: string;
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const n = data.length;
  const stepX = width / (n - 1);
  const points = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="inline-block">
      <div className="text-[9px] font-bold text-gray-800 mb-0.5">{title}</div>
      <svg width={width} height={height} className="border border-gray-300 bg-white">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} y1={height * g} x2={width} y2={height * g} stroke="#eee" strokeWidth={0.5} />
        ))}
        <polygon points={area} fill={color} fillOpacity={0.12} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function HistogramRow({
  histos,
}: {
  histos: { wbc?: number[]; rbc?: number[]; plt?: number[] } | null | undefined;
}) {
  if (!histos || (!histos.wbc && !histos.rbc && !histos.plt)) return null;
  return (
    <div className="flex flex-wrap gap-4 mt-2">
      {histos.wbc && <Histogram data={histos.wbc} title="WBC Histogram" color="#1e3f8f" />}
      {histos.rbc && <Histogram data={histos.rbc} title="RBC Histogram" color="#7b1b1b" />}
      {histos.plt && <Histogram data={histos.plt} title="PLT Histogram" color="#14743a" />}
    </div>
  );
}
