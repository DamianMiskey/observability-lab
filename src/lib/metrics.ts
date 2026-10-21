// RED metrics (Rate, Errors, Duration) for the API lab's endpoints, read from
// the span metrics Grafana's Tempo generates out of the traces it receives:
// traces_spanmetrics_calls_total counts spans, traces_spanmetrics_latency is
// a histogram of their durations (seconds). Labels: span_name (for a request,
// "GET /api/scores"), span_kind, status_code, and the dimensions turned on in
// Grafana: cloud_platform, cloud_region, http_response_status_code.
//
// These are fixed queries: visitors choose one, they can't send their own.

const SERVER = 'span_kind="SPAN_KIND_SERVER"';
const WINDOW = "1h";

export const RED = {
  calls: `sum by (span_name, cloud_platform) (increase(traces_spanmetrics_calls_total{${SERVER}}[${WINDOW}]))`,
  errors: `sum by (span_name, cloud_platform) (increase(traces_spanmetrics_calls_total{${SERVER}, status_code="STATUS_CODE_ERROR"}[${WINDOW}]))`,
  clientErrors: `sum by (span_name, cloud_platform) (increase(traces_spanmetrics_calls_total{${SERVER}, http_response_status_code=~"4.."}[${WINDOW}]))`,
  p95: `histogram_quantile(0.95, sum by (le, span_name, cloud_platform) (rate(traces_spanmetrics_latency_bucket{${SERVER}}[${WINDOW}])))`,
};

/** p95 of all requests, per platform, over time: the chart. */
export const P95_OVER_TIME = {
  query: `histogram_quantile(0.95, sum by (le, cloud_platform) (rate(traces_spanmetrics_latency_bucket{${SERVER}}[15m])))`,
  hours: 6,
  stepSec: 300,
};

/** What the generator produces: its metric names, and full label sets of request spans. */
export const DISCOVER = { names: "traces_spanmetrics_.*", requests: `traces_spanmetrics_calls_total{${SERVER}}` };
