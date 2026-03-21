import { expect, test } from "@playwright/test";

function readFacetCount(text: string | null): number {
  const match = text?.match(/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Could not parse facet count from: ${text ?? "<null>"}`);
  }
  return Number.parseInt(match[1] ?? "0", 10);
}

test("detail tag facet keeps results usable", async ({ page }) => {
  await page.goto("/");

  const queryInput = page.locator("#query");
  await queryInput.fill("terms");
  await page.locator("#submit-query").click();

  await expect(page.getByText(/results ·/i)).toBeVisible();
  await page.getByRole("button", { name: /Terms Aggregation and Significant Terms/i }).first().click();

  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
  await page.locator("#center-view").getByRole("button", { name: "discovery", exact: true }).click();

  await expect(page.locator("#active-filters-inline")).toContainText("Tag: discovery");
  await expect(page.getByText(/results ·/i)).toBeVisible();
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
  await expect(page.locator("#center-view")).not.toContainText("No matches found");
});

test("facet count matches the current-query result count after applying it", async ({ page }) => {
  await page.goto("/");

  const queryInput = page.locator("#query");
  await queryInput.fill("terms");
  await page.locator("#submit-query").click();

  const firstTagFacet = page.locator('#facet-sections [data-facet="tag"]').first();
  const expectedCount = readFacetCount(await firstTagFacet.textContent());
  const expectedTag = await firstTagFacet.getAttribute("data-value");

  await firstTagFacet.click();

  await expect(page.locator("#active-filters-inline")).toContainText(`Tag: ${expectedTag}`);
  await expect(page.locator("#result-count")).toHaveText(new RegExp(`^${expectedCount} matches`));
});

test("tag facet without a text query still returns results", async ({ page }) => {
  await page.goto("/docs/discovery/terms-aggregation-and-significant-terms/");

  await page.getByRole("link", { name: "discovery" }).click();

  await expect(page.locator("#active-filters-inline")).toContainText("Tag: discovery");
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
  await expect(page.locator("#center-view")).not.toContainText("No matches found");
});
