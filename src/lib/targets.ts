// The only requests this site sends to the API lab: a fixed list, chosen by
// id. A visitor can't make the server fetch an address of their choosing.
export const PLATFORMS = {
  vercel: { name: "Vercel", base: "https://api.djmiskey.com" },
  workers: { name: "Cloudflare Workers", base: "https://api-cf.djmiskey.com" },
} as const;
export type PlatformId = keyof typeof PLATFORMS;

export const REQUESTS = {
  health: { label: "GET /api/health", path: "/api/health", note: "No database: the fastest thing the API does." },
  board: { label: "GET /api/scores?game=runner", path: "/api/scores?game=runner&limit=3", note: "One database query: the Runner leaderboard." },
  missing: { label: "GET a task that doesn't exist", path: "/api/tasks/00000000-0000-4000-8000-000000000000", note: "A 404: logged as a warning, with the request id in the error body." },
} as const;
export type RequestId = keyof typeof REQUESTS;

/** A W3C traceparent with a fresh trace id: the request id the API will log. */
export function newTraceparent() {
  const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const traceId = hex(16);
  return { traceId, header: `00-${traceId}-${hex(8)}-01` };
}

export const isRequestId = (id: string): id is RequestId => id in REQUESTS;
export const isPlatform = (id: string): id is PlatformId => id in PLATFORMS;
export const isTraceId = (id: string) => /^[0-9a-f]{32}$/.test(id);
