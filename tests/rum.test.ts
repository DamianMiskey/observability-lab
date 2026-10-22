import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/rum/route";
import { apiFetchQuery, rate, vitalQuery } from "@/lib/rum";

describe("real user monitoring", () => {
  it("rates vitals by Google's thresholds", () => {
    expect(rate("lcp", 836)).toBe("good");
    expect(rate("lcp", 3000)).toBe("needs-improvement");
    expect(rate("lcp", 4100)).toBe("poor");
    expect(rate("inp", 56)).toBe("good");
    expect(rate("cls", 0.3)).toBe("poor");
  });

  it("queries Faro's logfmt lines at p75 per page, and only API calls for traces", () => {
    const q = vitalQuery('{service_name="motion-lab"}', "lcp");
    expect(q).toContain('| logfmt | kind="measurement" | type="web-vitals" | lcp!="" | unwrap lcp');
    expect(q).toMatch(/^quantile_over_time\(0\.75,/);
    expect(apiFetchQuery('{x="y"}')).toContain('event_name="faro.tracing.fetch"');
  });

  it("rejects unknown questions and says when Grafana isn't configured", async () => {
    delete process.env.GRAFANA_READ_TOKEN;
    expect((await GET(new Request("http://x/api/rum?q=vitals"))).status).toBe(503);
  });
});
