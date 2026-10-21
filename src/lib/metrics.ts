// RED metrics (Rate, Errors, Duration) for the API lab's endpoints, read from
// the span metrics Grafana's Tempo generates out of the traces it receives:
// traces_spanmetrics_calls_total counts spans, traces_spanmetrics_latency is
// a native histogram of their durations (seconds; one series, no _bucket).
// Labels: span_name (for a request, "GET /api/scores"), span_kind,
// status_code, and the dimensions turned on in Grafana: cloud_region, and on
// newer series cloud_platform and http_response_status_code.
//
// These are fixed queries: visitors choose one, they can't send their own.

const SERVER = 'span_kind="SPAN_KIND_SERVER"';
const WINDOW = "1h";

/**
 * A `platform` label from the region, which every series has (cloud_platform
 * only exists on series created after that dimension was switched on): Vercel
 * names regions like "iad1", Cloudflare uses airport codes like "JNB".
 */
const withPlatform = (expr: string) =>
  `label_replace(label_replace(${expr}, "platform", "vercel", "cloud_region", "[a-z]+[0-9]+"), "platform", "cloudflare-workers", "cloud_region", "[A-Z]+")`;

export const RED = {
  calls: `sum by (span_name, platform) (${withPlatform(`increase(traces_spanmetrics_calls_total{${SERVER}}[${WINDOW}])`)})`,
  errors: `sum by (span_name, platform) (${withPlatform(`increase(traces_spanmetrics_calls_total{${SERVER}, status_code="STATUS_CODE_ERROR"}[${WINDOW}])`)})`,
  clientErrors: `sum by (span_name, platform) (${withPlatform(`increase(traces_spanmetrics_calls_total{${SERVER}, http_response_status_code=~"4.."}[${WINDOW}])`)})`,
  p95: `histogram_quantile(0.95, sum by (span_name, platform) (${withPlatform(`rate(traces_spanmetrics_latency{${SERVER}}[${WINDOW}])`)}))`,
};

/** p95 of all requests, per platform, over time: the chart. */
export const P95_OVER_TIME = {
  query: `histogram_quantile(0.95, sum by (platform) (${withPlatform(`rate(traces_spanmetrics_latency{${SERVER}}[15m])`)}))`,
  hours: 6,
  stepSec: 300,
};

/** What the generator produces: its metric names, and full label sets of request spans. */
export const DISCOVER = { names: "traces_spanmetrics_.*", requests: `traces_spanmetrics_calls_total{${SERVER}}` };
