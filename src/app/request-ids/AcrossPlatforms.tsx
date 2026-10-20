"use client";

import { useState } from "react";
import { type Found, LogLine, NotConfigured, send, type SendResult, waitForLines } from "@/components/telemetry";
import { Button, cx } from "@/components/ui";
import { PLATFORMS } from "@/lib/targets";

// One traceparent, two platforms: the same request id ends up in a log line
// from Vercel and one from Cloudflare Workers, and in the 404's error body.
export function AcrossPlatforms() {
  const [sent, setSent] = useState<SendResult | null>(null);
  const [found, setFound] = useState<{ lines: Found[]; seconds: number; notConfigured?: boolean; error?: string } | null>(null);
  const [waited, setWaited] = useState(0);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setSent(null);
    setFound(null);
    try {
      const s = await send("missing", ["vercel", "workers"]);
      setSent(s);
      setFound(await waitForLines(s.traceId, 2, setWaited));
    } catch (e) {
      setFound({ lines: [], seconds: 0, error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const bodyId = (body: string) => { try { return JSON.parse(body).requestId as string; } catch { return null; } };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div><Button onClick={go} disabled={busy}>{busy ? "Working…" : "One id, two platforms"}</Button></div>
      <div aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {sent && (
          <>
            <p className="m-0 font-mono text-sm break-all">traceparent: 00-<strong className="text-accent-ink">{sent.traceId}</strong>-…-01</p>
            <div className="grid gap-3 md:grid-cols-2">
              {sent.results.map((r) => {
                const line = found?.lines.find((l) => l.line.msg === "request" && l.line.platform === (r.platform === "vercel" ? "vercel" : "cloudflare-workers"));
                const same = r.requestId === sent.traceId && bodyId(r.body) === sent.traceId;
                return (
                  <section key={r.platform} className="min-w-0 rounded-lg border border-line bg-bg p-3" data-platform={r.platform}>
                    <h3 className="mt-0">{PLATFORMS[r.platform].name}</h3>
                    <p className="m-0 text-sm">{r.status} in {r.ms} ms</p>
                    <p className={cx("m-0 text-sm", same ? "text-accent-ink" : "text-danger")} data-testid="same-id">
                      {same ? "X-Request-Id and the error body's requestId both carry the trace id." : "The id didn't come back as expected."}
                    </p>
                    {line && <div className="mt-2"><LogLine entry={line} highlight={["requestId", "platform", "region", "status"]} /></div>}
                  </section>
                );
              })}
            </div>
          </>
        )}
        {busy && sent && <p className="m-0 text-sm text-muted">Looking for both lines in Loki… {waited}s</p>}
        {found?.notConfigured && <NotConfigured />}
        {found?.error && <p className="m-0 text-sm text-danger">{found.error}</p>}
      </div>
    </div>
  );
}
