// Reading telemetry back from Grafana Cloud, on the server. The query
// addresses aren't secret; the read-only token (GRAFANA_READ_TOKEN, an access
// policy with logs/traces/metrics:read and no write scopes) is set only in
// this site's production environment. Without it, every function here
// throws NotConfigured and the pages say so.

const LOKI = { url: "https://logs-prod-042.grafana.net", user: "1842184" };
const TEMPO = { url: "https://tempo-prod-30-prod-us-east-3.grafana.net/tempo", user: "1836485" };
const PROM = { url: "https://prometheus-prod-66-prod-us-east-3.grafana.net/api/prom", user: "3693039" };

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

// ---- Traces (Tempo) ---------------------------------------------------------

export type TraceSpan = {
  spanId: string; parentSpanId: string | null; name: string;
  kind: "server" | "client" | "internal" | "other";
  /** Milliseconds from the start of the trace, and how long it took. */
  startMs: number; durationMs: number;
  error: string | null;
  platform: string | null; region: string | null;
  attributes: Record<string, string | number | boolean>;
};

type OtlpValue = { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean };
type OtlpSpan = {
  spanId: string; parentSpanId?: string; name: string; kind?: number | string;
  startTimeUnixNano: string; endTimeUnixNano: string;
  attributes?: { key: string; value: OtlpValue }[];
  status?: { code?: number | string; message?: string };
};
type OtlpTrace = { resourceSpans?: OtlpResourceSpans[]; batches?: OtlpResourceSpans[] };
type OtlpResourceSpans = { resource?: { attributes?: { key: string; value: OtlpValue }[] }; scopeSpans?: { spans?: OtlpSpan[] }[]; instrumentationLibrarySpans?: { spans?: OtlpSpan[] }[] };

const plain = (v: OtlpValue) => v.stringValue ?? (v.intValue !== undefined ? Number(v.intValue) : v.doubleValue ?? v.boolValue ?? "");
const attrs = (list: { key: string; value: OtlpValue }[] = []) => Object.fromEntries(list.map((a) => [a.key, plain(a.value)]));

/** Tempo's JSON may give ids as hex or (protobuf style) base64: always hex here. */
export function hexId(id: string | undefined) {
  if (!id) return null;
  if (/^[0-9a-f]+$/i.test(id) && (id.length === 16 || id.length === 32)) return id.toLowerCase();
  return [...atob(id)].map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

const KINDS: Record<string, TraceSpan["kind"]> = { "1": "internal", "2": "server", "3": "client", SPAN_KIND_INTERNAL: "internal", SPAN_KIND_SERVER: "server", SPAN_KIND_CLIENT: "client" };
const isError = (code: number | string | undefined) => code === 2 || code === "STATUS_CODE_ERROR";

/** Flatten Tempo's answer into spans with times relative to the trace's start. */
export function flattenTrace(trace: OtlpTrace): TraceSpan[] {
  const raw = (trace.resourceSpans ?? trace.batches ?? []).flatMap((rs) => {
    const resource = attrs(rs.resource?.attributes);
    return (rs.scopeSpans ?? rs.instrumentationLibrarySpans ?? []).flatMap((ss) => (ss.spans ?? []).map((sp) => ({ sp, resource })));
  });
  if (raw.length === 0) return [];
  const ns = (v: string) => BigInt(v);
  const t0 = raw.reduce((min, { sp }) => (ns(sp.startTimeUnixNano) < min ? ns(sp.startTimeUnixNano) : min), ns(raw[0].sp.startTimeUnixNano));
  const ms = (v: bigint) => Number(v) / 1e6;
  return raw.map(({ sp, resource }) => ({
    spanId: hexId(sp.spanId)!,
    parentSpanId: hexId(sp.parentSpanId),
    name: sp.name,
    kind: KINDS[String(sp.kind ?? "")] ?? "other",
    startMs: ms(ns(sp.startTimeUnixNano) - t0),
    durationMs: ms(ns(sp.endTimeUnixNano) - ns(sp.startTimeUnixNano)),
    error: isError(sp.status?.code) ? sp.status?.message ?? "error" : null,
    platform: (resource["cloud.platform"] as string) ?? null,
    region: (resource["cloud.region"] as string) ?? null,
    attributes: attrs(sp.attributes),
  })).sort((a, b) => a.startMs - b.startMs);
}

/** One trace by id, or null if Tempo doesn't have it (yet). */
export async function getTrace(traceId: string): Promise<TraceSpan[] | null> {
  const res = await fetch(`${TEMPO.url}/api/v2/traces/${traceId}`, {
    headers: { authorization: auth(TEMPO.user), accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Tempo answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { trace?: OtlpTrace } & OtlpTrace;
  const spans = flattenTrace(body.trace ?? body);
  return spans.length ? spans : null;
}

// ---- Metrics (Prometheus API, Grafana Mimir) --------------------------------

type PromResult = { metric: Record<string, string>; value?: [number, string]; values?: [number, string][] };

async function prom(path: string, params: Record<string, string>): Promise<PromResult[]> {
  const res = await fetch(`${PROM.url}/api/v1/${path}?${new URLSearchParams(params)}`, {
    headers: { authorization: auth(PROM.user) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Prometheus answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data: { result: PromResult[] } }).data.result;
}

/** A PromQL query evaluated now: one number per series. */
export async function promInstant(query: string) {
  return (await prom("query", { query })).map((r) => ({ labels: r.metric, value: Number(r.value?.[1] ?? NaN) }));
}

/** A PromQL query over the last `hours`, one point per `stepSec`. */
export async function promRange(query: string, hours: number, stepSec: number) {
  const end = Math.floor(Date.now() / 1000);
  return (await prom("query_range", { query, start: String(end - hours * 3600), end: String(end), step: String(stepSec) }))
    .map((r) => ({ labels: r.metric, points: (r.values ?? []).map(([t, v]) => [t * 1000, Number(v)] as [number, number]) }));
}

/** The label sets of the series a selector matches in the last hour (to see what exists). */
export async function promSeries(selector: string) {
  const end = Math.floor(Date.now() / 1000);
  const res = await fetch(`${PROM.url}/api/v1/series?${new URLSearchParams({ "match[]": selector, start: String(end - 3600), end: String(end) })}`, {
    headers: { authorization: auth(PROM.user) }, signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!res.ok) throw new Error(`Prometheus answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data: Record<string, string>[] }).data;
}

/** Metric names matching a pattern (e.g. every traces_spanmetrics_* metric). */
export async function promNames(pattern: string) {
  const end = Math.floor(Date.now() / 1000);
  const res = await fetch(`${PROM.url}/api/v1/label/__name__/values?${new URLSearchParams({ "match[]": `{__name__=~"${pattern}"}`, start: String(end - 3600), end: String(end) })}`, {
    headers: { authorization: auth(PROM.user) }, signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!res.ok) throw new Error(`Prometheus answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data: string[] }).data;
}
