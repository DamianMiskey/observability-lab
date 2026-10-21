import { buildDashboard } from "@/lib/dashboard";

// The dashboard as a static file (built at build time): import it in Grafana.
export function GET() {
  return new Response(JSON.stringify(buildDashboard(), null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'inline; filename="api-feature-lab-dashboard.json"' },
  });
}
