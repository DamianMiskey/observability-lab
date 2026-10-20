// Reading telemetry back from Grafana Cloud, on the server. The query
// addresses aren't secret; the read-only token (GRAFANA_READ_TOKEN, an access
// policy with logs/traces/metrics:read and no write scopes) is set only in
// this site's production environment. Without it, every function here
// throws NotConfigured and the pages say so.

const LOKI = { url: "https://logs-prod-042.grafana.net", user: "1842184" };

export class NotConfigured extends Error {
  constructor() { super("Grafana isn't configured here (no GRAFANA_READ_TOKEN)."); }
}

const auth = (user: string) => {
  const token = process.env.GRAFANA_READ_TOKEN;
  if (!token) throw new NotConfigured();
  return `Basic ${btoa(`${user}:${token}`)}`;
};

export type LogEntry = { ts: string; line: Record<string, unknown> };

type LokiStreams = { data: { resultType: "streams"; result: { stream: Record<string, string>; values: [string, string][] }[] } };
type LokiMatrix = { data: { resultType: "matrix" | "vector"; result: { metric: Record<string, string>; values?: [number, string][]; value?: [number, string] }[] } };

async function loki<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${LOKI.url}/loki/api/v1/${path}?${new URLSearchParams(params)}`, {
    headers: { authorization: auth(LOKI.user) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Loki answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

const nanos = (msAgo: number) => `${Date.now() - msAgo}000000`;

/** Log lines (newest first) matching a LogQL stream query, from the last `minutes`. */
export async function findLines(query: string, minutes = 30, limit = 20): Promise<LogEntry[]> {
  const body = await loki<LokiStreams>("query_range", { query, start: nanos(minutes * 60_000), end: nanos(0), limit: String(limit), direction: "backward" });
  return body.data.result
    .flatMap((s) => s.values)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ns, text]) => {
      let line: Record<string, unknown>;
      try { line = JSON.parse(text); } catch { line = { text }; }
      return { ts: new Date(Number(ns.slice(0, -6))).toISOString(), line };
    });
}

/** A LogQL metric query, evaluated once now: one number per series. */
export async function instant(query: string) {
  const body = await loki<LokiMatrix>("query", { query, time: nanos(0) });
  return body.data.result.map((r) => ({ labels: r.metric, value: Number(r.value?.[1] ?? NaN) }));
}

/** The stream every line of the API lab is in. */
export const API_STREAM = '{service_name="api-feature-lab"}';
