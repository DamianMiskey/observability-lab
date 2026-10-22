import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { BrowserTrace, ErrorsList, VitalsTable } from "./RumDemos";

export const metadata: Metadata = { title: "Real user monitoring" };

export default function RealUsersPage() {
  return (
    <FeaturePage
      title="Real user monitoring"
      tagline="Web vitals and errors from visitors' own browsers."
      docs="https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/"
      whatItIs={<p>
        Server-side telemetry stops at the server. What a visitor actually experiences, how long until the page shows
        something, whether a tap gets a quick response, whether content jumps while loading, and whether JavaScript crashed,
        happens in their browser, on their device and network. <strong>Real user monitoring</strong> measures it there and
        reports it home. The <a href="https://motion.djmiskey.com">Motion lab</a> runs <strong>Grafana Faro</strong>, which
        records the <strong>Core Web Vitals</strong> (LCP: largest content shown, INP: response to input, CLS: layout shift,
        plus FCP and TTFB), JavaScript errors, and request timings, and sends them to Grafana Cloud. It loads only after the
        page has finished loading, so the measuring can&apos;t make pages slower.
      </p>}
      whenToUse={[
        "Any public site: lab tests on your own machine aren't your visitors' phones",
        "Catching JavaScript errors that never reach the server",
        "Following one action from the browser into the back end",
      ]}
    >
      <Demo title="1. Core Web Vitals, per page">
        <VitalsTable />
        <p className="text-sm text-muted">
          Ratings use Google&apos;s thresholds: LCP good under 2.5 s, INP under 200 ms, CLS under 0.1, FCP under 1.8 s, TTFB
          under 0.8 s. A page needs a visit (and for INP, a tap) to have numbers.
        </p>
      </Demo>

      <Demo title="2. Errors from visitors' browsers">
        <ErrorsList />
      </Demo>

      <Demo title="3. A trace that starts in a browser">
        <BrowserTrace />
        <p className="text-sm text-muted">
          Faro adds a <code>traceparent</code> header to the Motion lab&apos;s requests to the API lab, so the API&apos;s spans join
          the browser&apos;s trace: one waterfall from a visitor&apos;s tap to the database query.
        </p>
      </Demo>

      <p className="text-sm text-muted">
        Each visit is a random id per browser tab, with no cookies, names or accounts; session replay is off. The data is
        Faro&apos;s log lines in Loki (<code>kind=measurement</code>, <code>kind=exception</code>, <code>kind=event</code>), queried with LogQL.
      </p>

      <CodePeek file="lib/rum.ts" />
      <CodePeek file="app/api/rum/route.ts" />
    </FeaturePage>
  );
}
