import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { P95Chart } from "./P95Chart";
import { RedTable } from "./RedTable";

export const metadata: Metadata = { title: "RED metrics" };

export default function MetricsPage() {
  return (
    <FeaturePage
      title="RED metrics"
      tagline="Rate, errors and duration for every endpoint."
      docs="https://grafana.com/docs/grafana-cloud/send-data/traces/configure/metrics-generator/"
      whatItIs={<p>
        Logs and traces describe single requests; <strong>metrics</strong> are numbers about all of them, cheap to store
        and fast to query for months. For a service, three answer most questions: the <strong>R</strong>ate of requests, the
        share that are <strong>E</strong>rrors, and their <strong>D</strong>uration, as a percentile like p95 (95% of requests
        were faster than this). Metrics usually come from counters a long-running process keeps in memory and reports every
        minute, which suits a server but not serverless functions that may live for one request. So here they&apos;re{" "}
        <strong>generated from the traces</strong>: Grafana&apos;s Tempo counts every span it receives into Prometheus series
        (<code>traces_spanmetrics_calls_total</code> and a <code>…_latency</code> histogram), labelled by span name, status,
        and the dimensions chosen: platform, region and HTTP status code.
      </p>}
      whenToUse={[
        "Dashboards and alerts: anything watched continuously",
        "Trends over weeks, where keeping every request would cost too much",
        "Then a trace or log line to explain the spike",
      ]}
    >
      <Demo title="1. Every endpoint at a glance">
        <RedTable />
      </Demo>

      <Demo title="2. p95 over time, per platform">
        <P95Chart />
        <p className="text-sm text-muted">
          A percentile from a histogram: each span&apos;s duration falls into a bucket, and{" "}
          <code>histogram_quantile(0.95, …)</code> estimates the time 95% of requests stayed under. Spikes on the Workers line
          are mostly distance (visitors far from the database, see <a href="/traces">Traces</a>); on the Vercel line, cold starts.
        </p>
      </Demo>

      <p className="text-sm text-muted">
        Metrics are an aggregate: they can say p95 rose at 14:05 on <code>GET /api/scores</code>, not which request was slow.
        That&apos;s what the request id is for: find one slow request in the <a href="/logs">logs</a>, open its{" "}
        <a href="/traces">trace</a>. Each label value is a separate series, and the free plan allows 10,000, so labels stay
        low-cardinality: route patterns, not paths; platform, not user.
      </p>

      <CodePeek file="lib/metrics.ts" />
      <CodePeek file="app/metrics/P95Chart.tsx" />
    </FeaturePage>
  );
}
