import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { CopyButton } from "@/components/CopyButton";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { ALERT } from "@/lib/metrics";
import { AlertCheck } from "./AlertCheck";

export const metadata: Metadata = { title: "Dashboards & alerts" };

const DASHBOARD = "/grafana/api-feature-lab-dashboard.json";

export default function AlertsPage() {
  return (
    <FeaturePage
      title="Dashboards & alerts"
      tagline="Seeing trouble at a glance, and being told about it."
      docs="https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/"
      whatItIs={<p>
        A <strong>dashboard</strong> puts the few graphs that say whether a service is healthy in one place: requests per
        second, error share and p95, per platform and per endpoint, with the database and the error logs below. An{" "}
        <strong>alert</strong> watches one of those numbers so nobody has to: Grafana evaluates its rule every minute and
        sends a notification when it holds for long enough. Good alerts are about symptoms users feel (errors, slowness),
        not causes, and they need a minimum volume, so one failed request at 3 a.m. doesn&apos;t wake anyone. Both are
        defined as code here: the dashboard is generated from the same queries as the <a href="/metrics">Metrics</a> page.
      </p>}
      whenToUse={[
        "A dashboard per service, opened when something seems off",
        "Alerts on symptoms: error rate and latency users would notice",
        "Thresholds with a minimum volume and a duration, to avoid noise",
      ]}
    >
      <Demo title="1. The dashboard">
        <p className="mt-0 text-sm">
          <a href={DASHBOARD} download="api-feature-lab-dashboard.json">Download the dashboard JSON</a>, then in Grafana:{" "}
          <strong>Dashboards → New → Import</strong>, upload the file (or paste its contents), pick the{" "}
          <code>grafanacloud-…-prom</code> and <code>…-logs</code> data sources, and Import. It needs no token: the data
          sources are variables you choose on import.
        </p>
        <ul className="mb-0 text-sm">
          <li><strong>Per platform</strong>: requests per second, p95, 5xx share and 4xx share, Vercel in blue and Workers in orange (the colours used on this site).</li>
          <li><strong>Per endpoint</strong>: rate and p95 by route, and a table of p95 over the whole time range.</li>
          <li><strong>Database</strong>: p95 and rate of each query, by statement and table (<code>SELECT scores</code>).</li>
          <li><strong>Logs</strong>: every 4xx and 5xx line from Loki, each with the request id that opens its trace.</li>
        </ul>
      </Demo>

      <Demo title="2. An error-rate alert">
        <p className="mt-0 text-sm">
          Fires when more than {ALERT.threshold * 100}% of a platform&apos;s requests are server errors over {ALERT.window}, with
          at least {ALERT.minRequests} requests. The rule returns a value only while firing, so its condition is &quot;is
          above 0&quot;, and <strong>no data must count as Normal</strong>.
        </p>
        <ul className="text-sm">
          <li><strong>Easiest (works on a phone):</strong> on the imported dashboard, the <em>Alert: server error rate</em> panel&apos;s
            menu → <strong>More… → New alert rule</strong>. The query arrives filled in.</li>
          <li><strong>Or by hand:</strong> <strong>Alerting → Alert rules → New alert rule</strong>, data source{" "}
            <code>grafanacloud-…-prom</code>, query editor in <em>Code</em> mode, paste the rule below.</li>
          <li>Then: evaluate every 1m with a 5m pending period, label <code>service=api-feature-lab</code>, contact point your e-mail.</li>
        </ul>
        <pre className="m-0 mb-2 overflow-x-auto rounded-lg bg-code px-3 py-2 font-mono text-xs" tabIndex={0} data-testid="rule">{ALERT.rule}</pre>
        <div className="mb-3"><CopyButton text={ALERT.rule} label="Copy the rule" /></div>
        <AlertCheck />
      </Demo>

      <CodePeek file="lib/dashboard.ts" />
      <CodePeek file="lib/metrics.ts" />
    </FeaturePage>
  );
}
