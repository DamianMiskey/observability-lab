// Real user monitoring data from the Motion lab (Grafana Faro), as stored in
// Loki: logfmt lines with kind=measurement (web vitals), kind=exception
// (JavaScript errors), kind=event (e.g. faro.tracing.fetch, with a traceID).
// Fixed queries only.

/** Faro's lines are labelled by app; the label name depends on the stack's version, so both are tried. */
export const RUM_SELECTORS = ['{service_name="motion-lab"}', '{app_name="motion-lab"}'];

export const WINDOW = "24h";

/** Core Web Vitals and their "good" / "needs improvement" limits (web.dev). Times in ms. */
export const VITALS = [
  { key: "lcp", name: "LCP", what: "Largest content shown", good: 2500, poor: 4000, unit: "ms" },
  { key: "inp", name: "INP", what: "Response to a tap or click", good: 200, poor: 500, unit: "ms" },
  { key: "cls", name: "CLS", what: "Layout shifting", good: 0.1, poor: 0.25, unit: "" },
  { key: "fcp", name: "FCP", what: "First content shown", good: 1800, poor: 3000, unit: "ms" },
  { key: "ttfb", name: "TTFB", what: "Server's first byte", good: 800, poor: 1800, unit: "ms" },
] as const;
export type VitalKey = (typeof VITALS)[number]["key"];

/** p75 of one vital per page over the window: the percentile Google's Core Web Vitals are judged at. */
export const vitalQuery = (selector: string, key: VitalKey) =>
  `quantile_over_time(0.75, ${selector} | logfmt | kind="measurement" | type="web-vitals" | ${key}!="" | unwrap ${key} [${WINDOW}]) by (page_url)`;

/** How many visits (sessions) the window holds. */
export const sessionsQuery = (selector: string) => `count(count by (session_id) (count_over_time(${selector} | logfmt | session_id!="" [${WINDOW}])))`;

export const errorsQuery = (selector: string) => `${selector} | logfmt | kind="exception"`;

/** Requests from a page to the API lab, whose traces continue into the API. */
export const apiFetchQuery = (selector: string) => `${selector} | logfmt | kind="event" | event_name="faro.tracing.fetch" | event_data_url_full=~"https://api\\\\.djmiskey\\\\.com/.*"`;

export type Rating = "good" | "needs-improvement" | "poor";
export function rate(key: VitalKey, value: number): Rating {
  const v = VITALS.find((x) => x.key === key)!;
  return value <= v.good ? "good" : value <= v.poor ? "needs-improvement" : "poor";
}
