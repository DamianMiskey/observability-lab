"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import type { TraceSpan } from "@/lib/grafana";

// A trace as a waterfall: one row per span, indented under its parent, with a
// bar showing when it ran and for how long, on the trace's own timeline.

type Row = TraceSpan & { depth: number };

/** Depth-first order: each span followed by its children, earliest first. */
function rows(spans: TraceSpan[]): Row[] {
  const ids = new Set(spans.map((s) => s.spanId));
  const children = new Map<string | null, TraceSpan[]>();
  for (const s of spans) {
    // A parent that isn't in the trace (the caller didn't send its own span) counts as no parent.
    const parent = s.parentSpanId && ids.has(s.parentSpanId) ? s.parentSpanId : null;
    children.set(parent, [...(children.get(parent) ?? []), s]);
  }
  const out: Row[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const s of (children.get(parent) ?? []).sort((a, b) => a.startMs - b.startMs)) {
      out.push({ ...s, depth });
      walk(s.spanId, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const COLOURS = { server: "bg-accent", client: "bg-sky-600", internal: "bg-violet-600", other: "bg-muted" } as const;
const ms = (v: number) => (v >= 100 ? `${Math.round(v)} ms` : `${v.toFixed(1)} ms`);

export function Waterfall({ spans }: { spans: TraceSpan[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = rows(spans);
  const end = Math.max(...spans.map((s) => s.startMs + s.durationMs), 0.001);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-1" data-testid="waterfall">
      <div className="flex justify-between text-xs text-muted"><span>0 ms</span><span>{ms(end)}</span></div>
      <ol className="m-0 list-none p-0">
        {list.map((s) => (
          <li key={s.spanId} className="border-b border-line py-1">
            <button
              type="button"
              className="grid w-full cursor-pointer grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2 bg-transparent text-left"
              aria-expanded={open === s.spanId}
              onClick={() => setOpen(open === s.spanId ? null : s.spanId)}
            >
              <span className="min-w-0 truncate font-mono text-xs" style={{ paddingLeft: `${s.depth * 12}px` }}>
                {s.error && <span className="text-danger" aria-label="failed">✕ </span>}{s.name}
              </span>
              <span className="relative block h-4" aria-hidden="true">
                <span
                  className={cx("absolute top-0.5 h-3 rounded-sm", s.error ? "bg-danger" : COLOURS[s.kind])}
                  style={{ left: `${(s.startMs / end) * 100}%`, width: `max(2px, ${(s.durationMs / end) * 100}%)` }}
                />
              </span>
            </button>
            <span className="sr-only">{s.kind} span, starts at {ms(s.startMs)}, takes {ms(s.durationMs)}</span>
            {open === s.spanId && (
              <dl className="m-0 mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 rounded bg-code px-2 py-1 font-mono text-xs">
                <dt className="text-muted">duration</dt><dd className="m-0">{ms(s.durationMs)} (from {ms(s.startMs)})</dd>
                <dt className="text-muted">kind</dt><dd className="m-0">{s.kind}</dd>
                {s.platform && <><dt className="text-muted">platform</dt><dd className="m-0">{s.platform}{s.region ? ` · ${s.region}` : ""}</dd></>}
                {s.error && <><dt className="text-muted">error</dt><dd className="m-0 break-all text-danger">{s.error}</dd></>}
                {Object.entries(s.attributes).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 break-all">{String(v)}</dd></div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
      {/* A key, not a status: each entry says what a colour means. */}
      <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold">Colours:</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-accent" />the request (server);</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-sky-600" />a query or outgoing call (client);</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-violet-600" />a step inside the API;</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-danger" />red: a span that failed</span>
      </p>
    </div>
  );
}
