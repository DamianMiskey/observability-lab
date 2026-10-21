import { describe, expect, it } from "vitest";
import { GET } from "@/app/grafana/api-feature-lab-dashboard.json/route";
import { buildDashboard } from "@/lib/dashboard";
import { ALERT, errorShare, SERVER } from "@/lib/metrics";

// The generated Grafana dashboard: valid shape, no overlaps, real metric names.
describe("Grafana dashboard", () => {
  const d = buildDashboard();
  const panels = d.panels as { id: number; type: string; gridPos: { x: number; y: number; w: number; h: number }; targets?: { expr: string; datasource: { uid: string } }[] }[];

  it("has unique ids and panels that don't overlap on the 24-column grid", () => {
    expect(new Set(panels.map((p) => p.id)).size).toBe(panels.length);
    for (const p of panels) expect(p.gridPos.x + p.gridPos.w).toBeLessThanOrEqual(24);
    for (const a of panels) for (const b of panels) {
      if (a === b) continue;
      const overlap = a.gridPos.x < b.gridPos.x + b.gridPos.w && b.gridPos.x < a.gridPos.x + a.gridPos.w && a.gridPos.y < b.gridPos.y + b.gridPos.h && b.gridPos.y < a.gridPos.y + a.gridPos.h;
      expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  });

  it("queries the metric names the generator really produces, through data source variables", () => {
    const exprs = panels.flatMap((p) => p.targets ?? []);
    expect(exprs.length).toBeGreaterThan(8);
    for (const t of exprs) {
      expect(t.datasource.uid).toMatch(/^\$\{(prometheus|loki)\}$/);
      if (t.datasource.uid === "${prometheus}") {
        expect(t.expr).toMatch(/traces_spanmetrics_(calls_total|latency)\{/);
        expect(t.expr).not.toContain("_bucket");
      }
    }
  });

  it("is served as JSON for import", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toContain("application/json");
    expect((await res.json()).uid).toBe("api-feature-lab-red");
  });
});

describe("dashboard details", () => {
  it("error shares fall back to 0% rather than No data when there are no errors", () => {
    const share = errorShare("5m", "platform");
    expect(share).toMatch(/\) or .* \* 0\) \/ /);
  });

  it("only counts series with a region, so no platform-less 'Value' line appears", () => {
    expect(SERVER).toContain('cloud_region!=""');
  });

  it("the endpoint table hides the instant query's timestamp and names its columns", () => {
    const table = (buildDashboard().panels as { type: string; transformations?: { id: string; options: { excludeByName: Record<string, boolean>; renameByName: Record<string, string> } }[] }[]).find((p) => p.type === "table")!;
    const organize = table.transformations!.find((t) => t.id === "organize")!;
    expect(organize.options.excludeByName.Time).toBe(true);
    expect(organize.options.renameByName).toMatchObject({ span_name: "Endpoint", platform: "Platform", Value: "p95" });
  });
});

describe("the alert panel", () => {
  it("carries the alert rule's exact query, so Grafana can create the rule from it", () => {
    const panel = (buildDashboard().panels as { title: string; targets?: { expr: string }[] }[]).find((p) => p.title === "Alert: server error rate")!;
    expect(panel.targets![0].expr).toBe(ALERT.rule);
    expect(ALERT.rule).not.toContain("$__");
  });
});

describe("the alert rule", () => {
  it("needs both a high error share and enough requests", () => {
    expect(ALERT.rule).toContain(`> ${ALERT.threshold} and`);
    expect(ALERT.rule).toContain(`>= ${ALERT.minRequests}`);
    expect(ALERT.rule).toContain('status_code="STATUS_CODE_ERROR"');
  });
});
