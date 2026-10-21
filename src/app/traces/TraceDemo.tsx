"use client";

import { useState } from "react";
import { Choice, NotConfigured, send } from "@/components/telemetry";
import { Button } from "@/components/ui";
import type { TraceSpan } from "@/lib/grafana";
import { newTraceparent, PLATFORMS, type PlatformId, REQUESTS, type RequestId } from "@/lib/targets";
import { Waterfall } from "./Waterfall";

type From = "server" | "browser";

/** Ask for the trace every 2 seconds until Tempo has the request's root span (or 60 s pass). */
async function waitForTrace(id: string, onTick: (s: number) => void) {
  const started = Date.now();
  for (;;) {
    const seconds = Math.round((Date.now() - started) / 1000);
    onTick(seconds);
    const r = await fetch(`/api/trace?id=${id}`, { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return { notConfigured: true as const, seconds };
    if (r.ok && (body.spans as TraceSpan[]).some((s) => s.kind === "server")) return { spans: body.spans as TraceSpan[], seconds };
    if (r.status !== 404 && !r.ok) return { error: body.error as string, seconds };
    if (seconds >= 60) return { error: "Not in Tempo after a minute. Ingestion is usually seconds: try again shortly.", seconds };
    await new Promise((res) => setTimeout(res, 2000));
  }
}

// Send one request to the API lab and draw its trace, from either this
// site's server (Washington, D.C.) or the visitor's own browser.
export function TraceDemo() {
  const [which, setWhich] = useState<RequestId>("board");
  const [platform, setPlatform] = useState<PlatformId>("workers");
  const [from, setFrom] = useState<From>("browser");
  const [sent, setSent] = useState<{ id: string; status: number; ms: number } | null>(null);
  const [waited, setWaited] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof waitForTrace>> | null>(null);
  const [busy, setBusy] = useState(false);

  // Only the leaderboard allows cross-origin calls from this site.
  const browserOk = which === "board";
  const actualFrom: From = browserOk ? from : "server";

  const go = async () => {
    setBusy(true);
    setSent(null);
    setResult(null);
    try {
      let id: string;
      if (actualFrom === "browser") {
        const tp = newTraceparent();
        const started = performance.now();
        const r = await fetch(`${PLATFORMS[platform].base}${REQUESTS[which].path}`, { headers: { traceparent: tp.header }, cache: "no-store" });
        await r.text();
        id = tp.traceId;
        setSent({ id, status: r.status, ms: Math.round(performance.now() - started) });
      } else {
        const s = await send(which, [platform]);
        id = s.traceId;
        setSent({ id, status: s.results[0].status, ms: s.results[0].ms });
      }
      setResult(await waitForTrace(id, setWaited));
    } catch (e) {
      setResult({ error: (e as Error).message, seconds: 0 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Choice label="Request" options={Object.entries(REQUESTS).map(([id, r]) => [id as RequestId, r.label] as const)} value={which} onChange={setWhich} />
      <Choice label="Platform" options={Object.entries(PLATFORMS).map(([id, p]) => [id as PlatformId, p.name] as const)} value={platform} onChange={setPlatform} />
      <Choice label="Sent from" options={[["browser", "Your browser"], ["server", "This site's server (Washington, D.C.)"]] as const} value={actualFrom} onChange={setFrom} />
      {!browserOk && <p className="m-0 text-sm text-muted">This request can only be sent from this site&apos;s server (only the leaderboard allows calls from other sites&apos; pages).</p>}
      <div><Button onClick={go} disabled={busy}>{busy ? "Working…" : "Send it, then draw its trace"}</Button></div>

      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {sent && (
          <p className="m-0 font-mono text-sm break-all" data-testid="sent">
            {sent.status} in {sent.ms} ms (measured by the sender) · trace {sent.id}
          </p>
        )}
        {busy && sent && <p className="m-0 text-sm text-muted">Waiting for the trace in Tempo… {waited}s</p>}
        {result && "notConfigured" in result && <NotConfigured />}
        {result && "error" in result && <p className="m-0 text-sm text-danger">{result.error}</p>}
        {result && "spans" in result && result.spans && (
          <div data-testid="trace">
            <p className="m-0 mb-2 text-sm">
              From Tempo after <strong>{result.seconds}s</strong>: {result.spans.length} spans. Tap a row for its attributes.
            </p>
            <Waterfall spans={result.spans} />
          </div>
        )}
      </div>
    </div>
  );
}
