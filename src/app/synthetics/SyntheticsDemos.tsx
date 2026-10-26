"use client";

import { useState } from "react";
import type { CheckRow, PhaseRow } from "@/app/api/synthetics/route";
import { NotConfigured } from "@/components/telemetry";
import { Button } from "@/components/ui";
import { PHASES } from "@/lib/synthetics";

type State = "idle" | "busy" | "notConfigured" | string;

function useSynthetics<T>(q: string) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<State>("idle");
  const load = async () => {
    setState("busy");
    const r = await fetch(`/api/synthetics?q=${q}`, { cache: "no-store" });
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

// "Cape Town, ZA (AWS)" style probe names arrive as e.g. "CapeTown": spaced for reading.
const probeName = (p: string) => p.replace(/([a-z])([A-Z])/g, "$1 $2");

export function ChecksStatus() {
  const { data, state, load } = useSynthetics<{ window: string; rows: CheckRow[] }>("status");
  const jobs = data ? [...new Set(data.rows.map((r) => r.job))] : [];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading…" : data ? "Refresh" : "Show the checks"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Status state={state} />
        {data && (jobs.length === 0 ? <p className="m-0 text-sm text-muted">No check results yet: the first runs appear a few minutes after a check is saved.</p> : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3 p-0" data-testid="checks">
            {jobs.map((job) => {
              const rows = data.rows.filter((r) => r.job === job);
              return (
                <li key={job} className="rounded-lg border border-line bg-bg p-3">
                  <h3 className="mt-0 mb-0.5 font-mono text-sm">{job}</h3>
                  <p className="m-0 mb-2 text-xs break-all text-muted">{rows[0].instance}</p>
                  <dl className="m-0 grid grid-cols-[minmax(0,1fr)_max-content_max-content] gap-x-3 gap-y-1 text-sm">
                    {rows.map((r) => (
                      <div key={r.probe} className="contents">
                        <dt className="min-w-0 truncate">{probeName(r.probe)}</dt>
                        {/* State as a word with an icon, never colour alone. */}
                        <dd className="m-0 inline-flex items-center gap-1">
                          <span className="inline-block size-2 rounded-full" style={{ background: r.up ? "#0ca30c" : r.up === false ? "#d03b3b" : "var(--muted)" }} aria-hidden="true" />
                          {r.up ? "✓ Up" : r.up === false ? "✕ Down" : "–"}
                        </dd>
                        <dd className="m-0 text-right text-xs text-muted tabular-nums">
                          {r.uptime !== null ? `${(r.uptime * 100).toFixed(r.uptime < 1 ? 2 : 0)}%` : "–"} · {r.durationMs !== null ? `${r.durationMs} ms` : "–"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        ))}
        {data && jobs.length > 0 && <p className="m-0 text-xs text-muted">Per probe: the latest result, then uptime and average check time over the last {data.window}.</p>}
      </div>
    </div>
  );
}

const COLOURS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

export function PhaseBars() {
  const { data, state, load } = useSynthetics<{ rows: PhaseRow[] }>("phases");
  const max = Math.max(1, ...(data?.rows.map((r) => r.totalMs) ?? []));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={load} disabled={state === "busy"}>{state === "busy" ? "Reading…" : data ? "Refresh" : "Show where the time goes"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <Status state={state} />
        {data && (data.rows.length === 0 ? <p className="m-0 text-sm text-muted">No HTTP check results yet.</p> : (
          <>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-muted" aria-label="Phases">
              {PHASES.map((p, i) => <li key={p.key} className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: COLOURS[i] }} aria-hidden="true" />{p.name}</li>)}
            </ul>
            <ul className="m-0 grid list-none gap-3 p-0" data-testid="phases">
              {data.rows.map((r) => (
                <li key={`${r.job}|${r.probe}`}>
                  <p className="m-0 mb-1 text-sm"><span className="font-mono">{r.job}</span> from <strong>{probeName(r.probe)}</strong>: {r.totalMs} ms</p>
                  {/* Segments with a 2px gap between them; widths on one shared scale. */}
                  <div className="flex h-4 gap-0.5" style={{ width: `${Math.max(2, (r.totalMs / max) * 100)}%` }} role="img"
                    aria-label={PHASES.map((p) => `${p.name} ${r.phases[p.key] ?? 0} ms`).join(", ")}>
                    {PHASES.map((p, i) => (r.phases[p.key] ?? 0) > 0 && (
                      <span key={p.key} className="h-full first:rounded-l last:rounded-r" style={{ flex: r.phases[p.key], background: COLOURS[i] }} title={`${p.name}: ${r.phases[p.key]} ms`} />
                    ))}
                  </div>
                  <p className="m-0 mt-1 text-xs text-muted tabular-nums">{PHASES.map((p) => `${p.name} ${r.phases[p.key] ?? 0}`).join(" · ")} ms</p>
                </li>
              ))}
            </ul>
          </>
        ))}
      </div>
    </div>
  );
}
