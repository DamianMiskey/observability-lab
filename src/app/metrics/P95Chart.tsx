"use client";

import { useRef, useState } from "react";
import { NotConfigured } from "@/components/telemetry";
import { Button } from "@/components/ui";

type Series = { platform: string; points: [number, number][] };

// Colour follows the platform, never its rank: Vercel is always slot 1.
const STYLE: Record<string, { name: string; colour: string }> = {
  vercel: { name: "Vercel", colour: "var(--series-1)" },
  "cloudflare-workers": { name: "Workers", colour: "var(--series-2)" },
};
const style = (p: string) => STYLE[p] ?? { name: p, colour: "var(--muted)" };

const W = 640, H = 220, PAD = { l: 56, r: 72, t: 12, b: 24 };
const axis = (ms: number) => (ms >= 1000 ? `${+(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const time = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** A round, readable top for the y-axis. */
function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  return Math.ceil(v / step) * step;
}

// p95 over the last six hours, one line per platform. A crosshair follows the
// pointer and a readout lists every platform at that time.
export function P95Chart() {
  const [series, setSeries] = useState<Series[] | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "notConfigured" | string>("idle");
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const load = async () => {
    setState("busy");
    const r = await fetch("/api/metrics?q=p95", { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return setState("notConfigured");
    if (!r.ok) return setState(body.error);
    setSeries((body.series as Series[]).filter((s) => s.points.length).sort((a, b) => (a.platform === "vercel" ? -1 : b.platform === "vercel" ? 1 : 0)));
    setState("idle");
  };

  const all = series?.flatMap((s) => s.points) ?? [];
  const t0 = Math.min(...all.map(([t]) => t)), t1 = Math.max(...all.map(([t]) => t));
  const yMax = niceMax(Math.max(...all.map(([, v]) => v), 1));
  const x = (t: number) => PAD.l + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const times = [...new Set(all.map(([t]) => t))].sort((a, b) => a - b);

  const onMove = (e: React.MouseEvent) => {
    const box = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = times[0];
    for (const t of times) if (Math.abs(x(t) - px) < Math.abs(x(best) - px)) best = t;
    setHover(best ?? null);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading metrics…" : series ? "Refresh" : "Show the last six hours"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {state === "notConfigured" && <NotConfigured />}
        {state !== "busy" && state !== "idle" && state !== "notConfigured" && <p className="m-0 text-sm text-danger">{state}</p>}
        {series && (series.length === 0 ? <p className="m-0 text-sm text-muted">No requests in the last six hours.</p> : (
          <figure className="m-0" data-testid="p95-chart">
            <ul className="m-0 mb-1 flex list-none gap-4 p-0 text-xs text-muted">
              {series.map((s) => (
                <li key={s.platform} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 rounded" style={{ background: style(s.platform).colour }} aria-hidden="true" />{style(s.platform).name}
                </li>
              ))}
            </ul>
            <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none" role="img"
              aria-label={`p95 response time over the last six hours: ${series.map((s) => `${style(s.platform).name} latest ${s.points.at(-1)?.[1]} ms`).join(", ")}`}
              onPointerMove={onMove} onClick={onMove} onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}>
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--line)" strokeWidth="1" />
                  <text x={PAD.l - 6} y={y(yMax * f) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{axis(yMax * f)}</text>
                </g>
              ))}
              <text x={PAD.l} y={H - 6} fontSize="11" fill="var(--muted)">{time(t0)}</text>
              <text x={W - PAD.r} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">{time(t1)}</text>
              {series.map((s) => (
                <g key={s.platform}>
                  <polyline fill="none" stroke={style(s.platform).colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                    points={s.points.map(([t, v]) => `${x(t)},${y(v)}`).join(" ")} />
                  {/* Direct label at the line's end, in text colour, beside its mark. */}
                  <text x={x(s.points.at(-1)![0]) + 6} y={y(s.points.at(-1)![1]) + 4} fontSize="11" fill="var(--fg)">{style(s.platform).name}</text>
                </g>
              ))}
              {hover !== null && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1" />
                  {series.map((s) => {
                    const p = s.points.find(([t]) => t === hover);
                    return p && <circle key={s.platform} cx={x(p[0])} cy={y(p[1])} r="4" fill={style(s.platform).colour} stroke="var(--surface)" strokeWidth="2" />;
                  })}
                </g>
              )}
            </svg>
            <p className="m-0 min-h-5 text-xs tabular-nums" data-testid="readout">
              {hover !== null
                ? <>{time(hover)}: {series.map((s) => `${style(s.platform).name} ${s.points.find(([t]) => t === hover)?.[1] ?? "–"} ms`).join(" · ")}</>
                : <span className="text-muted">Point at the chart for the values at that time.</span>}
            </p>
          </figure>
        ))}
      </div>
    </div>
  );
}
