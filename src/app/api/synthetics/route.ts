import { NotConfigured, promInstant, promSeries } from "@/lib/grafana";
import { PHASES, SYNTHETICS, SYNTHETICS_DISCOVER } from "@/lib/synthetics";

export type CheckRow = { job: string; instance: string; probe: string; up: boolean | null; uptime: number | null; durationMs: number | null };
export type PhaseRow = { job: string; probe: string; phases: Record<string, number>; totalMs: number };

// GET /api/synthetics?q=status | phases | discover. Fixed PromQL only.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  const ok = (body: object) => Response.json(body, { headers: { "cache-control": "no-store" } });
  try {
    if (q === "status") {
      const [up, uptime, duration] = await Promise.all([SYNTHETICS.up, SYNTHETICS.uptime, SYNTHETICS.duration].map(promInstant));
      const key = (l: Record<string, string>) => `${l.job}|${l.probe}`;
      const find = (rows: { labels: Record<string, string>; value: number }[], k: string) => rows.find((r) => key(r.labels) === k)?.value;
      const rows: CheckRow[] = up.map((u) => {
        const k = key(u.labels);
        const ut = find(uptime, k), d = find(duration, k);
        return {
          job: u.labels.job, instance: u.labels.instance, probe: u.labels.probe,
          up: Number.isFinite(u.value) ? u.value === 1 : null,
          uptime: ut !== undefined && Number.isFinite(ut) ? ut : null,
          durationMs: d !== undefined && Number.isFinite(d) ? Math.round(d * 1000) : null,
        };
      }).sort((a, b) => a.job.localeCompare(b.job) || a.probe.localeCompare(b.probe));
      return ok({ window: SYNTHETICS.window, rows });
    }
    if (q === "phases") {
      const rows = await promInstant(SYNTHETICS.phases);
      const byCheck = new Map<string, PhaseRow>();
      for (const r of rows) {
        if (!Number.isFinite(r.value) || !PHASES.some((p) => p.key === r.labels.phase)) continue;
        const k = `${r.labels.job}|${r.labels.probe}`;
        const row = byCheck.get(k) ?? { job: r.labels.job, probe: r.labels.probe, phases: {}, totalMs: 0 };
        row.phases[r.labels.phase] = Math.round(r.value * 1000);
        row.totalMs += Math.round(r.value * 1000);
        byCheck.set(k, row);
      }
      return ok({ rows: [...byCheck.values()].sort((a, b) => a.job.localeCompare(b.job) || a.probe.localeCompare(b.probe)) });
    }
    if (q === "discover") {
      const sets = await promSeries(SYNTHETICS_DISCOVER);
      return ok({ series: sets.length, examples: sets.slice(0, 6) });
    }
    return Response.json({ error: "q must be status, phases or discover" }, { status: 400 });
  } catch (e) {
    if (e instanceof NotConfigured) return Response.json({ error: e.message, notConfigured: true }, { status: 503 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
