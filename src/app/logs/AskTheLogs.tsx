"use client";

import { useState } from "react";
import { NotConfigured } from "@/components/telemetry";
import { Button } from "@/components/ui";
import { QUERIES, type QueryId } from "@/lib/queries";

type Row = { labels: Record<string, string>; value: number };

// Questions answered from the log lines alone: no metrics system, no
// dashboards, just LogQL counting and averaging fields across lines.
export function AskTheLogs() {
  const [q, setQ] = useState<QueryId | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "notConfigured" | string>("idle");

  const ask = async (id: QueryId) => {
    setQ(id);
    setRows(null);
    setState("busy");
    const r = await fetch(`/api/query?q=${id}`, { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return setState("notConfigured");
    if (!r.ok) return setState(body.error);
    setRows(body.rows);
    setState("idle");
  };

  const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en") : v.toFixed(1));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(QUERIES) as QueryId[]).map((id) => (
          <Button key={id} variant={id === q ? "primary" : "ghost"} aria-pressed={id === q} onClick={() => ask(id)} disabled={state === "busy"}>
            {QUERIES[id].question}
          </Button>
        ))}
      </div>
      {q && (
        <div aria-live="polite" className="grid gap-2">
          <pre className="m-0 overflow-x-auto rounded-lg bg-code px-3 py-2 font-mono text-xs" tabIndex={0}>{QUERIES[q].logql}</pre>
          {state === "busy" && <p className="m-0 text-sm text-muted">Asking Loki…</p>}
          {state === "notConfigured" && <NotConfigured />}
          {state !== "busy" && state !== "idle" && state !== "notConfigured" && <p className="m-0 text-sm text-danger">{state}</p>}
          {rows && (rows.length === 0 ? <p className="m-0 text-sm text-muted">No matching lines in the last hour.</p> : (
            <table className="w-full border-collapse text-sm" data-testid="answer">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-1 pr-3 font-mono text-xs">{Object.entries(r.labels).map(([k, v]) => `${k}=${v}`).join(", ") || "(all)"}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{fmt(r.value)} {QUERIES[q].unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
    </div>
  );
}
