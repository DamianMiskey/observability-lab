import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/synthetics/route";
import { SYNTHETICS } from "@/lib/synthetics";

describe("synthetic checks", () => {
  it("query Synthetic Monitoring's own metrics", () => {
    expect(SYNTHETICS.up).toContain("probe_success");
    expect(SYNTHETICS.duration).toContain("probe_duration_seconds");
    expect(SYNTHETICS.phases).toContain("probe_http_duration_seconds");
  });

  it("refuse unknown questions and say when Grafana isn't configured", async () => {
    expect((await GET(new Request("http://x/api/synthetics?q=up"))).status).toBe(400);
    delete process.env.GRAFANA_READ_TOKEN;
    expect((await GET(new Request("http://x/api/synthetics?q=status"))).status).toBe(503);
  });
});
