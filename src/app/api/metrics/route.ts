import { NotConfigured, promInstant, promRange, promSeries } from "@/lib/grafana";
import { DISCOVER, P95_OVER_TIME, RED } from "@/lib/metrics";

export type RedRow = { route: string; platform: string; calls: number; errors: number; clientErrors: number; p95Ms: number | null };

// GET /api/metrics?q=red | p95 | discover. Fixed PromQL only.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  try {
    if (q === "red") {
      const [calls, errors, clientErrors, p95] = await Promise.all([RED.calls, RED.errors, RED.clientErrors, RED.p95].map(promInstant));
      const key = (l: Record<string, string>) => `${l.span_name}|${l.cloud_platform ?? "unknown"}`;
      const pick = (rows: { labels: Record<string, string>; value: number }[], k: string) => rows.find((r) => key(r.labels) === k)?.value;
      const rows: RedRow[] = calls.filter((c) => c.value > 0).map((c) => {
        const k = key(c.labels);
        const p = pick(p95, k);
        return {
          route: c.labels.span_name, platform: c.labels.cloud_platform ?? "unknown",
          calls: Math.round(c.value), errors: Math.round(pick(errors, k) ?? 0), clientErrors: Math.round(pick(clientErrors, k) ?? 0),
          p95Ms: p !== undefined && Number.isFinite(p) ? Math.round(p * 1000) : null,
        };
      }).sort((a, b) => b.calls - a.calls);
      return Response.json({ rows, queries: RED }, { headers: { "cache-control": "no-store" } });
    }
    if (q === "p95") {
      const series = (await promRange(P95_OVER_TIME.query, P95_OVER_TIME.hours, P95_OVER_TIME.stepSec))
        .map((s) => ({ platform: s.labels.cloud_platform ?? "unknown", points: s.points.filter(([, v]) => Number.isFinite(v)).map(([t, v]) => [t, Math.round(v * 1000)]) }));
      return Response.json({ series, query: P95_OVER_TIME.query }, { headers: { "cache-control": "no-store" } });
    }
    if (q === "discover") {
      const sets = await promSeries(DISCOVER);
      const labels: Record<string, string[]> = {};
      for (const set of sets) for (const [k, v] of Object.entries(set)) labels[k] = [...new Set([...(labels[k] ?? []), v])].slice(0, 30);
      return Response.json({ series: sets.length, labels }, { headers: { "cache-control": "no-store" } });
    }
    return Response.json({ error: "q must be red, p95 or discover" }, { status: 400 });
  } catch (e) {
    if (e instanceof NotConfigured) return Response.json({ error: e.message, notConfigured: true }, { status: 503 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
