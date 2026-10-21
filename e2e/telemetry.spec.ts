import { expect, test } from "@playwright/test";
import { overflow } from "./helpers";

// Pages that send a real (read-only) request to the API lab, then look for its
// log line in Grafana. Without a read token (local, CI) they must say so
// clearly; on the deployed site the line must actually come back.

const LIVE = !!process.env.BASE_URL;

test("logs: the request is sent and its id shown @readonly", async ({ page }) => {
  await page.goto("/logs");
  await page.getByRole("button", { name: "GET /api/health" }).click();
  await page.getByRole("button", { name: "Send it, then find its log line" }).click();
  await expect(page.getByTestId("sent")).toContainText(/200 in \d+ ms · X-Request-Id: [0-9a-f]{32}/, { timeout: 20_000 });
  if (!LIVE) await expect(page.getByText("Reading from Grafana isn't set up")).toBeVisible();
  // Results (long ids, JSON) must wrap or scroll in their box, not widen the page.
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("request ids: one id comes back from both platforms @readonly", async ({ page }) => {
  await page.goto("/request-ids");
  await page.getByRole("button", { name: "One id, two platforms" }).click();
  for (const p of ["vercel", "workers"]) {
    await expect(page.locator(`[data-platform="${p}"]`).getByTestId("same-id")).toContainText("both carry the trace id", { timeout: 20_000 });
  }
  // Results (long ids, JSON) must wrap or scroll in their box, not widen the page.
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("on the live site, the line comes back from Loki @deployed", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/logs");
  await page.getByRole("button", { name: "Send it, then find its log line" }).click();
  await expect(page.getByTestId("found")).toContainText('"msg": "request"', { timeout: 60_000 });
  await expect(page.getByTestId("found")).toContainText('"route": "/api/scores"');
  // Results (long ids, JSON) must wrap or scroll in their box, not widen the page.
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("traces: a request from the browser carries our traceparent @readonly", async ({ page }) => {
  await page.goto("/traces");
  await page.getByRole("button", { name: "Send it, then draw its trace" }).click();
  await expect(page.getByTestId("sent")).toContainText(/200 in \d+ ms .* trace [0-9a-f]{32}/, { timeout: 20_000 });
  if (!LIVE) await expect(page.getByText("Reading from Grafana isn't set up")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("on the live site, the trace comes back from Tempo and is drawn @deployed", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/traces");
  await page.getByRole("button", { name: "This site's server (Washington, D.C.)" }).click();
  await page.getByRole("button", { name: "Send it, then draw its trace" }).click();
  const trace = page.getByTestId("trace");
  await expect(trace).toBeVisible({ timeout: 90_000 });
  await expect(trace).toContainText("GET /api/scores");
  await expect(trace).toContainText("SELECT scores");
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
