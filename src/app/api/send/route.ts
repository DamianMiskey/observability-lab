import { isPlatform, isRequestId, newTraceparent, PLATFORMS, REQUESTS } from "@/lib/targets";

// POST {"request": "health", "platforms": ["vercel", "workers"]}: send one of
// the fixed requests to the API lab, from this server, with a traceparent we
// made up, so we know the id each copy of the API will log it under. With
// two platforms, both get the same id: one id across two platforms.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { request?: string; platforms?: string[] } | null;
  const which = body?.request ?? "";
  const platforms = (body?.platforms ?? []).filter(isPlatform);
  if (!isRequestId(which) || platforms.length === 0 || platforms.length > 2) {
    return Response.json({ error: "Send a known request id and one or two platforms." }, { status: 400 });
  }
  const { traceId, header } = newTraceparent();
  const results = await Promise.all(platforms.map(async (p) => {
    const started = performance.now();
    const res = await fetch(`${PLATFORMS[p].base}${REQUESTS[which].path}`, { headers: { traceparent: header }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    return { platform: p, status: res.status, ms: Math.round(performance.now() - started), requestId: res.headers.get("x-request-id"), body: text.slice(0, 600) };
  }));
  return Response.json({ traceId, results }, { headers: { "cache-control": "no-store" } });
}
