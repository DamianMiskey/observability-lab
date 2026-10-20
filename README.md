# Observability Lab

Logs, traces and metrics, one technique per page, watching a real system in production: the [API lab](https://api.djmiskey.com) (Hono on Vercel and on Cloudflare Workers, one Neon Postgres). A sibling of the [Vercel](https://vercel.djmiskey.com), [Cloudflare](https://lab.djmiskey.com), [Motion](https://motion.djmiskey.com) and [API](https://api.djmiskey.com) labs.

**Stack:** Next.js 16 (App Router, Cache Components) · Tailwind CSS v4 · OpenTelemetry · Grafana Cloud (Free plan: Loki, Tempo, Mimir) · target: **https://obs.djmiskey.com** on Vercel (Hobby).

The instrumentation lives in the API lab's repository (`src/api/observe.ts` and friends); this site explains it and shows what it records.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Checks

```bash
npm run lint
npm run typecheck
npm test           # Vitest: registry, robots/sitemap
npm run build
npm run e2e        # Playwright against the build (starts `npm start` on :3400)
BASE_URL=https://obs.djmiskey.com npm run e2e   # a deployment: read-only tests only
```

CI (`.github/workflows/ci.yml`) runs all of them on every pull request, with no secrets.

## Notes

- **Free tiers only.** Vercel's Drains (its built-in log and trace export) are Pro-only and billed per GB, so on Hobby the API exports its own telemetry over OTLP: ordinary outbound HTTPS, no Vercel cost. Grafana Cloud Free: 14-day retention, 50 GB each of logs and traces a month, 10k metric series, no card. Workers Logs on the Free plan: 200k events a day, 3-day retention.
- **Grafana stack** in US East (Virginia), next to the API's Vercel region (iad1) and Neon (us-east-1), so exporting adds as little as possible to each request. OTLP endpoint `https://otlp-gateway-prod-us-east-3.grafana.net/otlp`, instance `1884408`. The write token (`GRAFANA_OTLP_TOKEN`) is set only in the API lab's Vercel project and Worker, never in this repository.

- **Reading telemetry back** (`src/lib/grafana.ts`): this site's server queries Grafana with a read-only access policy token (`GRAFANA_READ_TOKEN`: logs/traces/metrics read, no write; production only). Loki `https://logs-prod-042.grafana.net` (user 1842184); Tempo `https://tempo-prod-30-prod-us-east-3.grafana.net/tempo` (1836485) and Prometheus `https://prometheus-prod-66-prod-us-east-3.grafana.net/api/prom` (3693039) for later phases. Without the token, the routes answer 503 `notConfigured` and the pages say so (local, CI, previews).
- **Fixed lists only**: `/api/send` sends one of three read-only requests (`src/lib/targets.ts`) to one or both copies of the API, with a `traceparent` it generates so it knows the request id; `/api/query` runs one of a few preset LogQL queries (`src/lib/queries.ts`). Visitors can't make the server fetch an arbitrary URL or run arbitrary queries on the account. `/api/find` looks up one 32-hex-character id with a Loki line filter over the last 30 minutes.
- **Requests come from Washington, D.C.**: the pages ask this site's server (Vercel iad1) to call the API, so the Worker copy also runs near Virginia for these requests and is fast; from a browser in Johannesburg it runs in Johannesburg, an ocean away from the database.

## Roadmap

- [x] **Phase 1: Logs.** Structured JSON log lines and request ids (in the API lab), shipped to Grafana Loki over OTLP; pages that send a request and find its line, ask the logs LogQL questions, and follow one id across both platforms
- [ ] **Phase 2: Traces.** OpenTelemetry spans for requests, middleware and database queries, on Vercel and Workers, in Grafana Tempo
- [ ] **Phase 3: Metrics.** Rate, errors and duration per endpoint, a dashboard, and an error-rate alert
- [ ] **Phase 4: The browser.** Web vitals and front-end errors from real visitors (Grafana Faro)
- [ ] **Phase 5: From outside.** Synthetic checks of the live API on a schedule, plus the Playwright suites as traffic
