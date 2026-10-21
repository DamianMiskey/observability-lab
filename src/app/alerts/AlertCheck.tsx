"use client";

import { useState } from "react";
import { NotConfigured } from "@/components/telemetry";
import { Button, cx } from "@/components/ui";

type Row = { platform: string; requests: number; errorShare: number; firing: boolean };
const NAMES: Record<string, string> = { vercel: "Vercel", "cloudflare-workers": "Workers" };

// Evaluates the alert rule's two halves now, as Grafana does every minute.
export function AlertCheck() {
  const [data, setData] = useState<{ rows: Row[]; threshold: number; minRequests: number; window: string } | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "notConfigured" | string>("idle");

  const check = async () => {
    setState("busy");
    const r = await fetch("/api/metrics?q=alert", { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return setState("notConfigured");
    if (!r.ok) return setState(body.error);
    setData(body);
    setState("idle");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={check} disabled={state === "busy"}>{state === "busy" ? "Evaluating…" : "Would it fire right now?"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {state === "notConfigured" && <NotConfigured />}
        {state !== "busy" && state !== "idle" && state !== "notConfigured" && <p className="m-0 text-sm text-danger">{state}</p>}
        {data && (data.rows.length === 0 ? <p className="m-0 text-sm text-muted">No requests in the last {data.window}: nothing to alert on.</p> : (
          <ul className="m-0 grid list-none gap-2 p-0" data-testid="alert-check">
            {data.rows.map((r) => (
              <li key={r.platform} className="rounded-lg border border-line bg-bg p-3 text-sm">
                <strong>{NAMES[r.platform] ?? r.platform}</strong>: {r.requests} requests in the last {data.window},{" "}
                {(r.errorShare * 100).toFixed(1)}% server errors.{" "}
                {/* State carries an icon and words, never colour alone. */}
                <span className={cx("font-semibold", r.firing ? "text-danger" : "text-accent-ink")}>
                  {r.firing ? "✕ Firing" : "✓ Quiet"}
                </span>{" "}
                <span className="text-muted">
                  {r.firing ? "" : r.requests < data.minRequests ? `(under ${data.minRequests} requests: too few to judge)` : `(at or under ${data.threshold * 100}%)`}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
