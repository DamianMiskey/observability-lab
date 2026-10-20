import { describe, expect, it } from "vitest";
import { GET as find } from "@/app/api/find/route";
import { GET as query } from "@/app/api/query/route";
import { POST as sendRoute } from "@/app/api/send/route";
import { QUERIES } from "@/lib/queries";
import { isTraceId, newTraceparent } from "@/lib/targets";

// The server routes refuse anything outside their fixed lists, and say
// plainly when Grafana isn't configured (no read token, as in tests and CI).

const post = (body: unknown) => sendRoute(new Request("http://x/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("/api/send", () => {
  it("only sends known requests to known platforms", async () => {
    expect((await post({ request: "https://evil.example", platforms: ["vercel"] })).status).toBe(400);
    expect((await post({ request: "health", platforms: ["somewhere-else"] })).status).toBe(400);
    expect((await post({ request: "health", platforms: [] })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
  });
});

describe("/api/find and /api/query", () => {
  it("validate their input", async () => {
    expect((await find(new Request("http://x/api/find?id=nope"))).status).toBe(400);
    expect((await find(new Request('http://x/api/find?id=" or 1=1'))).status).toBe(400);
    expect((await query(new Request("http://x/api/query?q=sum(rate(anything))"))).status).toBe(400);
  });

  it("answer 503 with notConfigured when there's no read token", async () => {
    delete process.env.GRAFANA_READ_TOKEN;
    const res = await find(new Request(`http://x/api/find?id=${"a".repeat(32)}`));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ notConfigured: true });
    expect((await query(new Request("http://x/api/query?q=volume"))).status).toBe(503);
  });
});

describe("traceparent", () => {
  it("is a valid W3C header carrying a fresh trace id", () => {
    const a = newTraceparent();
    expect(a.header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(isTraceId(a.traceId)).toBe(true);
    expect(newTraceparent().traceId).not.toBe(a.traceId);
  });
});

describe("queries", () => {
  it("all read the API lab's stream and parse JSON", () => {
    for (const q of Object.values(QUERIES)) expect(q.logql).toContain('{service_name="api-feature-lab"} | json');
  });
});
