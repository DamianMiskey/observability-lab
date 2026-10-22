import { findLines, getTrace, instant, NotConfigured } from "@/lib/grafana";
import { apiFetchQuery, errorsQuery, rate, RUM_SELECTORS, sessionsQuery, vitalQuery, VITALS, WINDOW } from "@/lib/rum";

// GET /api/rum?q=vitals | errors | trace: the Motion lab's real user
// monitoring data, from Loki (and Tempo for the trace). Fixed queries only.

let selector: string | null = null;

/** Which label marks the Motion lab's lines in this stack (checked once per instance). */
async function rumSelector() {
  if (selector) return selector;
  for (const s of RUM_SELECTORS) {
    const [row] = await instant(`sum(count_over_time(${s} [${WINDOW}]))`);
    if (row && row.value > 0) return (selector = s);
  }
  return RUM_SELECTORS[0];
}

const ok = (body: object) => Response.json(body, { headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  try {
    const s = await rumSelector();
    if (q === "vitals") {
      const [sessions, ...perVital] = await Promise.all([instant(sessionsQuery(s)), ...VITALS.map((v) => instant(vitalQuery(s, v.key)))]);
      const pages = new Map<string, Record<string, { value: number; rating: string }>>();
      VITALS.forEach((v, i) => {
        for (const row of perVital[i]) {
          if (!Number.isFinite(row.value)) continue;
          const page = new URL(row.labels.page_url ?? "https://motion.djmiskey.com/").pathname;
          const entry = pages.get(page) ?? {};
          entry[v.key] = { value: v.key === "cls" ? Math.round(row.value * 1000) / 1000 : Math.round(row.value), rating: rate(v.key, row.value) };
          pages.set(page, entry);
        }
      });
      const rows = [...pages.entries()].map(([page, vitals]) => ({ page, vitals })).sort((a, b) => a.page.localeCompare(b.page));
      return ok({ window: WINDOW, sessions: Math.round(sessions[0]?.value ?? 0), rows });
    }
    if (q === "errors") {
      const lines = await findLines(errorsQuery(s), 24 * 60, 10);
      // Only what a reader needs; the whole line also carries the browser and session.
      const errors = lines.map(({ ts, line }) => {
        const text = String(line.text ?? "");
        const field = (k: string) => text.match(new RegExp(`(?:^| )${k}=("(?:[^"\\\\]|\\\\.)*"|\\S+)`))?.[1]?.replace(/^"|"$/g, "") ?? null;
        return { ts, type: field("type"), value: field("value"), page: field("page_url"), browser: field("browser_name") };
      });
      return ok({ window: WINDOW, errors });
    }
    if (q === "trace") {
      const [latest] = await findLines(apiFetchQuery(s), 24 * 60, 1);
      const text = String(latest?.line.text ?? "");
      const traceId = text.match(/traceID=([0-9a-f]{32})/)?.[1];
      if (!traceId) return ok({ window: WINDOW, traceId: null, spans: null });
      const page = text.match(/page_url=(\S+)/)?.[1] ?? null;
      return ok({ window: WINDOW, traceId, page, at: latest.ts, spans: await getTrace(traceId) });
    }
    return Response.json({ error: "q must be vitals, errors or trace" }, { status: 400 });
  } catch (e) {
    if (e instanceof NotConfigured) return Response.json({ error: e.message, notConfigured: true }, { status: 503 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
