import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { AskTheLogs } from "./AskTheLogs";
import { FindMyLine } from "./FindMyLine";

export const metadata: Metadata = { title: "Structured logs" };

export default function LogsPage() {
  return (
    <FeaturePage
      title="Structured logs"
      tagline="One JSON line per request, searchable by any field."
      docs="https://grafana.com/docs/loki/latest/query/"
      whatItIs={<p>
        A structured log line is data, not prose: a JSON object with named fields instead of a sentence like
        &quot;Fetched task 42 in 12ms&quot;. The API lab writes one per request, a <strong>canonical log line</strong>: everything worth
        knowing about the request in one place (route, status, duration, database queries, who asked, what it did), written
        when the request ends. Because the fields have names, the logs become a database you can query: find one request by
        its id, or count, average and rank across thousands. Here the lines are shipped to <strong>Grafana Loki</strong> over
        OpenTelemetry and queried with <strong>LogQL</strong>.
      </p>}
      whenToUse={[
        "Always: plain-text logs can only be grepped, JSON can be queried",
        "One wide line per request beats many narrow ones",
        "Answering questions nobody planned a metric for",
      ]}
    >
      <Demo title="1. Send a request, find its line">
        <FindMyLine />
        <p className="text-sm text-muted">
          This site&apos;s server sends the request with a <code>traceparent</code> header it made up, so it knows the id the API
          will log it under, then asks Loki for <code>{'{service_name="api-feature-lab"} |= "<id>"'}</code> every two seconds
          until the line arrives. The API ships it after answering, so nobody waits for the logging.
        </p>
      </Demo>

      <Demo title="2. Ask the logs a question">
        <AskTheLogs />
        <p className="text-sm text-muted">
          <code>| json</code> parses each line; <code>unwrap</code> turns a field into a number to average or rank. These are
          the same lines as above, now treated as a table. (Questions like these are what metrics answer more cheaply: Phase 3.)
        </p>
      </Demo>

      <CodePeek file="lib/queries.ts" />
      <CodePeek file="lib/grafana.ts" />
      <p className="text-sm text-muted">
        The logging code itself is in the API lab:{" "}
        <a href="https://github.com/DamianMiskey/api-feature-lab/blob/main/src/api/observe.ts">observe.ts</a> (the line) and{" "}
        <a href="https://github.com/DamianMiskey/api-feature-lab/blob/main/src/api/telemetry.ts">telemetry.ts</a> (shipping it).
      </p>
    </FeaturePage>
  );
}
