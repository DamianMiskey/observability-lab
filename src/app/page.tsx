import Link from "next/link";
import { panel } from "@/components/FeaturePage";
import { cx } from "@/components/ui";
import { categories, features } from "@/lib/features";

export default function Home() {
  const ready = features.filter((f) => f.ready).length;
  return (
    <article>
      <header className="mb-6">
        <h1>Observability Lab</h1>
        <p className="m-0 text-[1.05rem] text-muted">
          Logs, traces and metrics, one technique per page, watching a real system in production: the{" "}
          <a href="https://api.djmiskey.com">API lab</a>, which runs on Vercel and on Cloudflare Workers over one Postgres
          database. A sibling of the <a href="https://vercel.djmiskey.com">Vercel</a>, <a href="https://lab.djmiskey.com">Cloudflare</a>,{" "}
          <a href="https://motion.djmiskey.com">Motion</a> and API labs. {ready} of {features.length} built so far.
        </p>
      </header>
      <section className={cx(panel, "mb-4 [&_li+li]:mt-1.5")}>
        <h2>How it&apos;s built</h2>
        <ul>
          <li><strong>The system being watched</strong> is the API lab: every request writes one structured JSON log line with an id that follows it across services.</li>
          <li><strong>OpenTelemetry</strong>, the vendor-neutral standard, carries logs, traces and metrics out of the code over OTLP.</li>
          <li><strong>Grafana Cloud</strong> (free plan) stores and queries them: Loki for logs, Tempo for traces, Mimir for metrics.</li>
          <li><strong>These pages</strong> send real requests to the API, then show what the telemetry says about them.</li>
        </ul>
      </section>
      {categories.map((cat) => (
        <section key={cat} className="mt-7">
          <h2>{cat}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {features.filter((f) => f.category === cat).map((f) => {
              const body = (
                <>
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-sm text-muted">{f.summary}</span>
                  <span className={cx("self-start rounded-full px-2 py-px text-xs", f.ready ? "bg-accent text-white" : "bg-code text-muted")}>{f.ready ? "Live" : `Phase ${f.phase}`}</span>
                </>
              );
              const tile = "flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5 text-fg no-underline";
              return f.ready
                ? <Link key={f.slug} href={`/${f.slug}`} className={cx(tile, "hover:border-accent")}>{body}</Link>
                : <div key={f.slug} className={tile}>{body}</div>;
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
