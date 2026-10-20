"use client";

import { Button, cx } from "./ui";

// Pieces shared by the pages that send a request to the API lab and then go
// looking for what it logged.

export type SendResult = { traceId: string; results: { platform: "vercel" | "workers"; status: number; ms: number; requestId: string | null; body: string }[] };
export type Found = { ts: string; line: Record<string, unknown> };

export async function send(request: string, platforms: string[]): Promise<SendResult> {
  const r = await fetch("/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request, platforms }) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

/**
 * Ask Loki for lines with this id every 2 seconds until `want` have arrived
 * (ingestion takes a few seconds) or 45 seconds pass. Calls onTick with the
 * seconds waited so far.
 */
export async function waitForLines(id: string, want: number, onTick: (s: number) => void): Promise<{ lines: Found[]; seconds: number; notConfigured?: boolean; error?: string }> {
  const started = Date.now();
  for (;;) {
    const seconds = Math.round((Date.now() - started) / 1000);
    onTick(seconds);
    const r = await fetch(`/api/find?id=${id}`, { cache: "no-store" });
    const body = await r.json();
    if (r.status === 503) return { lines: [], seconds, notConfigured: true };
    if (!r.ok) return { lines: [], seconds, error: body.error };
    const requests = (body.lines as Found[]).filter((l) => l.line.msg === "request");
    if (requests.length >= want || seconds >= 45) return { lines: body.lines, seconds };
    await new Promise((res) => setTimeout(res, 2000));
  }
}

export function NotConfigured() {
  return (
    <p className="m-0 rounded-lg border border-line bg-bg p-3 text-sm text-muted" role="status">
      Reading from Grafana isn&apos;t set up on this copy of the site (no read token), so the log line can&apos;t be fetched
      back here. The request itself was sent and logged.
    </p>
  );
}

export function LogLine({ entry, highlight = [] }: { entry: Found; highlight?: string[] }) {
  return (
    <pre className="m-0 overflow-x-auto rounded-lg bg-code px-3 py-2 font-mono text-xs" tabIndex={0}>
      {"{\n"}
      {Object.entries(entry.line).map(([k, v], i, all) => (
        <span key={k} className={cx(highlight.includes(k) && "font-bold text-accent-ink")}>
          {`  "${k}": ${JSON.stringify(v)}${i < all.length - 1 ? "," : ""}\n`}
        </span>
      ))}
      {"}"}
    </pre>
  );
}

export function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      {options.map(([id, name]) => (
        <Button key={id} variant={id === value ? "primary" : "ghost"} aria-pressed={id === value} onClick={() => onChange(id)}>{name}</Button>
      ))}
    </div>
  );
}
