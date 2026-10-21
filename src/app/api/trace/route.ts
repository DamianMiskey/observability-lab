import { getTrace, NotConfigured } from "@/lib/grafana";
import { isTraceId } from "@/lib/targets";

// GET /api/trace?id=<trace id>: that trace's spans, from Grafana Tempo, with
// times relative to its start. 404 while Tempo hasn't got it yet.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isTraceId(id)) return Response.json({ error: "id must be 32 lowercase hex characters" }, { status: 400 });
  try {
    const spans = await getTrace(id);
    return spans
      ? Response.json({ spans }, { headers: { "cache-control": "no-store" } })
      : Response.json({ error: "Not in Tempo (yet)" }, { status: 404, headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof NotConfigured) return Response.json({ error: e.message, notConfigured: true }, { status: 503 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
