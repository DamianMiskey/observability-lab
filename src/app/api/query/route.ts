import { instant, NotConfigured } from "@/lib/grafana";
import { isQueryId, QUERIES } from "@/lib/queries";

// GET /api/query?q=<id>: run one of the fixed LogQL questions against Loki.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!isQueryId(q)) return Response.json({ error: "Unknown query" }, { status: 400 });
  try {
    const rows = await instant(QUERIES[q].logql);
    rows.sort((a, b) => b.value - a.value);
    return Response.json({ rows }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof NotConfigured) return Response.json({ error: e.message, notConfigured: true }, { status: 503 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
