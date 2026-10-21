import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { TraceDemo } from "./TraceDemo";

export const metadata: Metadata = { title: "Distributed tracing" };

export default function TracesPage() {
  return (
    <FeaturePage
      title="Distributed tracing"
      tagline="Where the time goes: every step of a request as a span."
      docs="https://opentelemetry.io/docs/concepts/signals/traces/"
      whatItIs={<p>
        A log line says a request took 900 ms; a <strong>trace</strong> says which part. Each piece of work is a{" "}
        <strong>span</strong>: a name, a start, a duration, attributes, and the span it ran inside. The request is the root
        (a <em>server</em> span), the middleware steps are children, and every database query is a <em>client</em> span, so
        the trace is a tree you can draw as a timeline. Spans share the request&apos;s trace id, the same id as its log line,
        and a <code>traceparent</code> header carries it into the next service, so one trace can cross services and
        platforms. The API lab records spans with a small tracer of its own and ships them to <strong>Grafana Tempo</strong>{" "}
        over OpenTelemetry.
      </p>}
      whenToUse={[
        "Finding out why a request is slow, not just that it is",
        "Following one action through several services",
        "Seeing what a cold start, a retry or an extra query costs",
      ]}
    >
      <Demo title="1. Send a request, draw its trace">
        <TraceDemo />
        <p className="text-sm text-muted">
          Try the leaderboard on Cloudflare Workers from your browser, then from this site&apos;s server. From your browser
          the Worker runs in the Cloudflare city nearest you; if that&apos;s far from Virginia, where the database is, the
          <code> SELECT scores</code> span is nearly the whole request: distance, not slow code. From this site&apos;s server
          (in Washington, D.C.) the Worker runs next door to the database and the same query takes a few milliseconds. On a
          fresh Vercel instance you may also catch <code>db.ensure-schema</code>: thirteen queries a cold start spends
          creating tables that already exist.
        </p>
      </Demo>

      <p className="text-sm text-muted">
        The bars show waiting, not computing: on Workers the clock only moves across I/O. A trace that crosses services,
        like a <a href="https://api.djmiskey.com/webhooks">webhook delivery</a> (the request that sends it, each delivery
        attempt, and the receiving request inside it), is one trace too, joined by the <code>traceparent</code> header.
      </p>

      <CodePeek file="app/traces/Waterfall.tsx" />
      <CodePeek file="lib/grafana.ts" />
      <p className="text-sm text-muted">
        The tracer itself is in the API lab:{" "}
        <a href="https://github.com/DamianMiskey/api-feature-lab/blob/main/src/api/observe.ts">observe.ts</a> (spans) and{" "}
        <a href="https://github.com/DamianMiskey/api-feature-lab/blob/main/src/api/db/client.ts">db/client.ts</a> (a span per query).
      </p>
    </FeaturePage>
  );
}
