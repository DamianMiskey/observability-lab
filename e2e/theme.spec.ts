import { expect, test } from "@playwright/test";

// The shared theme switch (@djmiskey/lab-tokens): a choice survives a reload,
// applied before the page draws, and recolours the charts too.
test("a chosen theme survives a reload @readonly", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const series = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--series-1").trim());
  expect(await theme()).toBe("light");
  expect(await series()).toBe("#2a78d6");
  await page.getByRole("group", { name: "Colour theme" }).getByRole("button", { name: "Dark" }).click();
  expect(await theme()).toBe("dark");
  expect(await series()).toBe("#3987e5");
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await theme()).toBe("dark");
});
