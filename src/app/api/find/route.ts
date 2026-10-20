import { API_STREAM, findLines, NotConfigured } from "@/lib/grafana";
import { isTraceId } from "@/lib/targets";

// GET /api/find?id=<request id>: the API lab's log lines carrying that id,
// read back from Grafana Loki. A line filter (|=) on the id: Loki scans the
// last 30 minutes of the stream for it.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isTraceId(id)) return Response.json({ error: "id must be 32 lowercase hex characters" }, { status: 400 });
  try {
    const lines = await findLines(`${API_STREAM} |= "${id}"`, 30, 20);
    return Response.json({ lines }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof NotConfigured) return Response.json({ error: e.message, notConfigured: true }, { status: 503 });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
