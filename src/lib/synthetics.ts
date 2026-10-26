// Synthetic checks: Grafana Synthetic Monitoring probes the labs on a
// schedule from chosen cities and writes Prometheus metrics, labelled with
// the check (`job`), its target (`instance`) and where it ran from (`probe`):
//   probe_success                1 if the check passed, 0 if not
//   probe_duration_seconds       the whole check
//   probe_http_duration_seconds  the HTTP request split by `phase`
// Fixed queries only.

const WINDOW = "24h";

export const SYNTHETICS = {
  /** Up right now (the latest result), per check and probe. */
  up: "max by (job, instance, probe) (probe_success)",
  /** Share of runs that passed over the window. */
  uptime: `avg by (job, instance, probe) (avg_over_time(probe_success[${WINDOW}]))`,
  /** Average time per check over the window. */
  duration: `avg by (job, instance, probe) (avg_over_time(probe_duration_seconds[${WINDOW}]))`,
  /** The latest request's phases (DNS, connect, TLS, processing, transfer). */
  phases: "max by (job, probe, phase) (probe_http_duration_seconds)",
  window: WINDOW,
};

/** What a phase means, in the order a request goes through them. */
export const PHASES = [
  { key: "resolve", name: "DNS lookup" },
  { key: "connect", name: "TCP connect" },
  { key: "tls", name: "TLS handshake" },
  { key: "processing", name: "Server working" },
  { key: "transfer", name: "Download" },
] as const;

/** Every label set the generator writes for probe_success: to check names. */
export const SYNTHETICS_DISCOVER = "probe_success";
