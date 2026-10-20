"use client";

import { useState } from "react";
import { Choice, type Found, LogLine, NotConfigured, send, type SendResult, waitForLines } from "@/components/telemetry";
import { Button } from "@/components/ui";
import { PLATFORMS, REQUESTS, type PlatformId, type RequestId } from "@/lib/targets";

// Send a request to the API lab, then find the one log line it wrote, in
// Grafana Loki, by its request id.
export function FindMyLine() {
  const [which, setWhich] = useState<RequestId>("board");
  const [platform, setPlatform] = useState<PlatformId>("vercel");
  const [sent, setSent] = useState<SendResult | null>(null);
  const [waited, setWaited] = useState(0);
  const [found, setFound] = useState<{ lines: Found[]; seconds: number; notConfigured?: boolean; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setSent(null);
    setFound(null);
    try {
      const s = await send(which, [platform]);
      setSent(s);
      setFound(await waitForLines(s.traceId, 1, setWaited));
    } catch (e) {
      setFound({ lines: [], seconds: 0, error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const result = sent?.results[0];
  const line = found?.lines.find((l) => l.line.msg === "request");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Choice label="Request" options={Object.entries(REQUESTS).map(([id, r]) => [id as RequestId, r.label] as const)} value={which} onChange={setWhich} />
      <Choice label="Platform" options={Object.entries(PLATFORMS).map(([id, p]) => [id as PlatformId, p.name] as const)} value={platform} onChange={setPlatform} />
      <p className="m-0 text-sm text-muted">{REQUESTS[which].note}</p>
      <div><Button onClick={go} disabled={busy}>{busy ? "Working…" : "Send it, then find its log line"}</Button></div>

      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {result && (
          <p className="m-0 font-mono text-sm break-all" data-testid="sent">
            {result.status} in {result.ms} ms · X-Request-Id: <span className="break-all">{result.requestId}</span>
          </p>
        )}
        {busy && sent && <p className="m-0 text-sm text-muted">Looking for it in Loki… {waited}s</p>}
        {found?.notConfigured && <NotConfigured />}
        {found?.error && <p className="m-0 text-sm text-danger">{found.error}</p>}
        {found && !found.notConfigured && !found.error && (line ? (
          <div data-testid="found">
            <p className="m-0 mb-1 text-sm">Found in Loki after <strong>{found.seconds}s</strong>: the whole line, as the API wrote it.</p>
            <LogLine entry={line} highlight={["requestId", "route", "status", "durationMs", "dbQueries", "platform"]} />
          </div>
        ) : <p className="m-0 text-sm text-muted">Not in Loki after {found.seconds}s. Ingestion is usually a few seconds; try again in a moment.</p>)}
      </div>
    </div>
  );
}
