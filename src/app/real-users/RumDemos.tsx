"use client";

import { useState } from "react";
import { Waterfall } from "@/app/traces/Waterfall";
import { NotConfigured } from "@/components/telemetry";
import { Button } from "@/components/ui";
import type { TraceSpan } from "@/lib/grafana";
import { type Rating, VITALS } from "@/lib/rum";

// The status palette (good / warning / critical): marks only, always beside an
// icon and a word, so the rating never rests on colour alone.
const RATING: Record<Rating, { colour: string; icon: string; word: string }> = {
  good: { colour: "#0ca30c", icon: "✓", word: "Good" },
  "needs-improvement": { colour: "#fab219", icon: "!", word: "Needs work" },
  poor: { colour: "#d03b3b", icon: "✕", word: "Poor" },
};

type State = "idle" | "busy" | "notConfigured" | string;

function useRum<T>(q: string) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<State>("idle");
  const load = async () => {
    setState("busy");
    const r = await fetch(`/api/rum?q=${q}`, { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return setState("notConfigured");
    if (!r.ok) return setState(body.error);
    setData(body);
    setState("idle");
  };
  return { data, state, load };
}

function Status({ state }: { state: State }) {
  if (state === "notConfigured") return <NotConfigured />;
  if (state !== "busy" && state !== "idle") return <p className="m-0 text-sm text-danger">{state}</p>;
  return null;
}

type Vitals = { window: string; sessions: number; rows: { page: string; vitals: Record<string, { value: number; rating: Rating }> }[] };

export function VitalsTable() {
  const { data, state, load } = useRum<Vitals>("vitals");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading…" : data ? "Refresh" : "Show the last 24 hours"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Status state={state} />
        {data && (data.rows.length === 0 ? <p className="m-0 text-sm text-muted">No visits in the last {data.window}.</p> : (
          <>
            <p className="m-0 text-sm">{data.sessions} visit{data.sessions === 1 ? "" : "s"} in the last {data.window}. Each cell is the 75th percentile: three in four visits were at least this good.</p>
            {/* A card per page, a line per vital: readable at any width (a five-column table isn't, on a phone). */}
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 p-0" data-testid="vitals">
              {data.rows.map((r) => (
                <li key={r.page} className="rounded-lg border border-line bg-bg p-3">
                  <h3 className="mt-0 mb-1.5 font-mono text-sm">{r.page}</h3>
                  <dl className="m-0 grid grid-cols-[max-content_1fr_max-content] items-center gap-x-3 gap-y-1 text-sm">
                    {VITALS.map((v) => {
                      const cell = r.vitals[v.key];
                      const rt = cell && RATING[cell.rating];
                      return (
                        <div key={v.key} className="contents">
                          <dt><abbr title={v.what}>{v.name}</abbr></dt>
                          <dd className="m-0 text-right tabular-nums">{cell ? `${cell.value}${v.unit ? ` ${v.unit}` : ""}` : <span className="text-muted">–</span>}</dd>
                          <dd className="m-0 inline-flex items-center gap-1 text-xs text-muted">
                            {rt ? <><span className="inline-block size-2 rounded-full" style={{ background: rt.colour }} aria-hidden="true" />{rt.icon} {rt.word}</> : "no data"}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        ))}
      </div>
    </div>
  );
}

type Errors = { window: string; errors: { ts: string; type: string | null; value: string | null; page: string | null; browser: string | null }[] };

export function ErrorsList() {
  const { data, state, load } = useRum<Errors>("errors");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading…" : data ? "Refresh" : "Show recent errors"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Status state={state} />
        {data && (data.errors.length === 0
          ? <p className="m-0 text-sm" data-testid="errors">✓ No JavaScript errors from visitors in the last {data.window}.</p>
          : (
            <ul className="m-0 grid list-none gap-2 p-0" data-testid="errors">
              {data.errors.map((e, i) => (
                <li key={i} className="rounded-lg border border-line bg-bg p-3 text-sm">
                  <p className="m-0 font-mono text-xs break-all"><strong>{e.type ?? "Error"}</strong>: {e.value}</p>
                  <p className="m-0 text-xs text-muted">{new Date(e.ts).toLocaleString("en-GB")} · {e.page ? new URL(e.page).pathname : "?"} · {e.browser ?? "?"}</p>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}

type Trace = { traceId: string | null; page?: string | null; at?: string; spans: TraceSpan[] | null };

export function BrowserTrace() {
  const { data, state, load } = useRum<Trace>("trace");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading…" : data ? "Refresh" : "Show the latest one"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Status state={state} />
        {data && (!data.traceId
          ? <p className="m-0 text-sm text-muted">No visitor has called the API from a Motion lab page in the last 24 hours. Finish a game there (the leaderboard calls it), then refresh.</p>
          : (
            <div data-testid="browser-trace">
              <p className="m-0 mb-2 text-sm">
                From {data.page ? <code>{new URL(data.page).pathname}</code> : "a Motion lab page"} at {new Date(data.at!).toLocaleTimeString("en-GB")}.
                Tap a row: the top span ran in the visitor&apos;s browser (service <code>motion-lab</code>), the rest in the API (<code>api-feature-lab</code>).
              </p>
              {data.spans ? <Waterfall spans={data.spans} /> : <p className="m-0 text-sm text-muted">Trace {data.traceId} isn&apos;t in Tempo yet.</p>}
            </div>
          ))}
      </div>
    </div>
  );
}
