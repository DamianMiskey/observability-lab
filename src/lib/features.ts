// Single source of truth for the dashboard: every technique in the lab,
// grouped by category. `ready: false` marks a page on the roadmap; it shows
// on the home page but has no route yet.
export type Category = "Logs" | "Traces" | "Metrics" | "The browser" | "From outside";

export type Feature = {
  slug: string;
  name: string;
  category: Category;
  summary: string;
  phase: number;
  ready: boolean;
};

export const features: Feature[] = [
  { slug: "logs", name: "Structured logs", category: "Logs", phase: 1, ready: true,
    summary: "One JSON line per request, searchable by any field." },
  { slug: "request-ids", name: "Request IDs", category: "Logs", phase: 1, ready: true,
    summary: "One id that follows a request across services and platforms." },

  { slug: "traces", name: "Distributed tracing", category: "Traces", phase: 2, ready: true,
    summary: "Where the time goes: every step of a request as a span." },

  { slug: "metrics", name: "RED metrics", category: "Metrics", phase: 3, ready: true,
    summary: "Rate, errors and duration for every endpoint." },
  { slug: "alerts", name: "Dashboards & alerts", category: "Metrics", phase: 3, ready: true,
    summary: "Seeing trouble at a glance, and being told about it." },

  { slug: "real-users", name: "Real user monitoring", category: "The browser", phase: 4, ready: true,
    summary: "Web vitals and errors from visitors' own browsers." },

  { slug: "synthetics", name: "Synthetic checks", category: "From outside", phase: 5, ready: false,
    summary: "Probing the live API on a schedule, from around the world." },
];

export const categories = [...new Set(features.map((f) => f.category))];
export const getFeature = (slug: string) => features.find((f) => f.slug === slug);
