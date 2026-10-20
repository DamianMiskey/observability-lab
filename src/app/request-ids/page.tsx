import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { AcrossPlatforms } from "./AcrossPlatforms";

export const metadata: Metadata = { title: "Request IDs" };

export default function RequestIdsPage() {
  return (
    <FeaturePage
      title="Request IDs"
      tagline="One id that follows a request across services and platforms."
      docs="https://www.w3.org/TR/trace-context/"
      whatItIs={<p>
        Every request the API lab handles gets an id, returned as <code>X-Request-Id</code>, written into its log line, and
        included in every error body, so &quot;it failed&quot; becomes &quot;request <code>a24e…</code> failed&quot;, which
        anyone can look up. The id is a <strong>W3C Trace Context</strong> trace id: if the caller sends a{" "}
        <code>traceparent</code> header (<code>00-&lt;trace id&gt;-&lt;parent span id&gt;-&lt;flags&gt;</code>), the API keeps
        its trace id instead of making a new one, and passes it on in calls it makes itself (its webhook deliveries). So one
        id ties together everything one action caused, across services, across platforms, and later across traces (Phase 2).
      </p>}
      whenToUse={[
        "Every API: return the id, and put it in error bodies",
        "Accept traceparent from callers; send it on to whatever you call",
        "Support tickets: ask for the id, not a screenshot",
      ]}
    >
      <Demo title="1. One id, two platforms">
        <AcrossPlatforms />
        <p className="text-sm text-muted">
          This site sends the same 404 request to both copies of the API with one <code>traceparent</code>. Both answer with
          that trace id as their <code>X-Request-Id</code>, both put it in the error body, and Loki returns two lines for it:
          one from Vercel in Washington, D.C., one from a Worker. (Called from this site&apos;s server, which runs in
          Washington too, the Worker runs nearby and is fast; called from a browser far away, it runs near the browser.)
        </p>
      </Demo>

      <CodePeek file="lib/targets.ts" />
      <CodePeek file="app/api/send/route.ts" />
    </FeaturePage>
  );
}
