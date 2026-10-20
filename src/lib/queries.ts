// Questions this site asks the logs, written in LogQL. Each is a fixed query:
// visitors pick one by id, they can't send their own (which would let anyone
// run expensive queries on this account).
import { API_STREAM } from "./grafana";

export const QUERIES = {
  volume: {
    question: "How many requests did each platform serve in the last hour?",
    logql: `sum by (platform) (count_over_time(${API_STREAM} | json | msg="request" [1h]))`,
    unit: "requests",
  },
  p95: {
    question: "How slow is the slowest 5% of requests, per platform (p95, last hour)?",
    logql: `quantile_over_time(0.95, ${API_STREAM} | json | msg="request" | unwrap durationMs [1h]) by (platform)`,
    unit: "ms",
  },
  errors: {
    question: "Which routes answered with 4xx or 5xx in the last hour?",
    logql: `sum by (route, status) (count_over_time(${API_STREAM} | json | msg="request" | status >= 400 [1h]))`,
    unit: "requests",
  },
  queries: {
    question: "Which routes make the most database queries per request (average, last hour)?",
    logql: `avg_over_time(${API_STREAM} | json | msg="request" | unwrap dbQueries [1h]) by (route)`,
    unit: "queries",
  },
} as const;
export type QueryId = keyof typeof QUERIES;
export const isQueryId = (id: string): id is QueryId => id in QUERIES;
