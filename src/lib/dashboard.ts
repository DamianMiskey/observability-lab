import { errorShare, red } from "./metrics";

// The API lab's dashboard, as Grafana dashboard JSON, built from the same
// PromQL the Metrics page runs (src/lib/metrics.ts), so the two can't drift.
// Import it in Grafana: Dashboards → New → Import → upload or paste. It asks
// for no secrets: the data sources are variables, picked on import.

const PROM = { type: "prometheus", uid: "${prometheus}" };
const LOKI = { type: "loki", uid: "${loki}" };
// The Metrics page's colours: the dataviz reference palette's first two slots.
const PLATFORM_COLOURS = { vercel: "#2a78d6", "cloudflare-workers": "#eb6834" } as const;

const platformColours = Object.entries(PLATFORM_COLOURS).map(([name, colour]) => ({
  matcher: { id: "byName", options: name },
  properties: [{ id: "color", value: { mode: "fixed", fixedColor: colour } }],
}));

type Target = { expr: string; legend?: string; instant?: boolean; format?: string };
type Panel = { title: string; description?: string; type?: string; unit?: string; targets: Target[]; w?: number; h?: number; byPlatform?: boolean; options?: object; transformations?: object[] };

let id = 0;
function panel({ title, description, type = "timeseries", unit, targets, w = 12, h = 8, byPlatform = false, options, transformations = [] }: Panel, x: number, y: number) {
  return {
    id: ++id, title, description, type,
    gridPos: { x, y, w, h },
    datasource: PROM,
    fieldConfig: {
      defaults: { unit, custom: type === "timeseries" ? { lineWidth: 2, fillOpacity: 0, showPoints: "never" } : undefined },
      overrides: byPlatform ? platformColours : [],
    },
    options: { legend: { displayMode: "list", placement: "bottom" }, tooltip: { mode: "multi" }, ...options },
    transformations,
    targets: targets.map((t, i) => ({
      refId: String.fromCharCode(65 + i), datasource: PROM, expr: t.expr,
      legendFormat: t.legend ?? "__auto", instant: t.instant ?? false, range: !t.instant, format: t.format ?? "time_series",
    })),
  };
}

const row = (title: string, y: number) => ({ id: ++id, type: "row", title, collapsed: false, gridPos: { x: 0, y, w: 24, h: 1 }, panels: [] });

export function buildDashboard() {
  id = 0;
  const byPlatform = red("$__rate_interval", "platform");
  const byRoute = red("$__rate_interval", "span_name");
  const overRange = red("$__range", "span_name, platform");
  const DB = 'span_kind="SPAN_KIND_CLIENT", span_name=~"(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE).*"';

  return {
    title: "API Feature Lab: RED",
    uid: "api-feature-lab-red",
    description: "Rate, errors and duration of the API lab (api.djmiskey.com on Vercel and api-cf.djmiskey.com on Cloudflare Workers), from span metrics generated from its traces. Built by obs.djmiskey.com.",
    tags: ["api-feature-lab", "red", "span-metrics"],
    timezone: "browser",
    refresh: "1m",
    time: { from: "now-6h", to: "now" },
    schemaVersion: 39,
    editable: true,
    links: [{ title: "Observability Lab", url: "https://obs.djmiskey.com/metrics", type: "link", targetBlank: true }],
    templating: {
      list: [
        { name: "prometheus", label: "Metrics", type: "datasource", query: "prometheus", regex: ".*grafanacloud.*prom.*", current: {} },
        { name: "loki", label: "Logs", type: "datasource", query: "loki", regex: ".*grafanacloud.*logs.*", current: {} },
      ],
    },
    panels: [
      row("Per platform", 0),
      panel({ title: "Requests per second", unit: "reqps", byPlatform: true, targets: [{ expr: byPlatform.rate, legend: "{{platform}}" }] }, 0, 1),
      panel({ title: "p95 response time", unit: "s", byPlatform: true, description: "95% of requests were faster than this. Workers far from the database (Virginia) pay for distance on every query.", targets: [{ expr: byPlatform.p95, legend: "{{platform}}" }] }, 12, 1),
      panel({ title: "Server errors (5xx share)", unit: "percentunit", byPlatform: true, targets: [{ expr: errorShare("$__rate_interval", "platform"), legend: "{{platform}}" }] }, 0, 9),
      panel({ title: "Client errors (4xx share)", unit: "percentunit", byPlatform: true, description: "404s, 422s, 429s: the caller's mistakes, not the service's.", targets: [{ expr: errorShare("$__rate_interval", "platform", "clientErrors"), legend: "{{platform}}" }] }, 12, 9),

      row("Per endpoint", 17),
      panel({ title: "Requests per second, by endpoint", unit: "reqps", targets: [{ expr: byRoute.rate, legend: "{{span_name}}" }] }, 0, 18),
      panel({ title: "p95 by endpoint", unit: "s", targets: [{ expr: byRoute.p95, legend: "{{span_name}}" }] }, 12, 18),
      panel({
        title: "Endpoints over the selected range", type: "table", unit: "s", w: 24, h: 9,
        description: "p95 per endpoint and platform for the whole time range.",
        targets: [{ expr: overRange.p95, instant: true, format: "table" }],
        // An instant query's rows carry a timestamp nobody needs here: hide it,
        // and give the columns names a reader would use.
        transformations: [{ id: "organize", options: {
          excludeByName: { Time: true },
          indexByName: { span_name: 0, platform: 1, Value: 2 },
          renameByName: { span_name: "Endpoint", platform: "Platform", Value: "p95" },
        } }],
        options: { showHeader: true, sortBy: [{ displayName: "p95", desc: true }] },
      }, 0, 26),

      row("Database", 35),
      panel({ title: "p95 per query", unit: "s", description: "Client spans named after the statement and table, e.g. SELECT scores.", targets: [{ expr: `histogram_quantile(0.95, sum by (span_name) (rate(traces_spanmetrics_latency{${DB}}[$__rate_interval])))`, legend: "{{span_name}}" }] }, 0, 36),
      panel({ title: "Queries per second", unit: "qps", targets: [{ expr: `sum by (span_name) (rate(traces_spanmetrics_calls_total{${DB}}[$__rate_interval]))`, legend: "{{span_name}}" }] }, 12, 36),

      row("Logs", 44),
      {
        id: ++id, title: "Warnings and errors", type: "logs", datasource: LOKI, gridPos: { x: 0, y: 45, w: 24, h: 10 },
        description: "Every 4xx and 5xx request line, newest first. Each has a requestId: paste it into Tempo to open its trace.",
        options: { showTime: true, wrapLogMessage: true, sortOrder: "Descending", enableLogDetails: true },
        targets: [{ refId: "A", datasource: LOKI, expr: '{service_name="api-feature-lab"} | json | level=~"warn|error"' }],
      },
    ],
  };
}
