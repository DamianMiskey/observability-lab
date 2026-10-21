// RED metrics (Rate, Errors, Duration) for the API lab's endpoints, read from
// the span metrics Grafana's Tempo generates out of the traces it receives:
// traces_spanmetrics_calls_total counts spans, traces_spanmetrics_latency is
// a native histogram of their durations (seconds; one series, no _bucket).
// Labels: span_name (for a request, "GET /api/scores"), span_kind,
// status_code, and the dimensions turned on in Grafana: cloud_region, and on
// newer series cloud_platform and http_response_status_code.
//
// These are fixed queries: visitors choose one, they can't send their own.

// Request spans that carry a region: series from before the region dimension
// was switched on have none, so no platform can be derived for them.
export const SERVER = 'span_kind="SPAN_KIND_SERVER", cloud_region!=""';
const WINDOW = "1h";

/**
 * A `platform` label from the region, which every series has (cloud_platform
 * only exists on series created after that dimension was switched on): Vercel
 * names regions like "iad1", Cloudflare uses airport codes like "JNB".
 */
export const withPlatform = (expr: string) =>
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

/**
 * Errors as a share of requests. With no errors at all there's no error series
 * to divide, so the query would return nothing: "or" falls back to the request
 * series times zero, giving a real 0% (a flat line, not "No data").
 */
export const errorShare = (window: string, by: string, which: "errors" | "clientErrors" = "errors") =>
  `(${red(window, by)[which]} or ${red(window, by).rate} * 0) / ${red(window, by).rate}`;

/** The same RED queries for any window and grouping (the Grafana dashboard uses $__rate_interval). */
export const red = (window: string, by: string) => ({
  rate: `sum by (${by}) (${withPlatform(`rate(traces_spanmetrics_calls_total{${SERVER}}[${window}])`)})`,
  errors: `sum by (${by}) (${withPlatform(`rate(traces_spanmetrics_calls_total{${SERVER}, status_code="STATUS_CODE_ERROR"}[${window}])`)})`,
  clientErrors: `sum by (${by}) (${withPlatform(`rate(traces_spanmetrics_calls_total{${SERVER}, http_response_status_code=~"4.."}[${window}])`)})`,
  p95: `histogram_quantile(0.95, sum by (${by}) (${withPlatform(`rate(traces_spanmetrics_latency{${SERVER}}[${window}])`)}))`,
});

/**
 * The alert: more than 5% of requests answered with a 5xx over ten minutes, on
 * at least ten requests (so one failure at 3 a.m. doesn't page anyone).
 * The same expression goes into the Grafana alert rule.
 */
export const ALERT = {
  threshold: 0.05,
  minRequests: 10,
  window: "10m",
  get errorShare() { return errorShare(this.window, "platform"); },
  get volume() { return `sum by (platform) (${withPlatform(`increase(traces_spanmetrics_calls_total{${SERVER}}[${this.window}])`)})`; },
  /** What goes into Grafana: a series per platform while it's firing, nothing otherwise. */
  get rule() { return `(${this.errorShare}) > ${this.threshold} and (${this.volume}) >= ${this.minRequests}`; },
};
