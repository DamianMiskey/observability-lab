"use client";

import { useState } from "react";
import type { RedRow } from "@/app/api/metrics/route";
import { NotConfigured } from "@/components/telemetry";
import { Button, cx } from "@/components/ui";

const NAMES: Record<string, string> = { vercel: "Vercel", "cloudflare-workers": "Workers" };

// Rate, errors and duration per endpoint and platform, over the last hour:
// the three numbers that say whether a service is healthy.
export function RedTable() {
  const [rows, setRows] = useState<RedRow[] | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "notConfigured" | string>("idle");

  const load = async () => {
    setState("busy");
    const r = await fetch("/api/metrics?q=red", { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return setState("notConfigured");
    if (!r.ok) return setState(body.error);
    setRows(body.rows);
    setState("idle");
  };

  const pct = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(n && n < of / 100 ? 1 : 0)}%` : "–");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading metrics…" : rows ? "Refresh" : "Show the last hour"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {state === "notConfigured" && <NotConfigured />}
        {state !== "busy" && state !== "idle" && state !== "notConfigured" && <p className="m-0 text-sm text-danger">{state}</p>}
        {rows && (rows.length === 0 ? <p className="m-0 text-sm text-muted">No requests in the last hour.</p> : (
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full border-collapse text-sm" data-testid="red">
              <caption className="pb-2 text-left text-xs text-muted">Last hour, from span metrics. Errors are 5xx; 4xx are the client&apos;s mistakes, counted apart.</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-1 pr-3 font-normal">Endpoint</th>
                  <th scope="col" className="py-1 pr-3 font-normal">Platform</th>
                  <th scope="col" className="py-1 pr-3 text-right font-normal">Rate</th>
                  <th scope="col" className="py-1 pr-3 text-right font-normal">Errors</th>
                  <th scope="col" className="py-1 pr-3 text-right font-normal">4xx</th>
                  <th scope="col" className="py-1 text-right font-normal">p95</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.route}|${r.platform}`} className="border-b border-line">
                    {/* Line breaks only after a slash, never inside a word. */}
                    <td className="py-1 pr-3 font-mono text-xs">{r.route.split("/").map((part, i) => <span key={i}>{i > 0 && <>/<wbr /></>}{part}</span>)}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{NAMES[r.platform] ?? r.platform}</td>
                    <td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums">{r.calls}/h</td>
                    <td className={cx("py-1 pr-3 text-right tabular-nums", r.errors > 0 && "font-semibold text-danger")}>{pct(r.errors, r.calls)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{pct(r.clientErrors, r.calls)}</td>
                    <td className="py-1 text-right whitespace-nowrap tabular-nums">{r.p95Ms === null ? "–" : `${r.p95Ms} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
