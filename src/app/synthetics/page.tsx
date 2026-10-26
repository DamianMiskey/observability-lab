import type { Metadata } from "next";
import { CodePeek } from "@/components/CodePeek";
import { Demo, FeaturePage } from "@/components/FeaturePage";
import { ChecksStatus, PhaseBars } from "./SyntheticsDemos";

export const metadata: Metadata = { title: "Synthetic checks" };

export default function SyntheticsPage() {
  return (
    <FeaturePage
      title="Synthetic checks"
      tagline="Probing the live sites on a schedule, from around the world."
      docs="https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/"
      whatItIs={<p>
        Everything else in this lab waits for traffic: no visitors, no logs, traces or vitals. A <strong>synthetic check</strong>{" "}
        makes its own traffic. <strong>Grafana Synthetic Monitoring</strong> sends a request to each site every few minutes
        from chosen cities (here North Virginia, next to the API and its database, and Cape Town, far from both) and records
        whether it worked and how long each part took. So an outage at 3 a.m. shows up even if nobody visits, and the same
        request from two places shows what distance costs. The checks: the API on Vercel and on Cloudflare Workers, a
        leaderboard read that goes all the way to the database, and this site.
      </p>}
      whenToUse={[
        "Knowing a site is down before the first visitor does",
        "Comparing regions: what users far away experience",
        "Checking a whole path (API → database), not just that a server answers",
      ]}
    >
      <Demo title="1. Every check, from every probe">
        <ChecksStatus />
      </Demo>

      <Demo title="2. Where the time goes">
        <PhaseBars />
        <p className="text-sm text-muted">
          The latest request of each check, split into its phases. From Cape Town, connecting and the TLS handshake each cost a
          round trip across the Atlantic before the server does any work; from North Virginia they&apos;re almost free. A
          Cloudflare Worker answers from the city nearest the probe, so its connect time stays small everywhere.
        </p>
      </Demo>

      <CodePeek file="lib/synthetics.ts" />
      <CodePeek file="app/api/synthetics/route.ts" />
    </FeaturePage>
  );
}
